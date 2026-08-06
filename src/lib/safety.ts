/**
 * 안전용품관리 — 품명이 행, 재고 확인 일자가 열인 표.
 * 재고를 실사할 때마다 일자 열을 추가하고 품목별 수량을 적는다.
 * 원본: 안전용품 재고현황_2026.xlsx (2026-08-06 확인분)
 */
import { seedId } from './ids';

/** 안전용품 1종 */
export interface SafetyItem {
  id: string;
  name: string; // 품명
  unit: string; // 단위
  /** 일자 열 id → 그 날 확인한 수량 (미확인은 null) */
  qtys: Record<string, number | null>;
  note: string;
  order: number;
  updatedAt: string;
}

/** 재고 확인 일자(열) — 사용자가 직접 추가한다 */
export interface SafetyDate {
  id: string;
  date: string; // YYYY-MM-DD
  order: number;
  updatedAt: string;
}

export const SAFETY_ITEMS_KEY = 'sj-safety-items:v1';
export const SAFETY_DATES_KEY = 'sj-safety-dates:v1';

export const SAFETY_UNITS = ['EA', '조', '벌', 'BOX', '단', '타', '개'];

export function compareSafetyItem(a: SafetyItem, b: SafetyItem): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'ko');
}

/** 일자 열은 왼쪽이 과거, 오른쪽이 최근 */
export function compareSafetyDate(a: SafetyDate, b: SafetyDate): number {
  return (a.date || '9999').localeCompare(b.date || '9999') || a.order - b.order;
}

/** MM.DD 표시 (원본 대장 표기와 동일) */
export function shortDate(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[1]}.${m[2]}` : date || '(일자 미입력)';
}

/** 최초 등록 일자 열 — 원본의 08.06 확인분 */
export const FIRST_DATE_ID = 'SD-01';

export function safetyDateSeed(): SafetyDate[] {
  return [{ id: FIRST_DATE_ID, date: '2026-08-06', order: 1, updatedAt: '' }];
}

/**
 * 안전용품 17종 — 저장 이력이 없을 때 최초 1회 자동 등록된다.
 * [품명, 단위, 2026-08-06 확인 수량]
 */
export function safetyItemSeed(): SafetyItem[] {
  const rows: [string, string, number][] = [
    ['공기호흡기', 'EA', 8],
    ['공기호흡기 케이스', 'EA', 6],
    ['송기마스크 면체', 'EA', 8],
    ['송기마스크 장착대', 'EA', 10],
    ['전면형 마스크', 'EA', 19],
    ['반면형 마스크', 'EA', 15],
    ['수동 윈치', 'EA', 8],
    ['전동 윈치', 'EA', 3],
    ['산소&가스측정기', 'EA', 20],
    ['구조용 삼각대', 'EA', 4],
    ['들 것', 'EA', 6],
    ['안전대', 'EA', 60],
    ['귀덮개', 'EA', 26],
    ['안전블록', 'EA', 11],
    ['Air Fan', 'EA', 5],
    ['전기 Fan', 'EA', 6],
    ['소화기', 'EA', 23],
  ];
  return rows.map(([name, unit, qty], i) => ({
    id: seedId('SI-seed', i),
    name,
    unit,
    qtys: { [FIRST_DATE_ID]: qty } as Record<string, number | null>,
    note: '',
    order: i + 1,
    updatedAt: '',
  }));
}
