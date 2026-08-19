/**
 * 공무관리 › 인력관리 — 인력(공영·개미·여수·여천·당근인력) 인원별 관리 현황.
 *
 * 특수검진·유해화학물질·YNCC출입·일반검진은 각각 별도 메뉴에서도 "인력" 그룹으로
 * 입력할 수 있는데, 여기서는 그 네 가지를 사람 한 명 기준으로 한데 모아 본다.
 * [기존 인력 데이터 불러오기]로 그 메뉴들에 이미 입력된 인력 항목을 이름 기준으로
 * 병합해 최초 1회 가져올 수 있다 (덮어쓰지 않고 채워져 있지 않은 값만 채운다).
 */
import { LABOR_CATEGORIES } from './workforce';

export interface LaborWorker {
  id: string;
  category: string; // LABOR_CATEGORIES 중 하나, 미지정이면 빈 문자열
  name: string;
  birth?: string;
  phone?: string; // 휴대폰 번호
  generalHealthDate?: string; // LG화학 일반검진 일자
  generalHealthCert?: string; // LG화학 일반검진 첨부파일 URL
  specialHealthDate?: string; // 특수검진일자
  specialHealthCert?: string; // 특수검진 첨부파일 URL
  chemCert?: string; // 유해화학물질 교육이수증 첨부파일 URL
  chemCertCompletion?: string; // 유해화학물질 수료증 첨부파일 URL
  chemDate?: string; // 유해화학물질 교육 이수일자 — 이수년도 표시에 쓰인다
  ynccStart?: string; // YNCC 교육기간 시작 (이수일)
  ynccEnd?: string; // YNCC 교육기간 종료 (교육유효종료일)
  note?: string;
  updatedAt: string;
}

export const LABOR_ROSTER_KEY = 'sj-labor-roster:v1';
/** 아직 분류를 지정하지 않은 인력을 모아 보여줄 가상 탭 키 */
export const UNASSIGNED = '미지정';
export const LABOR_TABS = [...LABOR_CATEGORIES, UNASSIGNED];

/** 새 인력 1명의 빈 값 */
export function blankWorker(category: string): Omit<LaborWorker, 'id' | 'updatedAt'> {
  return { category: category === UNASSIGNED ? '' : category, name: '' };
}
