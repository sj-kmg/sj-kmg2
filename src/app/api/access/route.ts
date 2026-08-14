import { NextResponse } from 'next/server';
import type { AccessEntry, AccessStatus } from '@/lib/access';
import { checkAuth } from '@/lib/auth';
import { db, firebaseReady } from '@/lib/firebaseAdmin';
import { sanitizeMenus } from '@/lib/menus';

/**
 * 열람 신청 관리 API — 관리자 전용.
 *
 *  GET    : 신청·승인 목록 전체
 *  PATCH  : 승인/거절 + 열어 줄 메뉴 지정  { uid, status, menus }
 *  DELETE : 신청 기록 삭제 (?uid=)
 *
 * 관리자 판별은 서버에서 구글 토큰의 이메일로 한다. 화면 조작으로는 우회할 수 없다.
 */
async function requireAdmin(req: Request): Promise<NextResponse | null> {
  if (!firebaseReady()) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 });
  }
  const auth = await checkAuth(req);
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

/** 승인 처리자 표기용 — 암호 로그인 관리자는 이메일이 없다 */
async function actorOf(req: Request): Promise<string> {
  const auth = await checkAuth(req);
  return auth.user?.email ?? 'admin(passcode)';
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const snap = await db().collection('access').get();
    const entries = snap.docs
      .map((d) => d.data() as AccessEntry)
      .sort((a, b) => {
        // 대기 중인 신청을 맨 위로, 그다음 최신순
        if (a.status !== b.status) {
          if (a.status === 'pending') return -1;
          if (b.status === 'pending') return 1;
        }
        return (b.requestedAt ?? '').localeCompare(a.requestedAt ?? '');
      });
    return NextResponse.json({ entries });
  } catch (e) {
    console.error('access list failed:', e);
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { uid?: unknown; status?: unknown; menus?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const uid = typeof body.uid === 'string' ? body.uid : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    return NextResponse.json({ error: 'bad_uid' }, { status: 400 });
  }
  const status = body.status as AccessStatus;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'bad_status' }, { status: 400 });
  }
  // 승인된 경우에만 메뉴가 의미를 갖는다
  const menus = status === 'approved' ? sanitizeMenus(body.menus) : [];

  try {
    const ref = db().collection('access').doc(uid);
    if (!(await ref.get()).exists) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    await ref.set(
      { status, menus, decidedAt: new Date().toISOString(), decidedBy: await actorOf(req) },
      { merge: true },
    );
  } catch (e) {
    console.error('access update failed:', e);
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const uid = new URL(req.url).searchParams.get('uid') ?? '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    return NextResponse.json({ error: 'bad_uid' }, { status: 400 });
  }
  try {
    await db().collection('access').doc(uid).delete();
  } catch (e) {
    console.error('access delete failed:', e);
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
