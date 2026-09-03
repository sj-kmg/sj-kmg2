/**
 * 접근 권한 (서버 전용) — 두 가지 방법을 함께 받는다.
 *
 *  1) 암호 (기존, 현장 직원용)
 *     - 관리자(admin) : SJ_PASSCODE       — 모든 기능. 기록 수정·삭제 가능
 *     - 현장(field)   : SJ_FIELD_PASSCODE — TBM일지·아차사고 작성만. 삭제 불가,
 *                                           이미 저장된 기록은 덮어쓸 수 없다
 *  2) 구글 로그인 (신규, 외부 열람자용)
 *     - 관리자 계정(SJ_ADMIN_EMAILS)  → admin
 *     - 승인된 계정                    → viewer (읽기 전용 + 허용된 메뉴만)
 *     - 미승인·거절                    → 권한 없음
 *
 * viewer는 어떤 경우에도 쓰기·삭제를 할 수 없다. 화면에서 버튼을 숨기는 것과
 * 별개로 여기서 막아야 주소창으로 API를 직접 부르는 것을 차단할 수 있다.
 */
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { isAdminEmail, type AccessEntry } from './access';
import { db, firebaseReady, projectId } from './firebaseAdmin';
import { typesForMenus } from './menus';

export type Role = 'admin' | 'field' | 'viewer';

export interface AuthResult {
  /** 통과했으면 역할, 아니면 null */
  role: Role | null;
  /** 암호가 서버에 아예 설정되지 않은 상태 */
  notConfigured: boolean;
  /** viewer가 열람할 수 있는 메뉴 키 */
  menus?: string[];
  /** 구글 로그인 사용자 정보 */
  user?: { uid: string; email: string; name: string; photo: string };
  /** 로그인은 했으나 아직 승인되지 않음 */
  pending?: boolean;
}

/** 현장 계정이 **작성**할 수 있는 기록 종류 */
export const FIELD_TYPES = new Set(['tbm', 'nearmiss']);

/**
 * 현장 계정이 읽을 수 있는 기록 종류 — 현장에서 차량 서류를 제시할 일이 있어 YNCC차량도 연다.
 */
export const FIELD_READ_TYPES = new Set([...FIELD_TYPES, 'yncc-vehicles']);

/**
 * 현장 계정이 **일부 칸만** 고칠 수 있는 기록 종류.
 *
 * YNCC차량은 누가 그 차를 쓰는지가 현장에서 자주 바뀌어, 차량 등록자만 직원이 직접
 * 고칠 수 있게 열어 둔다. 서류·만료일·차량번호는 관리자만 손댄다.
 * 서버가 여기 적힌 칸만 반영하므로, 화면을 우회해도 다른 값은 바뀌지 않는다.
 */
export const FIELD_EDITABLE_FIELDS: Record<string, string[]> = {
  'yncc-vehicles': ['registrant'],
};

function adminApp() {
  return getApps()[0] ?? initializeApp({ projectId: projectId() });
}

/** Authorization: Bearer <idToken> 검증 */
async function checkGoogle(req: Request): Promise<AuthResult | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !firebaseReady()) return null;

  let decoded;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(token);
  } catch {
    return { role: null, notConfigured: false };
  }

  const user = {
    uid: decoded.uid,
    email: decoded.email ?? '',
    name: decoded.name ?? decoded.email ?? '',
    photo: decoded.picture ?? '',
  };

  if (isAdminEmail(user.email)) {
    return { role: 'admin', notConfigured: false, user };
  }

  // 승인 상태 조회 — 없으면 이 시점에 신청서를 만들어 둔다.
  // 저장소 접근이 실패하면 권한을 주지 않는다 (막히는 쪽이 안전하다).
  try {
    const ref = db().collection('access').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const entry: AccessEntry = {
        ...user,
        status: 'pending',
        menus: [],
        requestedAt: new Date().toISOString(),
      };
      await ref.set(entry);
      return { role: null, notConfigured: false, user, pending: true };
    }

    const entry = snap.data() as AccessEntry;
    // 이름·사진이 바뀌었으면 갱신해 둔다 (승인 화면에서 최신 정보를 보도록)
    if (entry.email !== user.email || entry.name !== user.name || entry.photo !== user.photo) {
      await ref.set({ email: user.email, name: user.name, photo: user.photo }, { merge: true });
    }
    if (entry.status !== 'approved') {
      return { role: null, notConfigured: false, user, pending: entry.status === 'pending' };
    }
    return { role: 'viewer', notConfigured: false, menus: entry.menus ?? [], user };
  } catch (e) {
    console.error('access lookup failed:', e);
    return { role: null, notConfigured: false, user };
  }
}

export async function checkAuth(req: Request): Promise<AuthResult> {
  // 구글 로그인이 먼저 — 로그인한 사용자는 암호 없이도 들어온다
  const google = await checkGoogle(req);
  if (google) return google;

  const admin = process.env.SJ_PASSCODE;
  const field = process.env.SJ_FIELD_PASSCODE;
  if (!admin) return { role: null, notConfigured: true };

  const given = req.headers.get('x-passcode');
  if (given && given === admin) return { role: 'admin', notConfigured: false };
  if (given && field && given === field) return { role: 'field', notConfigured: false };
  return { role: null, notConfigured: false };
}

/** 이 역할이 해당 기록 종류를 읽을 수 있는가 */
export function canRead(auth: AuthResult, type: string): boolean {
  if (auth.role === 'admin') return true;
  if (auth.role === 'field') return FIELD_READ_TYPES.has(type);
  if (auth.role === 'viewer') return typesForMenus(auth.menus ?? []).has(type);
  return false;
}

/** 쓰기 가능한 역할인가 — viewer는 언제나 불가 */
export function canWrite(auth: AuthResult, type: string): boolean {
  if (auth.role === 'admin') return true;
  // 일부 칸만 고칠 수 있는 종류도 여기서는 통과시키고, 어떤 칸인지는 저장할 때 거른다
  if (auth.role === 'field') return FIELD_TYPES.has(type) || type in FIELD_EDITABLE_FIELDS;
  return false;
}
