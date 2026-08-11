import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

/**
 * 현재 암호로 어떤 권한이 있는지 알려 준다.
 * 화면에서 메뉴 구성과 삭제 버튼 표시 여부를 정하는 데 쓴다.
 * (실제 차단은 각 API에서 하므로, 이 응답을 조작해도 권한이 늘어나지 않는다)
 */
export async function GET(req: Request) {
  const { role, notConfigured } = checkAuth(req);
  if (notConfigured) {
    return NextResponse.json({ role: null, error: 'passcode_not_configured' }, { status: 503 });
  }
  if (!role) {
    return NextResponse.json({ role: null, error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ role });
}
