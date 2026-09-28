/**
 * 공무관리 › 인력관리 — 인력(공영·개미·여수·여천·당근인력) 인원별 관리 현황.
 *
 * 특수검진·유해화학물질·YNCC출입·일반검진은 각각 별도 메뉴에서도 "인력" 그룹으로
 * 입력할 수 있는데, 여기서는 그 네 가지를 사람 한 명 기준으로 한데 모아 본다.
 * [기존 인력 데이터 불러오기]로 그 메뉴들에 이미 입력된 인력 항목을 이름 기준으로
 * 병합해 최초 1회 가져올 수 있다 (덮어쓰지 않고 채워져 있지 않은 값만 채운다).
 */
import { WATCHED_HAZARDS, applyHazardCheck, watchedHazardsIn, type HazardWatch } from './hazardWatch';
import { changedFields, shouldApply } from './docBatch';
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

/** 서류 값이 지금 기록과 다를 때 — 사람이 보고 고를 수 있게 한 줄로 만든다 */
export interface DocDiff {
  /** 어느 칸인지 (생년월일·검진일자·벤젠 …) */
  label: string;
  /** 지금 기록에 있는 값 */
  mine: string;
  /** 서류에 적힌 값 */
  doc: string;
  /** [서류대로 맞추기]를 누르면 적용할 내용 */
  patch: Partial<LaborWorker>;
}

export interface DocReadResult {
  /** 비어 있던 칸에 곧바로 채운 내용 */
  patch: Partial<LaborWorker>;
  /** 무엇을 채웠는지 (사람에게 보여 줄 말) */
  filled: string[];
  /** 서류에는 있는데 지금 값과 다른 것 — 함부로 덮지 않고 알려만 준다 */
  differs: DocDiff[];
  /** 서류에서 읽어 낸 내용 요약 — 아무것도 안 채워도 무엇을 읽었는지는 보여 준다 */
  read: string[];
}

/**
 * 서류에서 읽은 값으로 **비어 있는 칸만** 채운다.
 *
 * 사람이 이미 적어 둔 값은 절대 건드리지 않는다 — 판독은 어디까지나 보조 수단이라
 * 잘못 읽었을 때 기존 기록을 망가뜨리면 안 된다.
 *
 * 다만 **조용히 넘어가지는 않는다.** 서류에 적힌 값이 지금 기록과 다르면 `differs`로
 * 돌려주어 화면에서 나란히 보여 주고, 사람이 [서류대로 맞추기]를 누르면 그때 바꾼다.
 * (예전에는 다른 값을 말없이 무시해서, 붙였는데 왜 그대로냐는 말이 나왔다)
 */
export function autoFillFromDoc(
  cur: LaborWorker,
  f: ReadFields | null,
  field: CertField,
  opts: { formatPhone: (s: string) => string; fallbackChemDate: string; nameTaken?: (name: string) => boolean },
): DocReadResult {
  const patch: Partial<LaborWorker> = {};
  const filled: string[] = [];
  const differs: DocDiff[] = [];
  const read: string[] = [];

  /** 빈 칸이면 채우고, 값이 있는데 다르면 알려만 준다 */
  const take = (label: string, mine: string | undefined, doc: string | undefined, make: (v: string) => Partial<LaborWorker>) => {
    if (!doc) return;
    read.push(`${label} ${doc}`);
    const now = (mine ?? '').trim();
    if (!now) {
      Object.assign(patch, make(doc));
      filled.push(`${label} ${doc}`);
      return;
    }
    if (now !== doc) differs.push({ label, mine: now, doc, patch: make(doc) });
  };

  take('생년월일', cur.birth, f?.birth ?? undefined, (v) => ({ birth: v }));
  take('휴대폰', cur.phone, f?.phone ? opts.formatPhone(f.phone) : undefined, (v) => ({ phone: v }));

  // 이름 없이 첨부부터 한 경우에만 채운다 (이미 있는 사람과 겹치면 넣지 않는다)
  if (f?.personName && !cur.name.trim() && !opts.nameTaken?.(f.personName)) {
    patch.name = f.personName;
    filled.push(`이름 ${f.personName}`);
  }

  if (field === 'chemCert' || field === 'chemCertCompletion') {
    // 이수년도 — 서류에서 읽은 이수일자를 쓰고, 못 읽으면 파일명의 연도로 대신한다
    if (f?.issuedAt) {
      take('이수일자', cur.chemDate, f.issuedAt, (v) => ({ chemDate: v }));
    } else if (!cur.chemDate) {
      patch.chemDate = opts.fallbackChemDate;
    }
  }

  if (field === 'specialHealthCert' && f?.issuedAt) {
    take('검진일자', cur.specialHealthDate, f.issuedAt, (v) => ({ specialHealthDate: v }));

    /*
     * 유해인자별 갱신 — 확인서에 적힌 물질만 날짜를 잡는다 (벤젠 재검이면 벤젠만).
     * 유해인자를 못 읽었으면 연간 검진으로 보고 세 물질을 모두 잡는다.
     */
    const readHaz = watchedHazardsIn(f.hazards);
    const names = readHaz.length > 0 ? readHaz : [...WATCHED_HAZARDS];
    read.push(`유해인자 ${names.join('·')}${readHaz.length > 0 ? '' : ' (못 읽어 3종으로 봄)'}`);

    const byName = new Map((cur.hazards ?? []).map((h) => [h.name, h.checkedAt]));
    for (const name of names) {
      const mine = byName.get(name);
      if (!mine) {
        // 이 물질 기록이 아직 없다 — 그대로 넣는다
        const next = applyHazardCheck(patch.hazards ?? cur.hazards, [name], f.issuedAt);
        patch.hazards = next;
        filled.push(`${name} ${f.issuedAt}`);
      } else if (mine !== f.issuedAt) {
        differs.push({
          label: name,
          mine,
          doc: f.issuedAt,
          patch: { hazards: applyHazardCheckForce(cur.hazards, [name], f.issuedAt) },
        });
      }
    }
  }

  if (field === 'generalHealthCert' && f?.issuedAt) {
    take('일반검진일', cur.generalHealthDate, f.issuedAt, (v) => ({ generalHealthDate: v }));
  }

  return { patch, filled, differs, read };
}

