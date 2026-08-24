/**
 * 작업인원 기록 공용 타입·계산 — [작업인원관리] 화면과 메인 대시보드가 함께 쓴다.
 */

/** 인력 1명 = 1행 (구분번호는 행 순서로 자동 부여) */
export interface LaborRow {
  category: string; // 구분 (공영인력 등)
  name: string; // 인력이름
  workType: string; // 작업구분
  hours: string; // 작업시간
}

/**
 * 기간 중 특정 날짜만 다르게 잡을 때 쓰는 값.
 * 적어 두지 않은 항목은 기록의 기본값을 그대로 따른다.
 */
export interface DayOverride {
  /** 그날은 작업하지 않음 (주말·우천 휴무 등) — 달력·집계에서 아예 빠진다 */
  off?: boolean;
  staff?: string;
  workHours?: string;
  work?: string;
  equipment?: string;
  /** 그날만 다른 인력 구성 (빈 배열이면 "그날은 인력 없음") */
  laborRows?: LaborRow[];
}

export interface WorkforceEntry {
  id: string;
  site: string; // 현장명
  date: string; // 작업 시작일(YYYY-MM-DD)
  /**
   * 작업 종료일 — 여러 날 이어지는 작업을 한 번만 기록하기 위한 값.
   * 비어 있거나 시작일과 같으면 하루짜리 작업이다 (예전 기록은 이 값이 없다).
   */
  endDate?: string;
  /** 기간 중 따로 지정한 날 — 키는 YYYY-MM-DD */
  overrides?: Record<string, DayOverride>;
  manager: string; // 현장소장
  staff: string; // 직원
  laborRows?: LaborRow[]; // 인력 목록
  laborNames?: string; // (구버전 기록 호환)
  laborCount?: string; // (구버전 기록 호환)
  workHours: string; // 작업시간(현장 전체)
  work: string; // 작업내용
  equipment: string; // 장비현황
  createdAt: string;
  updatedAt?: string; // 마지막 수정 시각 (수정한 적 없으면 없음)
}

export const WORKFORCE_KEY = 'sj-workforce:v1';

export const LABOR_CATEGORIES = ['공영인력', '개미인력', '여수인력', '여천인력', '당근인력'];

/** 인력 구분별 색 — 도넛/막대/배지에서 같은 색을 쓴다 */
export const LABOR_COLORS: Record<string, string> = {
  공영인력: '#4b7bff',
  개미인력: '#22d3ee',
  여수인력: '#8b5cf6',
  여천인력: '#34d399',
  당근인력: '#fbbf24',
};
export const LABOR_ETC_COLOR = '#8b98b8';

export function laborColor(category: string): string {
  return LABOR_COLORS[category] ?? LABOR_ETC_COLOR;
}

