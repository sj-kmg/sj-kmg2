/**
 * 입력값 표시 서식 — 화면 어디서나 같은 규칙을 쓰도록 여기에 모아 둔다.
 */

/**
 * 전화번호 — 숫자만 입력해도 하이픈이 자동으로 붙는다 (01012345678 → 010-1234-5678).
 *
 * 입력 도중에도 자연스럽게 보이도록 자릿수에 맞춰 단계적으로 끊고,
 * 지우는 중에 하이픈이 되살아나 커서가 갇히는 일이 없도록 잘라낸 만큼만 붙인다.
 * 서울 지역번호(02)는 2자리로 끊고, 그 외에는 3자리로 끊는다.
 */
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';

  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }

  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}
