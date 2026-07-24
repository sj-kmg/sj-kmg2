/**
 * 안전교육 이수 현황 데이터 — 사이드바 [안전교육] 메뉴와 메인 [안전교육 현황] 패널이 공유한다.
 * 수료증 PDF에서 추출한 실데이터이며, 원본 PDF는 public/certs/ 아래에 보관되어 클릭 시 열람된다.
 */

export interface EduRecord {
  name: string; // 성명
  birth: string; // 생년월일 YYYY-MM-DD
  completedAt: string; // 교육 이수일자(수료날짜) YYYY-MM-DD
  certNo: string; // 수료증 번호
  certFile: string; // public 기준 수료증 경로
  hours?: string; // 이수시간
  method?: string; // 이수방법
}

export interface EduCourse {
  key: 'supervisor' | 'chemical' | 'yncc';
  label: string; // 과정명 (사이드바 메뉴와 동일)
  courseName: string; // 수료증 상 과정명
  renewalMonths: number; // 갱신 주기(개월) — 이수일로부터 이 기간 뒤 갱신 도래
  legalBasis: string;
  records: EduRecord[];
}

/** 갱신 알림 단계(일) — 메인 패널에는 첫 단계(D-90) 이내 대상자만 표시 */
export const NOTICE_STEPS = [90, 60, 30, 15] as const;

const CERT_DIR = '/certs/supervisor';

/** 관리감독자 교육 (건설업) — 2026-02-02 발급 수료증 9매 기준 */
const SUPERVISOR_RECORDS: EduRecord[] = [
  { name: '권현철', birth: '1975-08-14', completedAt: '2026-01-15', certNo: '2026-0115-649973', certFile: `${CERT_DIR}/권현철_수료증_20260202.pdf` },
  { name: '김영길', birth: '1972-08-15', completedAt: '2026-01-08', certNo: '2026-0108-649969', certFile: `${CERT_DIR}/김영길_수료증_20260202.pdf` },
  { name: '김우재', birth: '1992-01-10', completedAt: '2026-01-14', certNo: '2026-0114-649974', certFile: `${CERT_DIR}/김우재_수료증_20260202.pdf` },
  { name: '김종호', birth: '1982-01-02', completedAt: '2026-01-09', certNo: '2026-0109-649975', certFile: `${CERT_DIR}/김종호_수료증_20260202.pdf` },
  { name: '김중길', birth: '1978-10-15', completedAt: '2026-01-14', certNo: '2026-0114-649971', certFile: `${CERT_DIR}/김중길_수료증_20260202.pdf` },
  { name: '김진복', birth: '1981-08-08', completedAt: '2026-01-15', certNo: '2026-0115-649972', certFile: `${CERT_DIR}/김진복_수료증_20260202.pdf` },
  { name: '서태옥', birth: '1979-07-31', completedAt: '2026-01-14', certNo: '2026-0114-649970', certFile: `${CERT_DIR}/서태옥_수료증_20260202.pdf` },
  { name: '오남택', birth: '1965-07-26', completedAt: '2026-01-07', certNo: '2026-0107-649968', certFile: `${CERT_DIR}/오남택_수료증_20260202.pdf` },
  { name: '조준호', birth: '1977-12-13', completedAt: '2026-01-14', certNo: '2026-0114-649967', certFile: `${CERT_DIR}/조준호_수료증_20260202.pdf` },
].map((r) => ({ ...r, hours: '16시간', method: '비대면(온라인)교육' }));

export const EDU_COURSES: EduCourse[] = [
  {
    key: 'supervisor',
    label: '관리감독자',
    courseName: '관리감독자 건설업',
    renewalMonths: 12,
    legalBasis: '산업안전보건법 제29조 · 같은 법 시행규칙 제26조',
    records: SUPERVISOR_RECORDS,
  },
  { key: 'chemical', label: '유해화학물질', courseName: '유해화학물질 안전교육', renewalMonths: 12, legalBasis: '화학물질관리법 제33조', records: [] },
  { key: 'yncc', label: 'YNCC출입', courseName: 'YNCC 출입 안전교육', renewalMonths: 12, legalBasis: '여수국가산단 출입 규정', records: [] },
];

/** 이수일 + 갱신주기 = 갱신 도래일 (YYYY-MM-DD) */
export function renewalDate(completedAt: string, renewalMonths: number): string {
  const d = new Date(`${completedAt}T00:00:00`);
  d.setMonth(d.getMonth() + renewalMonths);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 오늘부터 갱신 도래일까지 남은 일수 (지났으면 음수) */
export function daysUntil(dateStr: string, today = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

export type NoticeLevel = 'overdue' | 'd15' | 'd30' | 'd60' | 'd90';

/** D-day → 알림 단계 (알림 구간 밖이면 null) */
export function noticeLevel(days: number): NoticeLevel | null {
  if (days < 0) return 'overdue';
  if (days <= 15) return 'd15';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= NOTICE_STEPS[0]) return 'd90';
  return null;
}

export const NOTICE_STYLE: Record<NoticeLevel, { badge: string; label: string }> = {
  overdue: { badge: 'bg-red-600 text-white', label: '기한 초과' },
  d15: { badge: 'bg-red-50 text-red-700', label: 'D-15 이내' },
  d30: { badge: 'bg-orange-50 text-orange-700', label: 'D-30 이내' },
  d60: { badge: 'bg-amber-50 text-amber-700', label: 'D-60 이내' },
  d90: { badge: 'bg-sky-50 text-sky-700', label: 'D-90 이내' },
};

export interface RenewalItem {
  course: EduCourse;
  record: EduRecord;
  renewAt: string;
  days: number;
  level: NoticeLevel | null;
}

/** 전 과정 이수자별 갱신 정보 — 갱신일 임박 순 정렬 */
export function allRenewals(today = new Date()): RenewalItem[] {
  return EDU_COURSES.flatMap((course) =>
    course.records.map((record) => {
      const renewAt = renewalDate(record.completedAt, course.renewalMonths);
      const days = daysUntil(renewAt, today);
      return { course, record, renewAt, days, level: noticeLevel(days) };
    }),
  ).sort((a, b) => a.days - b.days);
}

/** 메인 패널 표시 대상 — 갱신기간(D-90) 도래자 + 기한 초과자만 */
export function upcomingRenewals(today = new Date()): RenewalItem[] {
  return allRenewals(today).filter((r) => r.level !== null);
}
