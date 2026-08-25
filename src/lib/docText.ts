/**
 * 서류 글자에서 입력칸 값 뽑아내기.
 *
 * PDF에 글자층이 있으면(관공서·협회가 발급한 전자 서류 대부분) AI 없이도
 * 이름·생년월일·연락처를 그대로 읽어낼 수 있다. 스캔본·사진은 글자층이 없어
 * 여기서는 아무것도 나오지 않고, AI 판독으로 넘어간다.
 *
 * 원칙: **적혀 있는 값만** 뽑는다. 애매하면 null로 두고 사람이 채우게 한다.
 */

export interface TextFields {
  personName: string | null;
  birth: string | null;
  /** 010-0000-0000 형태로 정리한 휴대폰 번호 */
  phone: string | null;
  /** 교육일자·검진일자처럼 이 서류의 기준 일자 */
  issuedAt: string | null;
}

const EMPTY: TextFields = { personName: null, birth: null, phone: null, issuedAt: null };

/** 줄바꿈·중복 공백을 하나로 — 서류마다 글자 간격이 제각각이라 먼저 고른다 */
function flatten(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

/** 실제 있는 날짜인지 (2월 30일 같은 값을 걸러낸다) */
function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function iso(y: number, m: number, d: number): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${y}-${p(m)}-${p(d)}`;
}

/**
 * 주민등록번호·외국인등록번호 앞자리에서 생년월일만 만든다.
 * **뒷자리는 성별·세기 판단에만 쓰고 어디에도 남기지 않는다.**
 *  1·2·5·6 → 19xx년, 3·4·7·8 → 20xx년
 */
function birthFromRegNo(flat: string): string | null {
  const re = /(?<!\d)(\d{2})(\d{2})(\d{2})\s*[-–—]\s*([1-8])(?!\d{0,6}\d{7})/g;
  for (const m of flat.matchAll(re)) {
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const code = Number(m[4]);
    const year = code === 1 || code === 2 || code === 5 || code === 6 ? 1900 + yy : 2000 + yy;
    if (validDate(year, mm, dd) && year <= new Date().getFullYear()) return iso(year, mm, dd);
  }
  return null;
}

/** "생년월일 : 1963-11-27" / "1963.11.27" / "1963년 11월 27일" */
function birthFromLabel(flat: string): string | null {
  const re =
    /생\s*년\s*월\s*일\s*[:：]?\s*(\d{4})\s*[.\-년/]\s*(\d{1,2})\s*[.\-월/]\s*(\d{1,2})/g;
  for (const m of flat.matchAll(re)) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (validDate(y, mo, d) && y >= 1900 && y <= new Date().getFullYear()) return iso(y, mo, d);
  }
  return null;
}

/** 휴대폰 번호 — 010-0000-0000 형태로 맞춘다 */
function phoneFrom(flat: string): string | null {
  const re = /(?<!\d)(01[016789])\s*[-–—.\s]?\s*(\d{3,4})\s*[-–—.\s]?\s*(\d{4})(?!\d)/g;
  for (const m of flat.matchAll(re)) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/** "성명 : 배영일" — 사업장·대표자 칸은 건너뛴다 */
function nameFrom(flat: string): string | null {
  // 「성명(대표자)」처럼 대표자를 가리키는 칸은 제외한다
  const re = /(?:성\s*명|이\s*름)\s*(?!\(\s*대표자)\s*[:：]?\s*([가-힣]{2,4})(?![가-힣])/g;
  for (const m of flat.matchAll(re)) {
    if (m[1] === '대표자') continue;
    return m[1];
  }
  return null;
}

/**
 * 이 서류의 기준 일자.
 * 교육 이수증은 「교육 일자」의 끝나는 날, 확인서는 「검진일자」를 쓴다.
 */
function issuedFrom(flat: string): string | null {
  // 날짜에 "년·월·일"이 섞여 있으므로 라벨 뒤 60자를 통째로 훑는다
  const label = /(교육\s*일자|검진\s*일자|수료\s*일자|이수\s*일자|발급\s*일자)\s*[:：]?\s*([\s\S]{0,60})/g;
  for (const m of flat.matchAll(label)) {
    const dates = [...m[2].matchAll(/(\d{4})\s*[.\-년/]\s*(\d{1,2})\s*[.\-월/]\s*(\d{1,2})/g)]
      .map((d) => ({ y: Number(d[1]), m: Number(d[2]), d: Number(d[3]) }))
      .filter((d) => validDate(d.y, d.m, d.d) && d.y >= 1990);
    // 기간으로 적혀 있으면 끝나는 날을 쓴다
    if (dates.length > 0) {
      const last = dates[dates.length - 1];
      return iso(last.y, last.m, last.d);
    }
  }
  return null;
}

/** 서류 글자에서 뽑아낼 수 있는 값들 */
export function fieldsFromText(raw: string): TextFields {
  const flat = flatten(raw);
  if (flat.length < 10) return { ...EMPTY };
  return {
    personName: nameFrom(flat),
    birth: birthFromLabel(flat) ?? birthFromRegNo(flat),
    phone: phoneFrom(flat),
    issuedAt: issuedFrom(flat),
  };
}
