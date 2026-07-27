/** YNCC출입 관리 — 작업자(교육 유효기간)·작업차량 데이터 타입. 사이드바 YNCC출입 메뉴와 메인 안전교육 현황이 공유한다. */

export interface YnccWorker {
  id: string;
  group: '직원' | '인력';
  name: string; // 작업자명
  birth: string; // 생년월일 YYYY-MM-DD
  lastEdu: string; // 최근교육일
  eduExpire: string; // 교육유효종료일 — 30일 전부터 메인 표시
  updatedAt: string;
}

export interface YnccVehicle {
  id: string;
  plate: string; // 차량번호 (고정)
  regDate: string; // 등록일자 (수시 갱신)
  registrant: string; // 차량 등록자 (수시 갱신)
  updatedAt: string;
}

export const YNCC_WORKERS_KEY = 'sj-yncc-workers:v1';
export const YNCC_VEHICLES_KEY = 'sj-yncc-vehicles:v1';

/** 교육유효종료일 알림 시작 (D-30) */
export const YNCC_NOTICE_DAYS = 30;
