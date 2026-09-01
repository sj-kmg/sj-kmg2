/**
 * 첨부파일 보존 규칙.
 *
 * 화면에서 내용만 고쳐 저장할 때 기록을 새로 만들어 보내는 곳이 있는데,
 * 그러면 그 화면이 다루지 않는 첨부파일이 통째로 지워진다
 * (YNCC차량에서 등록자만 바꿔 [갱신]을 눌렀더니 차량등록증·보험증권이 사라진 일).
 *
 * 첨부파일은 **새로 붙이거나 교체할 때만** 바뀌어야 하므로 저장 직전에 한 번 더 막는다.
 */

/** 첨부파일 칸으로 보는 이름 — certFile, regCertFile, specialHealthCert, photoIds … */
const ATTACHMENT_KEY = /(cert|file|photo)/i;

/**
 * 저장 내용에 **아예 들어 있지 않은** 첨부파일 칸은 기존 값을 그대로 이어받는다.
 *
 * 일부러 첨부를 지우는 경우에는 화면이 빈 값을 담아 보내므로(칸이 존재) 그대로 반영된다.
 * "없는 칸"과 "비운 칸"을 구분하는 것이 요점이다.
 */
export function keepAttachments<T extends { id: string }>(next: T, prev: T | undefined): T {
  if (!prev) return next;
  let merged: T | null = null;
  for (const key of Object.keys(prev) as (keyof T & string)[]) {
    if (key in next || !ATTACHMENT_KEY.test(key)) continue;
    const value = prev[key];
    if (value === undefined || value === null || value === '') continue;
    merged = merged ?? { ...next };
    merged[key] = value;
  }
  return merged ?? next;
}
