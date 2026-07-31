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
