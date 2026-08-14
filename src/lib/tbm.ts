/**
 * TBM일지 공용 타입 — [TBM일지] 화면과 메인 대시보드가 함께 쓴다.
 *
 * 초기 버전은 참석자를 자유 입력(`attendees`), 위험요인·안전대책을 한 칸(`content`)에
 * 적었다. 지금은 참석자를 이름 목록(`attendeeList`)으로, 내용을 위험요인(`hazard`)과
 * 안전대책(`measure`)으로 나눠 받는다. 이미 저장된 기록이 있으므로 구버전 필드는
 * 남겨 두고 읽을 때 아래 헬퍼로 흡수한다.
 */
export interface TbmEntry {
  id: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  site: string; // 현장(발주처) — 예: 여천NCC 2공장
  place: string; // 공사명 — 예: B Boiler Cleaning
  work: string; // 금일작업내용
  leader: string; // 진행자(작성자)
  /** 참석자 이름 목록 (현행) */
  attendeeList?: string[];
  /** 참석인원 자유 입력 (구버전 기록 호환) */
  attendees: string;
  /** 위험요인 (현행) */
  hazard?: string;
  /** 안전대책 (현행) */
  measure?: string;
  /** 위험요인·안전대책 통합 입력 (구버전 기록 호환) */
  content: string;
  createdAt: string;
}

export const TBM_KEY = 'sj-tbm:v1';

/** TBM 기록의 날짜(YYYY-MM-DD) */
export function tbmDate(e: TbmEntry): string {
  return (e.datetime ?? '').slice(0, 10);
}

/** 참석자 이름 목록 — 구버전 기록은 자유 입력 칸을 쪼개서 쓴다 */
export function tbmAttendees(e: TbmEntry): string[] {
  if (e.attendeeList && e.attendeeList.length > 0) return e.attendeeList.filter(Boolean);
  const raw = (e.attendees ?? '').trim();
  if (!raw) return [];
  // "8명"처럼 인원 수만 적힌 구버전 기록은 이름으로 볼 수 없다
  if (/^\d+\s*명?$/.test(raw)) return [];
  return raw
    .split(/[,·/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 참석 인원 수 — 이름 목록이 없으면 "8명" 형태의 숫자를 읽는다 */
export function tbmAttendeeCount(e: TbmEntry): number {
  const names = tbmAttendees(e);
  if (names.length > 0) return names.length;
  const onlyCount = (e.attendees ?? '').trim().match(/^(\d+)\s*명?$/);
  return onlyCount ? Number(onlyCount[1]) : 0;
}

/** 위험요인 — 구버전 기록은 통합 입력 칸이 곧 위험요인·안전대책이다 */
export function tbmHazard(e: TbmEntry): string {
  return (e.hazard ?? '').trim() || (e.measure ? '' : (e.content ?? '').trim());
}

/** 안전대책 */
export function tbmMeasure(e: TbmEntry): string {
  return (e.measure ?? '').trim();
}
