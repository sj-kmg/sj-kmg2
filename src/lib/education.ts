/**
 * 안전교육 이수 현황 데이터 — 사이드바 [안전교육] 메뉴와 메인 [안전교육 현황] 패널이 공유한다.
 * 수료증 PDF·이수 현황표에서 추출한 실데이터이며, 원본 PDF는 public/certs/ 아래에 보관되어 클릭 시 열람된다.
 */

export interface EduPass {
  certNo: string; // 이수(수료)번호
  date: string; // 수료일 YYYY-MM-DD
}

export interface EduRecord {
  name: string; // 성명
  birth: string; // 생년월일 YYYY-MM-DD
  position?: string; // 직책
  completedAt: string; // 교육 이수일자 — 갱신 기산 기준 (이중 이수 과정은 늦은 수료일)
  certNo?: string; // 수료증 번호 (단일 과정)
  certFile?: string; // public 기준 수료증 경로 — 없으면 추후 추가 예정
  hours?: string; // 이수시간
  method?: string; // 이수방법
  offline?: EduPass; // 집체 교육 (유해화학물질 안전교육원)
  online?: EduPass; // 온라인 교육 (화학물질안전원 교육시스템)
}

/** 갱신 규칙 — months: 이수일+N개월 / yearJan: 이수년도+N년의 1월 1일 (연 단위 교육) */
export type RenewalRule = { kind: 'months'; months: number } | { kind: 'yearJan'; afterYears: number };

export interface EduCourse {
  key: 'supervisor' | 'chemical' | 'yncc';
  label: string; // 과정명 (사이드바 메뉴와 동일)
  courseName: string; // 수료증 상 과정명
  renewal: RenewalRule;
  noticeDays: number; // 갱신 도래 D-N일부터 메인 패널에 표시
  renewalNote: string; // 갱신 규칙 설명문
  legalBasis: string;
  records: EduRecord[];
}

/** 갱신 알림 단계(일) — 배지 색 구분 기준 */
export const NOTICE_STEPS = [90, 60, 30, 15] as const;

/** 관리감독자 교육 (건설업) — 2026-02-02 발급 수료증 9매 기준 */
const SUPERVISOR_DIR = '/certs/supervisor';
const SUPERVISOR_RECORDS: EduRecord[] = [
  { name: '권현철', birth: '1975-08-14', completedAt: '2026-01-15', certNo: '2026-0115-649973', certFile: `${SUPERVISOR_DIR}/권현철_수료증_20260202.pdf` },
  { name: '김영길', birth: '1972-08-15', completedAt: '2026-01-08', certNo: '2026-0108-649969', certFile: `${SUPERVISOR_DIR}/김영길_수료증_20260202.pdf` },
  { name: '김우재', birth: '1992-01-10', completedAt: '2026-01-14', certNo: '2026-0114-649974', certFile: `${SUPERVISOR_DIR}/김우재_수료증_20260202.pdf` },
  { name: '김종호', birth: '1982-01-02', completedAt: '2026-01-09', certNo: '2026-0109-649975', certFile: `${SUPERVISOR_DIR}/김종호_수료증_20260202.pdf` },
  { name: '김중길', birth: '1978-10-15', completedAt: '2026-01-14', certNo: '2026-0114-649971', certFile: `${SUPERVISOR_DIR}/김중길_수료증_20260202.pdf` },
  { name: '김진복', birth: '1981-08-08', completedAt: '2026-01-15', certNo: '2026-0115-649972', certFile: `${SUPERVISOR_DIR}/김진복_수료증_20260202.pdf` },
  { name: '서태옥', birth: '1979-07-31', completedAt: '2026-01-14', certNo: '2026-0114-649970', certFile: `${SUPERVISOR_DIR}/서태옥_수료증_20260202.pdf` },
  { name: '오남택', birth: '1965-07-26', completedAt: '2026-01-07', certNo: '2026-0107-649968', certFile: `${SUPERVISOR_DIR}/오남택_수료증_20260202.pdf` },
  { name: '조준호', birth: '1977-12-13', completedAt: '2026-01-14', certNo: '2026-0114-649967', certFile: `${SUPERVISOR_DIR}/조준호_수료증_20260202.pdf` },
].map((r) => ({ ...r, hours: '16시간', method: '비대면(온라인)교육' }));

