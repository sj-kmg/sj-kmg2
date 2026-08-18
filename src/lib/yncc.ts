/** 교육 입력 시트(유해화학물질·YNCC출입) 공용 타입 — 사이드바 메뉴와 메인 안전교육 현황이 공유한다. */

export interface EduSheetWorker {
  id: string;
  group: '직원' | '인력';
  name: string; // 작업자명
  birth: string; // 생년월일 YYYY-MM-DD
  offlineDate?: string; // 집체교육 이수일자
  onlineDate?: string; // 온라인교육 이수일자
  /** 구버전 YNCC 필드(최근교육일) — offlineDate로 이관 표시 */
  lastEdu?: string;
  /** 교육유효종료일 (YNCC 전용) — 30일 전부터 메인 표시 */
  eduExpire?: string;
  /** 수료증 파일 경로 — public/certs 정적 경로 또는 업로드된 Blob URL */
  certFile?: string;
  /** 직책 (정적 명부에서 이관된 값) */
  position?: string;
  updatedAt: string;
}

/** 하위 호환 별칭 */
export type YnccWorker = EduSheetWorker;

export interface YnccVehicle {
  id: string;
  plate: string; // 차량번호 (고정)
  regDate: string; // 등록일자 (수시 갱신)
  registrant: string; // 차량 등록자 (수시 갱신)
  regCertFile?: string; // 자동차등록증 파일
  insuranceCertFile?: string; // 보험증권 파일
  updatedAt: string;
}

export const YNCC_WORKERS_KEY = 'sj-yncc-workers:v1';
export const YNCC_VEHICLES_KEY = 'sj-yncc-vehicles:v1';
export const CHEM_WORKERS_KEY = 'sj-chem-workers:v1';
export const SUPERVISOR_KEY = 'sj-supervisor:v1';

/** 교육유효종료일·갱신 알림 시작 (D-30) */
export const YNCC_NOTICE_DAYS = 30;
