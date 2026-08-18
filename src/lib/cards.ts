/** 출입신청 — 상시카드·상시차량 데이터. 공무관리 메뉴와 메인 [공무관리 현황] 패널이 공유한다. */
import { seedId } from './ids';

export interface AccessCard {
  id: string;
  name: string; // 성명
  applyType: '신규' | '연장'; // 신청구분
  issueDate: string; // 출입시작일 YYYY-MM-DD
  endDate: string; // 출입종료일 — 시작일 + 1년 - 1일 자동 계산 (수정 가능)
  loginId: string; // 아이디
  password: string; // 비밀번호 (화면에서는 숨김, 버튼으로 표시)
  note?: string; // 비고
  updatedAt: string;
}

/** 상시차량 */
export interface PassVehicle {
  id: string;
  kind: '일반차량' | '특수차량'; // 차량구분
  plate: string; // 차량번호
  driver: string; // 대표 운전자
  startDate: string; // 출입시작일
  endDate: string; // 출입종료일 (수정 가능)
  plant?: string; // 단위공장
  note?: string; // 비고
  updatedAt: string;
}

export const CARDS_KEY = 'sj-cards:v1';
export const PASS_VEHICLES_KEY = 'sj-pass-vehicles:v1';

/** 종료일자 알림 시작 — 상시카드 D-100 · 상시차량 D-60 */
export const CARD_NOTICE_DAYS = 100;
export const VEHICLE_NOTICE_DAYS = 60;

/** 발급일 + 1년 - 1일 (예: 2025-09-24 발급 → 2026-09-23 종료) */
export function cardEndDate(issueDate: string): string {
  const d = new Date(`${issueDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const PLANT = '화치, 용성1/2, 본관';

/** 상시차량 신청현황 (2026-07-20 기준) — 저장 이력이 없을 때 초기 표시 */
export function passVehicleSeed(): PassVehicle[] {
  const rows: [PassVehicle['kind'], string, string, string, string][] = [
    ['일반차량', '802소 3632', '김지우', '2026-03-14', '2026-09-09'],
    ['일반차량', '93너 7439', '조준호', '2026-03-14', '2026-09-09'],
    ['일반차량', '86저 0128', '김영길', '2026-03-14', '2026-09-09'],
    ['일반차량', '93가 9652', '김진영', '2026-03-14', '2026-09-09'],
    ['일반차량', '816도 5194', '김종호', '2026-06-01', '2026-11-27'],
    ['일반차량', '802소 3625', '김길수', '2026-06-19', '2026-12-15'],
    ['일반차량', '802소 3635', '권해훈', '2026-02-23', '2026-08-21'],
    ['특수차량', '96머 0525', '오남택', '2026-03-14', '2026-09-09'],
    ['특수차량', '83로 6699', '김영길', '2026-05-14', '2026-11-09'],
    ['특수차량', '95러 9793', '김영길', '2026-07-21', '2027-01-16'],
    ['특수차량', '95우 6525', '서태옥', '2026-07-21', '2027-01-16'],
    ['특수차량', '91오 8390', '김진복', '2026-07-21', '2027-01-16'],
  ];
  return rows.map(([kind, plate, driver, startDate, endDate], i) => ({
    id: seedId('PV-seed', i, plate),
    kind,
    plate,
    driver,
    startDate,
    endDate,
    plant: PLANT,
    note: '',
    updatedAt: '',
  }));
}

/** 상시카드 신청현황 (2026-07-20 기준) — 저장 이력이 없을 때 초기 표시 */
export function accessCardSeed(): AccessCard[] {
  const rows: [string, AccessCard['applyType'], string, string, string, string, string][] = [
    ['김영길', '신규', '2025-09-24', '2026-09-23', '', '', ''],
    ['김민철', '신규', '2025-10-20', '2026-10-19', '', '', ''],
    ['서태옥', '연장', '2025-11-17', '2026-11-16', 'sjsto', 'kms5537112@', ''],
    ['김중길', '신규', '2025-11-18', '2026-11-17', 'sjkjk', 'kms5537112@', ''],
    ['조준호', '신규', '2025-11-28', '2026-11-26', 'sjcjh', 'kms5537112@', ''],
    ['김길수', '신규', '2025-11-28', '2026-11-26', 'sjkks1', 'kms5537112@', ''],
    ['김민규', '연장', '2025-12-10', '2026-12-09', 'sjkmg', 'kms5537112@#', ''],
    ['김진복', '신규', '2025-12-11', '2026-12-10', 'sjkjb', 'kms5537112@', ''],
    ['박범동', '신규', '2026-01-23', '2027-01-21', 'sjpbd', 'kms5537112@', ''],
    ['김지우', '신규', '2026-02-03', '2027-02-02', 'sjkjw', 'kms5537112!', ''],
    ['오남택', '신규', '2026-06-05', '2027-06-04', 'sjont', 'kms5537112@', ''],
    ['김종호', '신규', '2026-06-11', '2027-06-10', 'sjkjh02', 'love5628^^', ''],
    ['지상민', '신규', '2026-06-12', '2027-06-11', 'leashon1394', 'jsm9223@', ''],
    ['송석기', '신규', '', '', '', '', '발급완료'],
    ['김진복', '신규', '', '', '', '', ''],
  ];
  return rows.map(([name, applyType, issueDate, endDate, loginId, password, note], i) => ({
    id: seedId('AC-seed', i, name),
    name,
    applyType,
    issueDate,
    endDate,
    loginId,
    password,
    note,
    updatedAt: '',
  }));
}
