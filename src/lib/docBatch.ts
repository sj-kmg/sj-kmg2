/**
 * 새로 올라온 서류를 이미 있는 기록에 어떻게 반영할지 — 대시보드 공통 규칙.
 *
 * 규칙은 하나다. **이미 들어 있는 것과 같은 서류는 무시하고, 더 최신이면 갱신한다.**
 * 서류는 여기저기서 여러 번 들어온다(작업별 폴더에도, 인력사 묶음에도 같은 확인서가 있다).
 * 들어올 때마다 덮어쓰면 예전 서류가 최신 기록을 밀어내고, 무조건 건너뛰면 갱신된 서류가
 * 반영되지 않는다. 그래서 판단은 **서류에 적힌 날짜**로만 한다 — 파일 이름이나 올린 시각은
 * 믿을 수 없다(스캔을 나중에 해도 검진일은 그대로다).
 *
 * 메뉴마다 칸 이름이 달라 값을 옮기는 일은 각 메뉴가 하고, 여기서는 판단만 맡는다.
 */

export type DocVerdict =
  /** 기록에 아직 아무것도 없다 — 그대로 넣는다 */
  | 'new'
  /** 들어 있는 것보다 나중 서류다 — 갱신한다 */
  | 'newer'
  /** 같은 날짜 — 이미 반영된 서류로 본다 (무시) */
  | 'duplicate'
  /** 들어 있는 것보다 예전 서류다 — 무시한다 */
  | 'older';

/** 저장된 날짜와 서류의 날짜를 견준다. 날짜는 모두 `YYYY-MM-DD`. */
export function compareDoc(storedDate: string | null | undefined, docDate: string): DocVerdict {
  const stored = (storedDate ?? '').trim();
  if (!docDate) return 'older';
  if (!stored) return 'new';
  if (docDate > stored) return 'newer';
  if (docDate === stored) return 'duplicate';
  return 'older';
}

/** 반영해야 하는가 — 처음 들어오거나 더 최신일 때만 참 */
export function shouldApply(storedDate: string | null | undefined, docDate: string): boolean {
  const v = compareDoc(storedDate, docDate);
  return v === 'new' || v === 'newer';
}

/** 사람이 읽을 판단 결과 — 무엇을 왜 건너뛰었는지 알려 줄 때 쓴다 */
export const VERDICT_LABEL: Record<DocVerdict, string> = {
  new: '새로 등록',
  newer: '최신 서류로 갱신',
  duplicate: '이미 있는 서류 (무시)',
  older: '예전 서류 (무시)',
};

/**
 * 바뀌는 칸만 남긴 조각 — 값이 그대로면 아예 저장을 보내지 않으려는 것.
 * 빈 값(`''`·`undefined`)으로 기존 값을 지우는 일은 하지 않는다.
 */
export function changedFields<T extends object>(cur: T, patch: Partial<T>): Partial<T> | null {
  const out: Partial<T> = {};
  let any = false;
  for (const k of Object.keys(patch) as (keyof T)[]) {
    const v = patch[k];
    if (v === undefined || v === '') continue;
    if (JSON.stringify(cur[k]) === JSON.stringify(v)) continue;
    out[k] = v;
    any = true;
  }
  return any ? out : null;
}
