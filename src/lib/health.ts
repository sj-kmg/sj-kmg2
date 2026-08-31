/** 건강검진(일반·특수) 데이터 — 공무관리 메뉴와 메인 [공무관리 현황] 패널이 공유한다. */
import { applyHazardCheck, type HazardWatch } from './hazardWatch';
import { seedId } from './ids';

export interface HealthCheck {
  id: string;
  kind: 'general' | 'special'; // 일반검진 / 특수검진
  group: '직원' | '인력';
  name: string; // 성명
  birth?: string; // 생년월일
  checkDate: string; // 검진일자
  renewDate: string; // 갱신일자 — 검진일 + 1년 (수정 가능)
  certFile?: string; // 이수증(결과서) 파일 URL
  /** 재검 확인서 — 벤젠처럼 주기가 짧아 중간에 다시 받은 검진의 확인서 */
  recheckCert?: string;
  /**
   * 갱신주기를 따로 관리하는 유해인자 — 물질마다 마지막 검진일을 들고 있다.
   * (벤젠은 6개월, 톨루엔·크실렌은 1년 주기라 검진일자 하나로는 부족하다)
   */
  hazards?: HazardWatch[];
  note?: string;
  updatedAt: string;
}

export const HEALTH_KEY = 'sj-health:v1';

/** 갱신일 알림 시작 (D-60) */
export const HEALTH_NOTICE_DAYS = 60;

/** 검진일 + 1년 (일반·특수검진 공통 주기) */
export function healthRenewDate(checkDate: string): string {
  const d = new Date(`${checkDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const HEALTH_LABEL: Record<HealthCheck['kind'], string> = {
  general: '일반검진',
  special: '특수검진',
};

/**
 * 2026년 LG출입자검진(일반검진) — 직원 12명. 검진 결과지에서 확인한 검사일자 기준.
 * 저장 이력이 없을 때 초기 데이터로 표시된다.
 */
export function healthGeneralSeed(): HealthCheck[] {
  const rows: [string, string, string][] = [
    // 성명, 생년월일, 검사일자
    ['김중길', '1978-10-15', '2026-01-02'],
    ['서태옥', '1979-07-31', '2026-01-02'],
    ['김영길', '1972-08-15', '2026-01-03'],
    ['김종호', '1982-01-02', '2026-01-08'],
    ['오남택', '1965-07-26', '2026-01-09'],
    ['김민규', '1994-01-06', '2026-01-12'],
    ['조준호', '1977-12-13', '2026-01-14'],
    ['김진복', '1981-08-08', '2026-01-16'],
    ['김민철', '1963-01-15', '2026-01-17'],
    ['김선태', '1966-06-14', '2026-01-17'],
    ['박범동', '1968-12-20', '2026-01-24'],
    ['권현철', '1975-08-14', '2026-01-28'],
    ['송석기', '1965-01-19', '2026-03-06'],
    ['문춘종', '1980-11-12', '2026-07-01'],
    ['이철웅', '1995-03-27', '2026-07-01'],
  ];
  return rows.map(([name, birth, checkDate], i) => ({
    id: seedId('HC-general-seed', i, name),
    kind: 'general' as const,
    group: '직원' as const,
    name,
    birth,
    checkDate,
    renewDate: healthRenewDate(checkDate),
    certFile: `/certs/health-general/${name}_일반검진_2026.pdf`,
    note: 'LG출입자검진',
    updatedAt: '',
  }));
}

/**
 * 직원 특수검진 초기 데이터 — 여천전남병원 확인서 원본 반영.
 *
 * 상반기 확인서는 유해인자에 벤젠·톨루엔·크실렌이 모두 적혀 있어 세 물질을 그 날짜로 잡고,
 * 하반기 확인서는 벤젠만 적혀 있어 벤젠 날짜만 갱신한다.
 * (이철웅은 7월 배치전건강검진이 유일한 확인서이고 유해인자가 전 항목이라 세 물질 모두 그 날짜다)
 */
export function healthSpecialSeed(): HealthCheck[] {
  const rows: {
    name: string;
    birth: string;
    /** 연간(또는 배치전) 검진일 — 세 물질 기준 */
    checkDate: string;
    /** 벤젠 재검일 — 하반기 확인서가 있는 사람만 */
    benzene?: string;
    /** 확인서가 하반기 것 하나뿐이면 true (상반기 파일이 없다) */
    halfOnly?: boolean;
  }[] = [
    { name: '김중길', birth: '1978-10-15', checkDate: '2026-01-02' },
    { name: '서태옥', birth: '1979-07-31', checkDate: '2026-01-02', benzene: '2026-07-06' },
    { name: '김영길', birth: '1972-08-15', checkDate: '2026-01-03', benzene: '2026-07-02' },
    { name: '김종호', birth: '1982-01-02', checkDate: '2026-01-08', benzene: '2026-07-07' },
    { name: '오남택', birth: '1965-07-26', checkDate: '2026-01-09' },
    { name: '김민규', birth: '1994-01-06', checkDate: '2026-01-12', benzene: '2026-07-06' },
    { name: '조준호', birth: '1977-12-13', checkDate: '2026-01-14', benzene: '2026-07-06' },
    { name: '김진복', birth: '1981-08-08', checkDate: '2026-01-16' },
    { name: '김선태', birth: '1966-06-14', checkDate: '2026-01-17' },
    { name: '권현철', birth: '1975-08-14', checkDate: '2026-01-28' },
    { name: '이철웅', birth: '1995-03-27', checkDate: '2026-07-01', halfOnly: true },
  ];
  return rows.map(({ name, birth, checkDate, benzene, halfOnly }, i) => {
    const withAll = applyHazardCheck([], ['벤젠', '톨루엔', '크실렌'], checkDate);
    return {
      id: seedId('HC-special-seed', i, name),
      kind: 'special' as const,
      group: '직원' as const,
      name,
      birth,
      checkDate,
      renewDate: healthRenewDate(checkDate),
      certFile: halfOnly
        ? `/certs/health-special/${name}_특수검진_하반기_2026.pdf`
        : `/certs/health-special/${name}_특수검진_2026.pdf`,
      recheckCert: benzene ? `/certs/health-special/${name}_특수검진_하반기_2026.pdf` : undefined,
      // 벤젠 재검이 있으면 벤젠 날짜만 그 날짜로 바뀐다
      hazards: benzene ? applyHazardCheck(withAll, ['벤젠'], benzene) : withAll,
      updatedAt: '',
    };
  });
}