/**
 * 유해화학물질 안전교육 (취급담당자) — 집체(유해화학물질 안전교육원) + 온라인(화학물질안전원) 이중 이수.
 * 이수 현황표(2026-07) + 수료증 PDF 13매 기준. certFile 없는 인원은 수료증 추후 추가 예정.
 * 오남택 PDF는 2022년 이수증이 들어 있어 데이터는 현황표(2024년) 기준으로 기재함.
 */
const CHEMICAL_DIR = '/certs/chemical';
const CHEMICAL_RECORDS: EduRecord[] = [
  { name: '김종호', position: '과장', birth: '1982-01-02', completedAt: '2024-01-09', offline: { certNo: '제24-KCMA-04F-002158호', date: '2024-01-09' }, online: { certNo: '제E2024-F-A01178호', date: '2024-01-04' }, certFile: `${CHEMICAL_DIR}/김종호_유해화학물질_2024.pdf` },
  { name: '서태옥', position: '차장', birth: '1979-07-31', completedAt: '2024-02-02', offline: { certNo: '제24-KCMA-04F-004528호', date: '2024-02-02' }, online: { certNo: '제E2024-F-A03915호', date: '2024-01-10' }, certFile: `${CHEMICAL_DIR}/서태옥_유해화학물질_2024.pdf` },
  { name: '김영길', position: '부장', birth: '1972-08-15', completedAt: '2024-02-05', offline: { certNo: '제24-KCMA-04F-004534호', date: '2024-02-05' }, online: { certNo: '제E2024-F-A03520호', date: '2024-01-09' }, certFile: `${CHEMICAL_DIR}/김영길_유해화학물질_2024.pdf` },
  { name: '김중길', position: '과장', birth: '1978-10-15', completedAt: '2024-02-05', offline: { certNo: '제24-KCMA-04F-004535호', date: '2024-02-05' }, online: { certNo: '제E2024-F-A04098호', date: '2024-01-10' }, certFile: `${CHEMICAL_DIR}/김중길_유해화학물질_2024.pdf` },
  { name: '조준호', position: '이사', birth: '1977-12-13', completedAt: '2024-02-19', offline: { certNo: '제24-KCMA-04F-004510호', date: '2024-02-19' }, online: { certNo: '제E2024-F-A07204호', date: '2024-01-16' }, certFile: `${CHEMICAL_DIR}/조준호_유해화학물질_2024.pdf` },
  { name: '오남택', position: '부장', birth: '1965-07-26', completedAt: '2024-03-13', offline: { certNo: '제24-KCMA-04F-004530호', date: '2024-03-13' }, online: { certNo: '제E2024-F-A10151호', date: '2024-01-22' }, certFile: `${CHEMICAL_DIR}/오남택_유해화학물질_2024.pdf` },
  { name: '지상민', position: '이사', birth: '1959-01-02', completedAt: '2024-06-10', offline: { certNo: '제24-KCMA-04F-079619호', date: '2024-05-24' }, online: { certNo: '제E2024-F-A70766호', date: '2024-06-10' } },
  { name: '김선태', position: '사원', birth: '1966-06-14', completedAt: '2024-08-19', offline: { certNo: '제24-KCMA-04F-120234호', date: '2024-08-19' }, online: { certNo: '제E2024-F-A89747호', date: '2024-08-07' }, certFile: `${CHEMICAL_DIR}/김선태_유해화학물질_2024.pdf` },
  { name: '김민규', position: '대리', birth: '1994-01-06', completedAt: '2024-08-23', offline: { certNo: '제24-KCMA-04F-124172호', date: '2024-08-23' }, online: { certNo: '제E2024-F-A93887호', date: '2024-08-21' }, certFile: `${CHEMICAL_DIR}/김민규_유해화학물질_2024.pdf` },
  { name: '김지우', position: '사원', birth: '1996-02-27', completedAt: '2025-01-24', offline: { certNo: '제25-KCMA-04F-014424호', date: '2025-01-24' }, online: { certNo: '제E2025-F-A11079호', date: '2025-01-21' }, certFile: `${CHEMICAL_DIR}/김지우_유해화학물질_2025.pdf` },
  { name: '김우재', position: '과장', birth: '1992-01-10', completedAt: '2026-01-12', offline: { certNo: '제26-KCMA-04F-001693호', date: '2026-01-12' }, online: { certNo: '제E2026-F-A01084호', date: '2026-01-05' }, certFile: `${CHEMICAL_DIR}/김우재_유해화학물질_2026.pdf` },
  { name: '김진복', position: '과장', birth: '1981-08-08', completedAt: '2026-01-12', offline: { certNo: '제26-KCMA-04F-001681호', date: '2026-01-12' }, online: { certNo: '제E2026-F-A01086호', date: '2026-01-05' }, certFile: `${CHEMICAL_DIR}/김진복_유해화학물질_2026.pdf` },
  { name: '김민철', position: '차장', birth: '1963-01-15', completedAt: '2026-01-13', offline: { certNo: '제26-KCMA-04F-001730호', date: '2026-01-13' }, online: { certNo: '제E2026-F-A02414호', date: '2026-01-07' }, certFile: `${CHEMICAL_DIR}/김민철_유해화학물질_2026.pdf` },
  { name: '박범동', position: '반장', birth: '1968-12-20', completedAt: '2026-01-13', offline: { certNo: '제26-KCMA-04F-001743호', date: '2026-01-13' }, online: { certNo: '제E2026-F-A05432호', date: '2026-01-12' }, certFile: `${CHEMICAL_DIR}/박범동_유해화학물질_2026.pdf` },
  { name: '권현철', position: '차장', birth: '1975-08-14', completedAt: '2026-01-14', offline: { certNo: '제26-KCMA-04F-002005호', date: '2026-01-14' }, online: { certNo: '제E2026-F-A04027호', date: '2026-01-09' }, certFile: `${CHEMICAL_DIR}/권현철_유해화학물질_2026.pdf` },
  { name: '송석기', position: '이사', birth: '1965-01-19', completedAt: '2024-09-02', offline: { certNo: '제24-KCMA-04F-130260호', date: '2024-09-02' }, online: { certNo: '제E2024-F-A89999호', date: '2024-08-08' } },
  { name: '문춘종', position: '사원', birth: '1980-11-12', completedAt: '2026-07-02', offline: { certNo: '제26-KCMA-04F-109700호', date: '2026-07-02' }, online: { certNo: '제E2026-F-A94282호', date: '2026-06-26' }, certFile: `${CHEMICAL_DIR}/문춘종_유해화학물질_2026.pdf` },
  { name: '이철웅', position: '사원', birth: '1995-03-27', completedAt: '2026-07-02', offline: { certNo: '제26-KCMA-04F-109732호', date: '2026-07-02' }, online: { certNo: '제E2026-F-A95882호', date: '2026-06-30' }, certFile: `${CHEMICAL_DIR}/이철웅_유해화학물질_2026.pdf` },
];

