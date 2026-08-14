/**
 * 열람 신청·승인 (서버 전용 저장 구조와 공용 타입).
 *
 * Firestore `access/{uid}` 문서 1개 = 구글 계정 1개의 접근 상태.
 * 관리자가 승인하면서 볼 수 있는 메뉴(menus)를 함께 지정한다.
 */
export type AccessStatus = 'pending' | 'approved' | 'rejected';

export interface AccessEntry {
  uid: string;
  email: string;
  name: string;
  photo: string;
  status: AccessStatus;
  /** 승인 시 열어 준 메뉴 키 목록 */
  menus: string[];
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

/** 관리자 구글 계정 — 이 계정만 승인 권한을 갖는다 */
export function adminEmails(): string[] {
  return (process.env.SJ_ADMIN_EMAILS ?? 'aldrb5@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}
