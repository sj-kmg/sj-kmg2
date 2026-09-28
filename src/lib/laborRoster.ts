/**
 * 공무관리 › 인력관리 — 인력(공영·개미·여수·여천·당근인력) 인원별 관리 현황.
 *
 * 특수검진·유해화학물질·YNCC출입·일반검진은 각각 별도 메뉴에서도 "인력" 그룹으로
 * 입력할 수 있는데, 여기서는 그 네 가지를 사람 한 명 기준으로 한데 모아 본다.
 * [기존 인력 데이터 불러오기]로 그 메뉴들에 이미 입력된 인력 항목을 이름 기준으로
 * 병합해 최초 1회 가져올 수 있다 (덮어쓰지 않고 채워져 있지 않은 값만 채운다).
 */
import { WATCHED_HAZARDS, applyHazardCheck, hazardStatuses, watchedHazardsIn, type HazardWatch } from './hazardWatch';
import { daysUntil } from './education';
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

/**
 * 유해화학물질 안전교육 유효기간 (년).
 * 이수한 해로부터 이만큼 되는 해의 **12월 31일까지** 쓸 수 있다.
 * 예) 2024년 이수 → 2026년까지 유효, 2027년이 되면 갱신해야 한다.
 */
export const CHEM_VALID_YEARS = 2;
/** 일반검진 유효기간 (개월) */
export const GENERAL_VALID_MONTHS = 12;

/** 이름 옆 표시 상태 — 없음·유효·기간 지남 */
export type ChipState = 'none' | 'ok' | 'expired';

export interface WorkerChip {
  label: string;
  state: ChipState;
  /** 왜 그 색인지 — 표시 위에 올리면 보인다 */
  hint: string;
}

/**
 * 이름 옆에 붙는 네 가지 표시를 만든다.
 *
 * 값이 없으면 회색, 기간이 남아 있으면 초록, **기간이 지났으면 빨강**이다.
 * 기간을 따지는 기준은 항목마다 다르다.
 *   · 특수검진     — 붙인 확인서에 적힌 물질 중 **하나라도** 갱신일이 지나면 빨강
 *                    (벤젠 6개월 · 톨루엔/크실렌 1년, 물질마다 주기가 다르다)
 *   · 유해화학물질 — 이수한 해를 포함해 2년. 24년 이수면 26년까지 쓰고 27년부터 빨강
 *   · YNCC        — 교육기간 종료일이 지나면 빨강
 *   · 일반검진     — 검진일로부터 1년이 지나면 빨강
 *
 * `today`가 없으면(화면이 뜨기 전) 기간을 따지지 않는다 — 서버에서 그린 화면과
 * 어긋나면 글자가 깜빡이기 때문이다.
 */
export function workerChips(r: LaborWorker, today: Date | null): WorkerChip[] {
  const chips: WorkerChip[] = [];

  // ── 특수검진 — 물질별 갱신일 가운데 가장 급한 것으로 판단한다
  if (!r.specialHealthCert && !(r.hazards ?? []).length) {
    chips.push({ label: '특수검진', state: 'none', hint: '확인서가 없습니다' });
  } else {
    const st = hazardStatuses(r.hazards, today);
    const 지난것 = st.filter((h) => h.days < 0);
    if (지난것.length > 0) {
      chips.push({
        label: '특수검진',
        state: 'expired',
        hint: `갱신 필요 — ${지난것.map((h) => `${h.name} ${h.renewAt}`).join(' · ')}`,
      });
    } else {
      const 다음 = st[0];
      chips.push({
        label: '특수검진',
        state: 'ok',
        hint: 다음 ? `다음 검진 ${다음.name} ${다음.renewAt}` : '확인서 있음',
      });
    }
  }

  // ── 유해화학물질 — 이수한 해를 포함해 2년
  const chemYear = Number((r.chemDate ?? '').slice(0, 4));
  if (!r.chemCert && !r.chemCertCompletion && !chemYear) {
    chips.push({ label: '유해화학물질', state: 'none', hint: '이수증이 없습니다' });
  } else if (!chemYear || !today) {
    chips.push({ label: '유해화학물질', state: 'ok', hint: '이수년도가 없어 기간을 따지지 않습니다' });
  } else {
    const 마지막해 = chemYear + CHEM_VALID_YEARS;
    const 지남 = today.getFullYear() > 마지막해;
    chips.push({
      label: '유해화학물질',
      state: 지남 ? 'expired' : 'ok',
      hint: `${chemYear}년 이수 — ${마지막해}년까지 유효`,
    });
  }

  // ── YNCC — 교육기간 종료일
  if (!r.ynccStart && !r.ynccEnd) {
    chips.push({ label: 'YNCC', state: 'none', hint: '교육기간이 없습니다' });
  } else if (!r.ynccEnd) {
    chips.push({ label: 'YNCC', state: 'ok', hint: '종료일이 비어 있습니다' });
  } else {
    const 지남 = !!today && daysUntil(r.ynccEnd, today) < 0;
    chips.push({ label: 'YNCC', state: 지남 ? 'expired' : 'ok', hint: `교육기간 종료 ${r.ynccEnd}` });
  }

  // ── 일반검진 — 검진일로부터 1년
  if (!r.generalHealthDate) {
    chips.push({ label: '일반검진', state: 'none', hint: '검진일자가 없습니다' });
  } else {
    const 갱신일 = addMonthsTo(r.generalHealthDate, GENERAL_VALID_MONTHS);
    const 지남 = !!today && !!갱신일 && daysUntil(갱신일, today) < 0;
    chips.push({
      label: '일반검진',
      state: 지남 ? 'expired' : 'ok',
      hint: `${r.generalHealthDate} 검진 — ${갱신일}까지 유효`,
    });
  }

  return chips;
}

