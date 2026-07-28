/**
 * 공무 연간계획 — 시기별 해야 할 일 (사내 공무 연간계획 기준).
 * 메인 [업무관리] 패널과 [공무관리 › 공무연간계획] 화면이 공유한다.
 * 완료 체크는 연·월 단위로 저장되어 매월/매년 자동으로 새로 시작된다.
 */

export type PlanPeriod = '년초' | '년2회' | '연말' | '혹서기·혹한기' | '월초' | '월말' | '수시';

export interface AnnualTask {
  id: string; // 고정 ID (완료 상태 저장 키)
  period: PlanPeriod;
  title: string;
  /** 지정 월 (월초·월말·수시는 없음 = 매월/상시) */
  months?: number[];
  note?: string;
}

/** 완료 기록 — 연·월별 저장 */
export interface PlanCheck {
  id: string;
  year: number;
  month: number;
  taskId: string;
  done: boolean;
  doneAt?: string;
  updatedAt: string;
}

export const ANNUAL_PLAN_KEY = 'sj-annual-plan:v1';

/** 시기 구분 표기 — 배지 색과 처리 기한 안내 */
export const PERIOD_META: Record<PlanPeriod, { badge: string; hint: string }> = {
  년초: { badge: 'bg-sky-50 text-sky-700', hint: '1월 중' },
  년2회: { badge: 'bg-orange-50 text-orange-700', hint: '1월·7월' },
  연말: { badge: 'bg-red-50 text-red-700', hint: '12월 중' },
  '혹서기·혹한기': { badge: 'bg-amber-50 text-amber-700', hint: '6월·12월 최초교육' },
  월초: { badge: 'bg-emerald-50 text-emerald-900', hint: '매월 1~10일' },
  월말: { badge: 'bg-slate-100 text-slate-600', hint: '매월 말일 10일 전~' },
  수시: { badge: 'bg-slate-100 text-slate-600', hint: '발생 시 상시' },
};

/** ㈜신정개발 공무 연간계획 */
export const ANNUAL_TASKS: AnnualTask[] = [
  // 년초
  { id: 'y-risk-regular', period: '년초', months: [1], title: '정기 위험성평가' },
  { id: 'y-risk-plan', period: '년초', months: [1], title: '위험성평가 실시계획' },
  { id: 'y-legal-edu', period: '년초', months: [1], title: '기타 법정교육' },
  { id: 'y-edu-plan', period: '년초', months: [1], title: '연간 안전교육 계획' },

  // 년 2회 (1월, 7월)
  { id: 'h-emergency', period: '년2회', months: [1, 7], title: '비상시 계획 및 훈련' },
  { id: 'h-supervisor-eval', period: '년2회', months: [1, 7], title: '관리감독자 평가' },
  { id: 'h-compliance', period: '년2회', months: [1, 7], title: '법규 준수평가' },

  // 연말
  { id: 'e-mgmt-review', period: '연말', months: [12], title: '경영자 검토 보고서' },
  { id: 'e-nearmiss-result', period: '연말', months: [12], title: '아차사고 재발방지결과' },

  // 혹서기·혹한기 최초교육
  { id: 's-heat-edu', period: '혹서기·혹한기', months: [6], title: '혹서기 최초교육' },
  { id: 's-cold-edu', period: '혹서기·혹한기', months: [12], title: '혹한기 최초교육' },

  // 월초 (1~10일) — 매월
  { id: 'm1-hq-cost', period: '월초', title: '본사 안전관리비' },
  { id: 'm1-site-cost', period: '월초', title: '공사·단가 안전관리비' },
  { id: 'm1-extinguisher', period: '월초', title: '소화기 관리' },
  { id: 'm1-followup-log', period: '월초', title: '유소견자 상담일지' },
  { id: 'm1-o2-ledger', period: '월초', title: '산소측정기 대장 최신화' },
  { id: 'm1-special-chem', period: '월초', title: '특별관리물질 취급일지' },

  // 월말 (10일 전~) — 매월
  { id: 'm2-nearmiss', period: '월말', title: '아차사고' },
  { id: 'm2-regular-edu', period: '월말', title: '정기안전교육' },
  { id: 'm2-special-edu', period: '월말', title: '특별안전교육' },
  { id: 'm2-meeting', period: '월말', title: '월간 안전회의록' },

  // 수시
  { id: 'a-plan-doc', period: '수시', title: '안전보건관리계획서' },
  { id: 'a-risk', period: '수시', title: '위험성 평가' },
  { id: 'a-access', period: '수시', title: '출입 신청' },
  { id: 'a-permit', period: '수시', title: '작업 허가서 등록' },
  { id: 'a-vehicle', period: '수시', title: '상시차량 갱신 확인' },
];

/** 매월 반복 업무 (월초·월말) */
export const MONTHLY_TASKS = ANNUAL_TASKS.filter((t) => t.period === '월초' || t.period === '월말');
/** 상시 업무 */
export const ANYTIME_TASKS = ANNUAL_TASKS.filter((t) => t.period === '수시');

/** 해당 월의 연간(특정 시기) 업무 */
export function specialTasksOf(month: number): AnnualTask[] {
  return ANNUAL_TASKS.filter((t) => t.months?.includes(month));
}

/** 해당 월에 처리해야 할 전체 업무 (연간 특정 시기 + 매월 반복) */
export function tasksOfMonth(month: number): AnnualTask[] {
  return [...specialTasksOf(month), ...MONTHLY_TASKS];
}

/** 완료 상태 키 — 연·월 단위 */
export function checkId(year: number, month: number, taskId: string): string {
  return `AP-${year}-${String(month).padStart(2, '0')}-${taskId}`;
}

/** 오늘이 월초(1~10일) / 월말(말일 10일 전~) 중 어느 구간인지 */
export function currentPhase(d: Date): '월초' | '월말' | '중순' {
  const day = d.getDate();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (day <= 10) return '월초';
  if (day > last - 10) return '월말';
  return '중순';
}

export const MONTH_LABEL = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
