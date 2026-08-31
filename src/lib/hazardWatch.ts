/**
 * 유해인자별 갱신주기 관리.
 *
 * 특수건강진단은 보통 1년 주기지만, 유해인자에 따라 더 짧게 다시 받아야 하는 물질이 있다.
 * 그래서 검진일자 하나로 뭉뚱그리지 않고 **물질별로 마지막 검진일을 따로** 들고 있다가
 * 물질마다 다음 검진일을 계산한다.
 *
 * 예) 1월에 세 물질을 한 번에 검진했다면
 *     크실렌·톨루엔은 이듬해 1월, 벤젠은 그해 7월에 다시 받아야 한다.
 *     7월에 벤젠만 다시 받으면 벤젠 날짜만 갱신되고 나머지는 그대로다.
 */
import { daysUntil, noticeLevel, type NoticeLevel } from './education';

/** 따로 관리하는 물질과 갱신주기(개월) */
export const HAZARD_CYCLE_MONTHS: Record<string, number> = {
  벤젠: 6,
  톨루엔: 12,
  크실렌: 12,
};

/** 표시 순서 — 주기가 짧아 자주 챙겨야 하는 것부터 */
export const WATCHED_HAZARDS = ['벤젠', '톨루엔', '크실렌'] as const;

/** 갱신일이 다가오면 알리기 시작하는 시점 */
export const HAZARD_NOTICE_DAYS = 60;

/** 물질 하나의 마지막 검진일 */
export interface HazardWatch {
  /** 물질명 — WATCHED_HAZARDS 중 하나 */
  name: string;
  /** 이 물질을 마지막으로 검진한 날 (YYYY-MM-DD) */
  checkedAt: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 개월 수를 더한다 — 말일 처리 포함.
 * (8월 31일 + 6개월은 2월 31일이 없으므로 2월 말일로 맞춘다)
 */
export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 이 물질의 다음 검진 예정일 */
export function hazardRenewDate(name: string, checkedAt: string): string {
  const months = HAZARD_CYCLE_MONTHS[name];
  if (!months || !checkedAt) return '';
  return addMonths(checkedAt, months);
}

/** 화면에 뿌릴 물질별 상태 */
export interface HazardStatus {
  name: string;
  months: number;
  checkedAt: string;
  renewAt: string;
  /** 남은 날 — 지났으면 음수 */
  days: number;
  /** 알림 단계 (아직 여유 있으면 null) */
  level: NoticeLevel | null;
}

/**
 * 물질별 상태를 갱신이 급한 순서로 돌려준다.
 * 기록이 없는 물질은 빼고, 오늘을 모르면(서버 렌더) 빈 목록을 준다.
 */
export function hazardStatuses(list: HazardWatch[] | undefined, today: Date | null): HazardStatus[] {
  if (!list?.length || !today) return [];
  const seen = new Set<string>();
  const out: HazardStatus[] = [];
  for (const h of list) {
    const months = HAZARD_CYCLE_MONTHS[h.name];
    if (!months || !h.checkedAt || seen.has(h.name)) continue;
    seen.add(h.name);
    const renewAt = hazardRenewDate(h.name, h.checkedAt);
    const days = daysUntil(renewAt, today);
    out.push({ name: h.name, months, checkedAt: h.checkedAt, renewAt, days, level: noticeLevel(days, HAZARD_NOTICE_DAYS) });
  }
  return out.sort((a, b) => a.days - b.days);
}

/**
 * 서류의 유해인자 목록에서 따로 관리하는 물질만 골라낸다.
 * 확인서마다 유해인자가 다르다 — 연간 검진은 세 물질이 모두 적혀 있고,
 * 벤젠 재검 확인서에는 벤젠만 들어 있어 그것만 갱신하면 된다.
 */
export function watchedHazardsIn(text: string | null | undefined): string[] {
  const flat = (text ?? '').replace(/\s+/g, '');
  return WATCHED_HAZARDS.filter((h) => flat.includes(h));
}

/**
 * 검진 결과를 반영한 새 목록 — 이번에 검진한 물질만 날짜를 바꾸고 나머지는 그대로 둔다.
 * 목록에 없던 물질은 새로 추가한다.
 */
export function applyHazardCheck(
  cur: HazardWatch[] | undefined,
  names: string[],
  checkedAt: string,
): HazardWatch[] {
  if (!checkedAt || names.length === 0) return cur ?? [];
  const out = [...(cur ?? [])];
  for (const name of names) {
    if (!HAZARD_CYCLE_MONTHS[name]) continue;
    const i = out.findIndex((h) => h.name === name);
    // 더 최근 검진만 반영한다 (예전 서류를 뒤늦게 붙여도 최신 날짜가 밀리지 않게)
    if (i >= 0) {
      if (checkedAt > out[i].checkedAt) out[i] = { name, checkedAt };
    } else {
      out.push({ name, checkedAt });
    }
  }
  return out;
}

/** 갱신이 가장 급한 물질 (없으면 null) — 목록 정렬·요약에 쓴다 */
export function mostUrgentHazard(list: HazardWatch[] | undefined, today: Date | null): HazardStatus | null {
  return hazardStatuses(list, today)[0] ?? null;
}
