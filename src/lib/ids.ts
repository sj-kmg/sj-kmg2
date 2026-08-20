/**
 * 기록 ID 생성 규칙.
 *
 * 서버(/api/records/[type])는 문서 ID를 `[A-Za-z0-9_-]{1,64}` 로만 허용한다.
 * 이름·차량번호처럼 한글이 섞인 값을 그대로 ID에 넣으면 저장이 400으로 거부되므로,
 * 명부·대장 초기 데이터의 ID는 반드시 이 헬퍼로 만든다.
 */

/** 서버와 동일한 허용 규칙 */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * 초기 데이터(시드)용 ID — 순번으로 유일성을 보장하고, 참고용으로 ASCII 문자만 덧붙인다.
 * 예) seedId('VS-seed', 3, '802소 3632') → 'VS-seed-04-8023632'
 */
export function seedId(prefix: string, index: number, hint = ''): string {
  const ascii = hint.replace(/[^A-Za-z0-9]/g, '');
  const n = String(index + 1).padStart(2, '0');
  return `${prefix}-${n}${ascii ? `-${ascii}` : ''}`.slice(0, 64);
}

/**
 * 이름처럼 "같으면 같은 기록이어야 하는" 값으로 만드는 **고정** ID.
 *
 * 시각(Date.now)으로 ID를 만들면 같은 사람이라도 기기·접속마다 다른 ID가 나와,
 * 서버에는 같은 이름의 기록이 여러 벌 쌓인다 (인력 명부가 중복되던 원인).
 * 이름에서 ID를 뽑으면 어디서 몇 번을 돌려도 같은 ID가 나와, 새로 만드는 대신 덮어쓴다.
 *
 * 서버가 ID에 `[A-Za-z0-9_-]`만 허용하므로 한글을 그대로 쓸 수 없어 해시로 바꾼다.
 */
export function nameId(prefix: string, name: string): string {
  const key = name.replace(/\s/g, '');
  // FNV-1a 계열 32비트 해시를 두 벌 돌려 16자리로 — 명부 규모에서 충돌은 사실상 없다
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < key.length; i += 1) {
    const c = key.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + i), 0x85ebca6b) >>> 0;
  }
  const hex = a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  return `${prefix}-${hex}`.slice(0, 64);
}

/**
 * 첨부파일 링크 주소.
 *
 * 첨부 경로는 두 가지가 섞여 있다.
 *  - 업로드된 파일: Cloud Storage 전체 주소 — 이미 퍼센트 인코딩돼 있어 그대로 써야 한다.
 *    (다시 인코딩하면 `%2F` → `%252F`가 되어 403 Permission denied가 난다)
 *  - 저장소에 함께 넣어 둔 정적 파일: `/certs/…/김중길_일반검진_2026.pdf` 처럼
 *    한글이 그대로라 인코딩이 필요하다.
 */
export function fileHref(path: string): string {
  return /^https?:\/\//i.test(path) ? path : encodeURI(path);
}