export const EDU_COURSES: EduCourse[] = [
  {
    key: 'supervisor',
    label: '관리감독자',
    courseName: '관리감독자 건설업',
    renewal: { kind: 'months', months: 12 },
    noticeDays: 90,
    renewalNote: '이수일로부터 12개월 후 갱신 도래 · D-90부터 메인 표시',
    legalBasis: '산업안전보건법 제29조 · 같은 법 시행규칙 제26조',
    records: SUPERVISOR_RECORDS,
  },
  {
    key: 'chemical',
    label: '유해화학물질',
    courseName: '유해화학물질 안전교육 (취급담당자)',
    // 이수년도 기준 2년 유효 → 예: 24년 이수 시 27년 1월에 갱신 교육 (1월 교육 기준)
    renewal: { kind: 'yearJan', afterYears: 3 },
    noticeDays: 30,
    renewalNote: '이수년도 기준 2년 유효, 예: 24년 이수 → 27년 1월 갱신 교육 · 갱신년도 1월 1일 기준 D-30부터 메인 표시',
    legalBasis: '화학물질관리법 제33조 · 같은 법 시행규칙 제37조',
    records: CHEMICAL_RECORDS,
  },
  {
    key: 'yncc',
    label: 'YNCC출입',
    courseName: 'YNCC 출입 안전교육',
    renewal: { kind: 'months', months: 12 },
    noticeDays: 30,
    renewalNote: '교육유효종료일 30일 전부터 메인 표시 — 명부는 [안전교육 > YNCC출입] 메뉴에서 관리',
    legalBasis: '여수국가산단 출입 규정',
    records: [], // YNCC 작업자는 YNCC출입 메뉴(동기화 저장)에서 관리한다
  },
];

