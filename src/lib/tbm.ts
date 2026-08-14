/**
 * TBM일지 공용 타입 — [TBM일지] 화면과 메인 대시보드가 함께 쓴다.
 */
export interface TbmEntry {
  id: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  site: string; // 현장(발주처·공장)
  place: string; // 작업 위치
  work: string; // 작업 내용
  attendees: string; // 참석 인원
  leader: string; // 진행자(작성자)
  content: string; // TBM 내용 (위험요인·안전대책 공유)
  createdAt: string;
}

export const TBM_KEY = 'sj-tbm:v1';

/** TBM 기록의 날짜(YYYY-MM-DD) */
export function tbmDate(e: TbmEntry): string {
  return (e.datetime ?? '').slice(0, 10);
}

/** 참석 인원 칸에서 인원 수를 추정한다 — "8명" 또는 "홍길동, 김철수" 모두 처리 */
export function tbmAttendeeCount(e: TbmEntry): number {
  const raw = (e.attendees ?? '').trim();
  if (!raw) return 0;
  const onlyCount = raw.match(/^(\d+)\s*명?$/);
  if (onlyCount) return Number(onlyCount[1]);
  return raw
    .split(/[,·/]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}
