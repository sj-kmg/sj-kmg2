import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { db, firebaseReady } from '@/lib/firebaseAdmin';

/**
 * 지금 자격(암호 또는 구글 로그인)으로 어떤 권한이 있는지 알려 준다.
 * 화면에서 메뉴 구성과 버튼 표시 여부를 정하는 데 쓴다.
 * (실제 차단은 각 API에서 하므로, 이 응답을 조작해도 권한이 늘어나지 않는다)
 */
export async function GET(req: Request) {
  const auth = await checkAuth(req);

  if (auth.notConfigured) {
    return NextResponse.json({ role: null, error: 'passcode_not_configured' }, { status: 503 });
  }

  if (!auth.role) {
    // 구글 로그인은 했지만 아직 승인 전 — 화면에서 "승인 대기" 안내를 띄운다
    if (auth.user) {
      return NextResponse.json(
        {
          role: null,
          status: auth.pending ? 'pending' : 'rejected',
          user: auth.user,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ role: null, error: 'unauthorized' }, { status: 401 });
  }

  // 관리자에게는 대기 중인 신청 건수를 함께 준다 (좌측 메뉴 배지용)
  let pendingCount = 0;
  if (auth.role === 'admin' && firebaseReady()) {
    try {
      const snap = await db().collection('access').where('status', '==', 'pending').get();
      pendingCount = snap.size;
    } catch {
      // 조회 실패는 배지만 못 보여 줄 뿐이라 무시한다
    }
  }

  return NextResponse.json({
    role: auth.role,
    menus: auth.menus ?? null,
    user: auth.user ?? null,
    pendingCount,
  });
}
