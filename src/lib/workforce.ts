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

export interface WorkforceEntry {
  id: string;
  site: string; // 현장명
  date: string; // 작업일시(YYYY-MM-DD)
  manager: string; // 현장소장
  staff: string; // 직원
  laborRows?: LaborRow[]; // 인력 목록
  laborNames?: string; // (구버전 기록 호환)
  laborCount?: string; // (구버전 기록 호환)
  workHours: string; // 작업시간(현장 전체)
  work: string; // 작업내용
  equipment: string; // 장비현황
  createdAt: string;
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
