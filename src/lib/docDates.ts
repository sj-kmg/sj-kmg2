/**
 * 첨부서류의 글자층에서 만료일을 읽어 낸다 — 서버·브라우저 공용(순수 함수).
 *
 * 읽어 내지 못하면 **null**을 돌려준다. 넘겨짚어 채우지 않는 게 중요하다.
 * 특히 자동차등록증은 인쇄된 줄이 최초 검사기간이고 이후 갱신은 손으로 적는 경우가 많아,
 * 글자층에서 나온 값이 최신이 아닐 수 있다. 그래서 '검사유효기간'이라는 말이 실제로
 * 있는 문서에서, 그 안에서 **가장 나중 날짜**만 취한다.
 * 스캔본은 글자층이 아예 없어 자연히 null이 되고, 화면에는 '만료일 확인'으로 남는다.
 */
import type { CertKind } from './certExpiry';

/** 이 문서가 그 서류가 맞는지 알아보는 말 */
const KEYWORDS: Record<CertKind, string[]> = {
  inspection: ['검사유효기간', '검사 유효기간'],
  insurance: ['보험기간', '보험 기간', '의무보험기간', '보험유효기간'],
};

/** 앞뒤 10년을 벗어난 날짜는 이 서류의 기간이 아니다 */
const YEARS_BACK = 10;
const YEARS_AHEAD = 10;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * 글 속의 모든 날짜 — `2026-10-15`, `2026.10.15`, `2026/10/15`, `2026 년 10 월 15 일`
 */
export function datesIn(text: string): string[] {
  const out: string[] = [];
  const push = (y: string, m: string, d: string) => {
    const [yy, mm, dd] = [Number(y), Number(m), Number(d)];
    if (valid(yy, mm, dd)) out.push(`${yy}-${pad(mm)}-${pad(dd)}`);
  };

  const plain = /(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/g;
  for (let m = plain.exec(text); m; m = plain.exec(text)) push(m[1], m[2], m[3]);

  const korean = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  for (let m = korean.exec(text); m; m = korean.exec(text)) push(m[1], m[2], m[3]);

  return out;
}

/**
 * 이 서류의 만료일 — 찾지 못하면 null.
 * @param today 앞뒤 10년 범위를 재는 기준
 */
export function expiryFromText(text: string, kind: CertKind, today = new Date()): string | null {
  const flat = String(text ?? '').replace(/\s+/g, ' ');
  if (!flat) return null;
  // 그 서류가 맞다는 말이 없으면 다른 문서일 수 있다 — 손대지 않는다
  if (!KEYWORDS[kind].some((k) => flat.includes(k))) return null;

  const min = `${today.getFullYear() - YEARS_BACK}-01-01`;
  const max = `${today.getFullYear() + YEARS_AHEAD}-12-31`;
  const candidates = datesIn(flat).filter((d) => d >= min && d <= max);
  if (candidates.length === 0) return null;

  // 기간의 끝 = 가장 나중 날짜. 시작일·발행일·계약일은 모두 그보다 앞선다
  return candidates.reduce((a, b) => (b > a ? b : a));
}
