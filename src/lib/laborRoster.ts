/**
 * 공무관리 › 인력관리 — 인력(공영·개미·여수·여천·당근인력) 인원별 관리 현황.
 *
 * 특수검진·유해화학물질·YNCC출입·일반검진은 각각 별도 메뉴에서도 "인력" 그룹으로
 * 입력할 수 있는데, 여기서는 그 네 가지를 사람 한 명 기준으로 한데 모아 본다.
 * [기존 인력 데이터 불러오기]로 그 메뉴들에 이미 입력된 인력 항목을 이름 기준으로
 * 병합해 최초 1회 가져올 수 있다 (덮어쓰지 않고 채워져 있지 않은 값만 채운다).
 */
import { WATCHED_HAZARDS, applyHazardCheck, watchedHazardsIn, type HazardWatch } from './hazardWatch';
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
  /**
   * 갱신주기를 따로 관리하는 유해인자 — 물질마다 마지막 검진일을 들고 있다.
   * (벤젠은 6개월, 톨루엔·크실렌은 1년 주기라 특수검진일자 하나로는 부족하다)
   */
  hazards?: HazardWatch[];
  chemCert?: string; // 유해화학물질 교육이수증 첨부파일 URL
  chemCertCompletion?: string; // 유해화학물질 수료증 첨부파일 URL
  chemDate?: string; // 유해화학물질 교육 이수일자 — 이수년도 표시에 쓰인다
  ynccStart?: string; // YNCC 교육기간 시작 (이수일)
  ynccEnd?: string; // YNCC 교육기간 종료 (교육유효종료일)
  note?: string;
  /**
   * 이 기록을 만든 초기 자료 묶음 표식.
   * 표식이 붙은 기록이 하나라도 있으면 그 묶음은 이미 반영된 것으로 보고 다시 깔지 않는다.
   * 사람이 지운 인원이 새로고침마다 되살아나는 일을 막는다.
   */
  seedTag?: string;
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

/** 첨부파일을 붙일 수 있는 칸 */
export type CertField = 'specialHealthCert' | 'chemCert' | 'chemCertCompletion' | 'generalHealthCert';

/** 판독 결과 중 여기서 쓰는 값만 */
export interface ReadFields {
  personName?: string | null;
  birth?: string | null;
  phone?: string | null;
  issuedAt?: string | null;
  /** 「유해인자」 칸 원문 — 어떤 물질을 검진했는지 판단해 갱신주기를 잡는다 */
  hazards?: string | null;
}

/**
 * 서류에서 읽은 값으로 **비어 있는 칸만** 채운다.
 *
 * 사람이 이미 적어 둔 값은 절대 건드리지 않는다 — 판독은 어디까지나 보조 수단이라
 * 잘못 읽었을 때 기존 기록을 망가뜨리면 안 된다.
 * 무엇을 채웠는지(filled)를 함께 돌려주어 화면에서 사람에게 알려 준다.
 */
export function autoFillFromDoc(
  cur: LaborWorker,
  f: ReadFields | null,
  field: CertField,
  opts: { formatPhone: (s: string) => string; fallbackChemDate: string; nameTaken?: (name: string) => boolean },
): { patch: Partial<LaborWorker>; filled: string[] } {
  const patch: Partial<LaborWorker> = {};
  const filled: string[] = [];

  if (f?.birth && !cur.birth) {
    patch.birth = f.birth;
    filled.push(`생년월일 ${f.birth}`);
  }
  if (f?.phone && !cur.phone?.trim()) {
    patch.phone = opts.formatPhone(f.phone);
    filled.push(`휴대폰 ${patch.phone}`);
  }
  // 이름 없이 첨부부터 한 경우에만 채운다 (이미 있는 사람과 겹치면 넣지 않는다)
  if (f?.personName && !cur.name.trim() && !opts.nameTaken?.(f.personName)) {
    patch.name = f.personName;
    filled.push(`이름 ${f.personName}`);
  }

  if (field === 'chemCert' || field === 'chemCertCompletion') {
    // 이수년도 — 서류에서 읽은 이수일자를 쓰고, 못 읽으면 파일명의 연도로 대신한다
    if (!cur.chemDate) {
      patch.chemDate = f?.issuedAt ?? opts.fallbackChemDate;
      if (f?.issuedAt) filled.push(`이수일자 ${f.issuedAt}`);
    }
  }
  if (field === 'specialHealthCert' && f?.issuedAt) {
    if (!cur.specialHealthDate) {
      patch.specialHealthDate = f.issuedAt;
      filled.push(`특수검진일 ${f.issuedAt}`);
    }
    // 유해인자별 갱신 — 확인서에 적힌 물질만 날짜를 바꾼다 (벤젠 재검이면 벤젠만).
    // 유해인자를 못 읽었으면 연간 검진으로 보고 세 물질을 모두 잡는다.
    const read = watchedHazardsIn(f.hazards);
    const names = read.length > 0 ? read : [...WATCHED_HAZARDS];
    const next = applyHazardCheck(cur.hazards, names, f.issuedAt);
    if (JSON.stringify(next) !== JSON.stringify(cur.hazards ?? [])) {
      patch.hazards = next;
      filled.push(`${names.join('·')} ${f.issuedAt}${read.length > 0 ? '' : ' (유해인자를 못 읽어 3종 모두 적용)'}`);
    }
  }
  if (field === 'generalHealthCert' && f?.issuedAt && !cur.generalHealthDate) {
    patch.generalHealthDate = f.issuedAt;
    filled.push(`일반검진일 ${f.issuedAt}`);
  }
  return { patch, filled };
}