/**
 * 물질 날짜를 **서류대로 맞춘다** — 앞뒤를 따지지 않는다.
 *
 * 평소(`applyHazardCheck`)는 날짜를 앞으로만 민다. 예전 서류를 뒤늦게 붙여도 최신
 * 기록이 밀리지 않게 하려는 것이다. 하지만 사람이 [서류대로 맞추기]를 눌렀다면
 * 그 서류가 맞다는 뜻이므로, 지금 값이 더 나중이어도 서류 날짜로 되돌린다.
 */
export function applyHazardCheckForce(
  cur: HazardWatch[] | undefined,
  names: string[],
  checkedAt: string,
): HazardWatch[] {
  const out = (cur ?? []).filter((h) => !names.includes(h.name));
  for (const name of names) out.push({ name, checkedAt });
  return out;
}

/**
 * 손에 들고 있는 특수건강진단 확인서 한 장.
 *
 * `hazards`는 서류에 **적혀 있는** 감시 물질만 담는다. 벤젠만 다시 받은 확인서라면
 * 벤젠 하나뿐이고, 그러면 톨루엔·크실렌 날짜는 예전 그대로 남는다 (물질마다 갱신주기가
 * 달라 한 장으로 세 물질을 다 잡으면 실제보다 늦게 알림이 뜬다).
 */
export interface SpecialHealthDoc {
  /** 서류에 적힌 검진일자 */
  checkedAt: string;
  /** 서류에 적힌 감시 물질 (WATCHED_HAZARDS 중) */
  hazards: string[];
  /** 붙일 파일 — 이미 같은 서류가 붙어 있으면 비워 둔다 */
  cert?: string;
}

/** 한 사람 몫으로 들어온 특검 서류 묶음 */
export interface SpecialHealthEntry {
  name: string;
  docs: SpecialHealthDoc[];
  birth?: string;
  phone?: string;
  category?: string;
  /**
   * 이 묶음이 그 사람의 감시 물질 기록 **전부**일 때만 참.
   *
   * 참이면 물질별 날짜를 서류만 보고 다시 세운다. 유해인자를 못 읽어 "3종 모두"로
   * 잡아 둔 기록을 서류대로 되돌리려는 것 — 그때는 날짜가 뒤로 물러날 수도 있다.
   * 거짓이면 앞으로만 민다 (예전 서류를 뒤늦게 붙여도 최신 날짜가 밀리지 않게).
   */
  rebuildHazards?: boolean;
}

/**
 * 특검 서류 묶음을 기록에 반영한다 — 바뀌는 칸만 돌려주고, 없으면 null.
 *
 * 날짜·첨부는 **가장 나중 서류** 기준이고, 물질별 날짜는 서류마다 따로 잡는다.
 * 같은 날짜의 서류가 이미 반영돼 있으면 아무것도 바꾸지 않는다 (중복 무시).
 */
export function specialHealthPatch(
  cur: LaborWorker,
  entry: SpecialHealthEntry,
): Partial<LaborWorker> | null {
  const docs = [...entry.docs].filter((d) => d.checkedAt).sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  if (docs.length === 0) return null;
  const last = docs[docs.length - 1];

  // 물질별 마지막 검진일 — 되세우기면 빈 목록에서, 아니면 지금 기록 위에서 쌓는다
  let hazards = entry.rebuildHazards ? [] : (cur.hazards ?? []);
  for (const d of docs) {
    const names = d.hazards.filter((h) => (WATCHED_HAZARDS as readonly string[]).includes(h));
    hazards = applyHazardCheck(hazards, names, d.checkedAt);
  }
  const sortHaz = (list: HazardWatch[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  const patch: Partial<LaborWorker> = {
    birth: cur.birth || entry.birth,
    phone: cur.phone?.trim() || entry.phone,
    category: cur.category || entry.category,
  };
  // 검진일·첨부는 지금 것보다 나중 서류일 때만 손댄다
  if (shouldApply(cur.specialHealthDate, last.checkedAt)) {
    patch.specialHealthDate = last.checkedAt;
    if (last.cert) patch.specialHealthCert = last.cert;
  } else if (!cur.specialHealthCert && last.cert) {
    // 날짜는 이미 맞는데 파일만 빠진 경우
    patch.specialHealthCert = last.cert;
  }
  if (JSON.stringify(sortHaz(hazards)) !== JSON.stringify(sortHaz(cur.hazards ?? []))) {
    patch.hazards = hazards;
  }
  return changedFields(cur, patch);
}