/** 개월 수를 더한 날짜 — 말일 처리 포함 (하루 전으로 당기지 않는다) */
function addMonthsTo(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
    /*
     * 유해화학물질은 **이수년도만** 본다 (화면에도 연도 한 칸뿐이다).
     * 그래서 날짜가 하루이틀 다르다고 알릴 필요가 없다 — 연도가 같으면 같은 것으로 본다.
     * 비어 있을 때만 채우고, 값이 있으면 건드리지도 묻지도 않는다.
     */
    const docDate = f?.issuedAt || (opts.fallbackChemDate.startsWith('0000') ? '' : opts.fallbackChemDate);
    if (docDate) {
      read.push(`이수년도 ${docDate.slice(0, 4)}`);
      if (!cur.chemDate) {
        patch.chemDate = docDate;
        filled.push(`이수년도 ${docDate.slice(0, 4)}`);
      }
    }
  }

  if (field === 'specialHealthCert' && f?.issuedAt) {
    // 검진일자는 서류를 그대로 따라간다 (화면에는 안 보여 주고 목록·내보내기에만 쓴다)
    if ((cur.specialHealthDate ?? '') !== f.issuedAt) patch.specialHealthDate = f.issuedAt;

    /*
     * 유해인자 — **붙인 확인서가 그 사람의 특수검진 기록 그 자체**다.
     * 그래서 화면은 서류와 똑같아야 한다.
     *   · 서류에 적힌 물질 → 그 검진일자로 적는다 (지금 값이 더 나중이어도 서류대로)
     *   · 서류에 없는 물질 → 날짜를 지운다 (그 검진에서 받지 않았다는 뜻)
     * 예: 벤젠·아세톤·소음만 적힌 확인서라면 벤젠만 그 날짜로 남고 톨루엔·크실렌은 빈다.
     *
     * 유해인자를 아예 못 읽었을 때는 손대지 않는다 — 못 읽은 것을 "없다"로 보고
     * 지워 버리면 멀쩡한 기록이 날아간다.
     */
    const readHaz = watchedHazardsIn(f.hazards);
    if (readHaz.length === 0) {
      read.push('유해인자 (못 읽음 — 기존 값을 그대로 둡니다)');
    } else {
      read.push(`유해인자 ${readHaz.join('·')}`);
      const next: HazardWatch[] = readHaz.map((name) => ({ name, checkedAt: f.issuedAt as string }));
      const key = (list: HazardWatch[]) =>
        JSON.stringify([...list].sort((a, b) => a.name.localeCompare(b.name)).map((h) => `${h.name}:${h.checkedAt}`));
      if (key(next) !== key(cur.hazards ?? [])) {
        patch.hazards = next;
        const gone = WATCHED_HAZARDS.filter(
          (h) => !readHaz.includes(h) && (cur.hazards ?? []).some((x) => x.name === h),
        );
        filled.push(
          `${readHaz.join('·')} ${f.issuedAt}` + (gone.length > 0 ? ` · ${gone.join('·')} 지움 (서류에 없음)` : ''),
        );
      }
    }
  }

  if (field === 'generalHealthCert' && f?.issuedAt) {
    take('일반검진일', cur.generalHealthDate, f.issuedAt, (v) => ({ generalHealthDate: v }));
  }

  return { patch, filled, differs, read };
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

