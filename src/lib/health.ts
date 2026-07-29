/** 건강검진(일반·특수) 데이터 — 공무관리 메뉴와 메인 [공무관리 현황] 패널이 공유한다. */

export interface HealthCheck {
  id: string;
  kind: 'general' | 'special'; // 일반검진 / 특수검진
  group: '직원' | '인력';
  name: string; // 성명
  birth?: string; // 생년월일
  checkDate: string; // 검진일자
  renewDate: string; // 갱신일자 — 검진일 + 1년 (수정 가능)
  certFile?: string; // 이수증(결과서) 파일 URL
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
  return rows.map(([name, birth, checkDate]) => ({
    id: `HC-general-seed-${name}`,
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
