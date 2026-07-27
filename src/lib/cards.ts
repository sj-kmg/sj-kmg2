/** 신청현황 — 상시카드 데이터 타입. 공무관리 메뉴와 메인 [공무관리 현황] 패널이 공유한다. */

export interface AccessCard {
  id: string;
  name: string; // 성명
  applyType: '신규' | '연장'; // 신청구분
  issueDate: string; // 발급일자 YYYY-MM-DD
  endDate: string; // 종료일자 — 발급일 + 1년 - 1일 자동 계산
  loginId: string; // 아이디
  password: string; // 비밀번호 (화면에서는 숨김, 버튼으로 표시)
  updatedAt: string;
}

export const CARDS_KEY = 'sj-cards:v1';

/** 종료일자 알림 시작 (D-100) */
export const CARD_NOTICE_DAYS = 100;

/** 발급일 + 1년 - 1일 (예: 2025-09-24 발급 → 2026-09-23 종료) */
export function cardEndDate(issueDate: string): string {
  const d = new Date(`${issueDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
