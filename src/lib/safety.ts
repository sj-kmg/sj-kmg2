/**
 * 안전용품관리 — 품목별 재고를 「확인일자별」로 기록한다.
 *
 * 확인일자를 열로 늘리면 실사 횟수만큼 표가 옆으로 길어져 감당이 안 되므로,
 * 날짜는 달력에서 하나 고르고 그 날짜의 수량만 보여 준다.
 * 수량은 품목 안에 `날짜 → 수량` 형태로 쌓이므로 지난 일자도 언제든 다시 볼 수 있다.
 *
 * 원본: 안전용품 재고현황_2026.xlsx (2026-08-06 확인분)
 */
import { seedId } from './ids';

/** 안전용품 1종 */
export interface SafetyItem {
  id: string;
  name: string; // 품명
  unit: string; // 단위
  /** 확인일자(YYYY-MM-DD) → 그 날 확인한 수량 */
  qtys: Record<string, number | null>;
  note: string;
  order: number;
  updatedAt: string;
}

export const SAFETY_ITEMS_KEY = 'sj-safety-items:v1';

export const SAFETY_UNITS = ['EA', '조', '벌', 'BOX', '단', '타', '개', '통'];

export function compareSafetyItem(a: SafetyItem, b: SafetyItem): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'ko');
}

/** MM.DD 표시 (원본 대장 표기와 동일) */
export function shortDate(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[1]}.${m[2]}` : date;
}

/** 기록이 있는 확인일자 목록 — 과거 → 최근 */
export function recordedDates(items: SafetyItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) {
    for (const [date, qty] of Object.entries(it.qtys ?? {})) {
      if (date && qty !== null && qty !== undefined) set.add(date);
    }
  }
  return [...set].sort();
}

/** 그 날짜 바로 이전에 확인한 일자 */
export function previousDate(dates: string[], date: string): string | null {
  const past = dates.filter((d) => d < date);
  return past.length ? past[past.length - 1] : null;
}

/** 최초 등록 확인일자 */
export const FIRST_DATE = '2026-08-06';

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
    qtys: { [FIRST_DATE]: qty } as Record<string, number | null>,
    note: '',
    order: i + 1,
    updatedAt: '',
  }));
}