/** 갱신 도래일 계산 (YYYY-MM-DD) */
export function renewalDateFor(course: EduCourse, record: EduRecord): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  if (course.renewal.kind === 'months') {
    const d = new Date(`${record.completedAt}T00:00:00`);
    d.setMonth(d.getMonth() + course.renewal.months);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  // yearJan: 이수년도 + afterYears 년의 1월 1일
  const year = Number(record.completedAt.slice(0, 4)) + course.renewal.afterYears;
  return `${year}-01-01`;
}

/** 오늘부터 갱신 도래일까지 남은 일수 (지났으면 음수) */
export function daysUntil(dateStr: string, today = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

export type NoticeLevel = 'overdue' | 'd15' | 'd30' | 'd60' | 'd90';

/** D-day → 알림 단계 — 과정별 표시 시작일(noticeDays) 밖이면 null */
export function noticeLevel(days: number, noticeDays: number = NOTICE_STEPS[0]): NoticeLevel | null {
  if (days > noticeDays) return null;
  if (days < 0) return 'overdue';
  if (days <= 15) return 'd15';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  return 'd90';
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
      const renewAt = renewalDateFor(course, record);
      const days = daysUntil(renewAt, today);
      return { course, record, renewAt, days, level: noticeLevel(days, course.noticeDays) };
    }),
  ).sort((a, b) => a.days - b.days);
}

/** 메인 패널 표시 대상 — 과정별 갱신기간 도래자 + 기한 초과자만 */
export function upcomingRenewals(today = new Date()): RenewalItem[] {
  return allRenewals(today).filter((r) => r.level !== null);
}

/** 유해화학물질 정적 명부 → 직원 시트 초기 데이터 (수료증 포함) */
export function chemicalSeedWorkers(): {
  id: string;
  group: '직원';
  name: string;
  birth: string;
  position?: string;
  offlineDate?: string;
  onlineDate?: string;
  certFile?: string;
  updatedAt: string;
}[] {
  const course = EDU_COURSES.find((c) => c.key === 'chemical');
  return (course?.records ?? []).map((r) => ({
    id: `CW-seed-${r.name}`,
    group: '직원' as const,
    name: r.name,
    birth: r.birth,
    position: r.position,
    offlineDate: r.offline?.date,
    onlineDate: r.online?.date,
    certFile: r.certFile,
    updatedAt: '',
  }));
}

/** 유해화학물질 시트 입력분: 집체·온라인 이수일 중 늦은 연도 + 3년의 1월 1일 = 갱신 도래일 (예: 24년 이수 → 27년 1월) */
export function chemicalRenewalFromDates(offline?: string, online?: string): string | null {
  const base = [offline, online].filter((d): d is string => !!d).sort().pop();
  if (!base || base.length < 4) return null;
  return `${Number(base.slice(0, 4)) + 3}-01-01`;
}