/** 현장별 고정 색 — 이름을 해시해 캘린더·보드·범례에서 같은 색을 쓴다 */
const SITE_PALETTE = ['#4b7bff', '#22d3ee', '#8b5cf6', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#60a5fa'];

export function siteColor(site: string): string {
  let h = 0;
  for (let i = 0; i < site.length; i += 1) h = (h * 31 + site.charCodeAt(i)) >>> 0;
  return SITE_PALETTE[h % SITE_PALETTE.length];
}

/** 그 기록의 인력 수 (구버전 기록은 laborCount 사용) */
export function laborCountOf(e: WorkforceEntry): number {
  if (e.laborRows && e.laborRows.length > 0) return e.laborRows.length;
  return Number(e.laborCount) || 0;
}

/** 자유 입력된 직원 칸("김민규, 박OO (2명)")에서 이름만 뽑아낸다 */
export function staffNames(raw: string): string[] {
  return (raw ?? '')
    .split(/[,·/]/)
    .map((s) => s.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
}

export function staffCountOf(e: WorkforceEntry): number {
  return staffNames(e.staff).length;
}

/** 현장 1건의 총 투입 인원 = 직원 + 인력 */
export function headcountOf(e: WorkforceEntry): number {
  return staffCountOf(e) + laborCountOf(e);
}

export function laborSummary(e: WorkforceEntry): string {
  if (e.laborRows && e.laborRows.length > 0) {
    return e.laborRows
      .map((r, i) => `${i + 1}. ${[r.category, r.name, r.workType, r.hours].filter(Boolean).join(' ')}`)
      .join(' / ');
  }
  return [e.laborNames, e.laborCount && `${e.laborCount}명`].filter(Boolean).join(' · ');
}

/** YYYY-MM-DD (로컬 기준) */
export function ymd(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayLocal(): string {
  return ymd(new Date());
}

/** 하루 뒤 날짜 */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return ymd(d);
}

/** 기간 계산에 필요한 값만 — 작성 중인 입력폼도 그대로 넘길 수 있게 한다 */
export type DateRange = Pick<WorkforceEntry, 'date' | 'endDate'>;

/**
 * 한 기록이 며칠까지 이어지는지 — 기간을 지정하지 않았으면 시작일과 같다.
 * 종료일이 시작일보다 앞서는 잘못된 값은 무시하고 하루짜리로 본다.
 */
export function endDateOf(e: DateRange): string {
  const end = (e.endDate ?? '').trim();
  return end && end > e.date ? end : e.date;
}

/** 며칠짜리 작업인지 (하루면 1) */
export function workDaysOf(e: DateRange): number {
  if (!e.date) return 0;
  const a = new Date(`${e.date}T00:00:00`).getTime();
  const b = new Date(`${endDateOf(e)}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.floor((b - a) / 86400000) + 1;
}

/** 기간을 너무 길게 잘못 넣었을 때 달력·집계가 폭주하지 않도록 두는 한계 */
export const MAX_WORK_DAYS = 366;

/**
 * 기록이 덮는 날짜를 모두 펼친다 — 달력·투입인원 집계는 이걸 기준으로 센다.
 * 그래야 "4/6~4/10 상주" 같은 작업을 한 번만 적어도 닷새 모두에 나타난다.
 */
export function datesOf(e: DateRange): string[] {
  if (!e.date) return [];
  const last = endDateOf(e);
  const out: string[] = [];
  let cur = e.date;
  while (out.length < MAX_WORK_DAYS) {
    out.push(cur);
    if (cur >= last) break;
    cur = nextDay(cur);
  }
  return out;
}

/** 그 날짜에 이 기록이 걸쳐 있는지 */
export function coversDate(e: DateRange, date: string): boolean {
  return !!e.date && date >= e.date && date <= endDateOf(e);
}

/** 화면 표시용 — 하루면 "2026-04-06", 기간이면 "2026-04-06 ~ 04-10 (5일)" */
export function dateLabelOf(e: DateRange): string {
  const last = endDateOf(e);
  if (last === e.date) return e.date;
  // 같은 해면 뒤쪽은 월-일만 보여 짧게 쓴다
  const tail = last.slice(0, 4) === e.date.slice(0, 4) ? last.slice(5) : last;
  return `${e.date} ~ ${tail} (${workDaysOf(e)}일)`;
}

/* ── 기간 중 특정 날짜만 다르게 지정하기 ─────────────────────────── */

/** 그 날짜에 따로 지정한 내용 (없으면 undefined) */
export function dayOverrideOf(e: WorkforceEntry, date: string): DayOverride | undefined {
  return e.overrides?.[date];
}

/** 그날은 쉬는 날로 지정했는지 */
export function isOffDay(e: WorkforceEntry, date: string): boolean {
  return dayOverrideOf(e, date)?.off === true;
}

/** 실제로 작업하는 날짜만 (휴무로 지정한 날은 뺀다) */
export function workingDatesOf(e: WorkforceEntry): string[] {
  return datesOf(e).filter((d) => !isOffDay(e, d));
}

/** 따로 지정한 날이 하나라도 있는지 — 목록 배지에 쓴다 */
export function hasOverrides(e: WorkforceEntry): boolean {
  return Object.keys(e.overrides ?? {}).length > 0;
}

/** 휴무로 지정한 날 수 */
export function offDayCount(e: WorkforceEntry): number {
  return datesOf(e).filter((d) => isOffDay(e, d)).length;
}

/** 지정한 내용이 하나라도 들어 있는지 — 빈 껍데기는 저장하지 않는다 */
export function isMeaningfulOverride(o: DayOverride | undefined): boolean {
  if (!o) return false;
  if (o.off) return true;
  if ((o.staff ?? '').trim() || (o.workHours ?? '').trim()) return true;
  if ((o.work ?? '').trim() || (o.equipment ?? '').trim()) return true;
  return Array.isArray(o.laborRows);
}

/**
 * 그 날짜 기준으로 실제 적용되는 기록.
 * 기간 중 따로 지정한 날은 그 값으로 바꿔 돌려주고, 아니면 원본 그대로다.
 * (달력·현장보드·인원 집계는 모두 이 결과를 기준으로 센다)
 */
export function entryOnDate(e: WorkforceEntry, date: string): WorkforceEntry {
  const o = dayOverrideOf(e, date);
  if (!o) return e;
  return {
    ...e,
    staff: o.staff ?? e.staff,
    workHours: o.workHours ?? e.workHours,
    work: o.work ?? e.work,
    equipment: o.equipment ?? e.equipment,
    ...(o.laborRows ? { laborRows: o.laborRows, laborCount: undefined, laborNames: undefined } : {}),
  };
}
