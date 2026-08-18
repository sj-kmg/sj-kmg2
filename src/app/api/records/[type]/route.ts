import { NextResponse } from 'next/server';
import { canRead, canWrite, checkAuth, type AuthResult } from '@/lib/auth';
import { db, firebaseReady } from '@/lib/firebaseAdmin';
import { deleteFiles } from '@/lib/fileStore';

/**
 * 현장 기록(TBM일지·아차사고·작업인원·위험성평가 등) 저장 API — Cloud Firestore 기반.
 * - 기록 1건 = records/{type}/entries/{id} 문서 (같은 id로 덮어쓰므로 동시 작성 충돌 없음)
 * - 모든 요청은 x-passcode 헤더가 환경변수 SJ_PASSCODE와 일치해야 한다.
 * - Firebase 자격증명이나 암호가 설정되지 않았으면 503 → 클라이언트는 로컬 저장으로 폴백.
 */
const TYPES = new Set([
  'tbm',
  'nearmiss',
  'workforce',
  'risk',
  'yncc-workers',
  'yncc-vehicles',
  'chem-workers',
  'cards',
  'workplan',
  'annual-plan',
  'annual-plan-tasks',
  'memo',
  'pass-vehicles',
  'health',
  'health-followup',
  'supervisor',
  'detectors',
  'vehicle-service',
  'vehicle-check',
  'vehicle-items',
  'equipment',
  'inventory',
  'safety-items',
  'safety-dates',
  'labor-roster',
]);

/** 기록 종류별 컬렉션 — records/{type}/entries/{id} */
function entriesOf(type: string) {
  return db().collection('records').doc(type).collection('entries');
}

/** 통과하면 인증 결과, 막히면 응답을 돌려준다 */
async function gate(req: Request, type: string): Promise<{ auth: AuthResult } | { denied: NextResponse }> {
  if (!firebaseReady()) {
    return { denied: NextResponse.json({ error: 'storage_not_configured' }, { status: 503 }) };
  }
  const auth = await checkAuth(req);
  if (auth.notConfigured) {
    return { denied: NextResponse.json({ error: 'passcode_not_configured' }, { status: 503 }) };
  }
  if (!auth.role) {
    return {
      denied: NextResponse.json(
        { error: auth.pending ? 'approval_pending' : 'unauthorized' },
        { status: 401 },
      ),
    };
  }
  // 현장 계정은 TBM일지·아차사고만, 열람자는 허용된 메뉴의 기록만 볼 수 있다
  if (!canRead(auth, type)) {
    return { denied: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { auth };
}

function badType(): NextResponse {
  return NextResponse.json({ error: 'bad_type' }, { status: 400 });
}

/** 자격증명 오류 등 저장소 접근 실패 — 클라이언트가 로컬로 폴백하도록 503 */
function unavailable(e: unknown): NextResponse {
  console.error('firestore access failed:', e);
  return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
}

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.has(type)) return badType();
  const gated = await gate(req, type);
  if ('denied' in gated) return gated.denied;

  try {
    const snap = await entriesOf(type).get();
    return NextResponse.json({ entries: snap.docs.map((d) => d.data()) });
  } catch (e) {
    return unavailable(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.has(type)) return badType();
  const gated = await gate(req, type);
  if ('denied' in gated) return gated.denied;
  // 열람 전용(구글 승인) 계정은 어떤 기록도 저장할 수 없다
  if (!canWrite(gated.auth, type)) {
    return NextResponse.json({ error: 'read_only' }, { status: 403 });
  }

  let entry: Record<string, unknown>;
  try {
    entry = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const id = typeof entry.id === 'string' ? entry.id : '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  }
  if (JSON.stringify(entry).length > 200_000) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  try {
    const ref = entriesOf(type).doc(id);
    // 현장 계정은 새로 쓰기만 할 수 있다 — 이미 있는 기록은 건드리지 않는다.
    // (이미 저장된 건을 다시 보내면 조용히 넘어가므로 재전송에도 안전하다)
    if (gated.auth.role === 'field' && (await ref.get()).exists) {
      return NextResponse.json({ ok: true, skipped: 'exists' });
    }
    await ref.set(entry);
  } catch (e) {
    return unavailable(e);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.has(type)) return badType();
  const gated = await gate(req, type);
  if ('denied' in gated) return gated.denied;
  // 삭제는 관리자만
  if (gated.auth.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  }
  try {
    const ref = entriesOf(type).doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      // 첨부 사진(photoUrls)이 있는 기록이면 사진도 함께 삭제
      const urls = (snap.data() as { photoUrls?: unknown }).photoUrls;
      if (Array.isArray(urls)) {
        await deleteFiles(urls.filter((u): u is string => typeof u === 'string'));
      }
      await ref.delete();
    }
  } catch (e) {
    return unavailable(e);
  }
  return NextResponse.json({ ok: true });
}
