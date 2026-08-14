/**
 * 아차사고 공용 타입 — [아차사고] 화면과 메인 대시보드가 함께 쓴다.
 */
export interface NearMissEntry {
  id: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  place: string;
  finder: string;
  content: string;
  action: string; // 개선대책
  photoIds: string[]; // 로컬(IndexedDB) 저장 사진
  photoUrls?: string[]; // 서버 저장 사진
  createdAt: string;
}

export const NEARMISS_KEY = 'sj-nearmiss:v1';

/** 아차사고 기록의 날짜(YYYY-MM-DD) */
export function nearMissDate(e: NearMissEntry): string {
  return (e.datetime ?? '').slice(0, 10);
}
