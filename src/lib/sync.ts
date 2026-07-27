/**
 * 현장 기록 동기화 클라이언트.
 * 서버(Vercel Blob) 저장이 설정돼 있으면 기기 간 공유, 아니면 로컬(localStorage) 폴백.
 * 동기화 암호는 이 브라우저에 저장해 두고 요청 헤더로만 전송한다.
 */
export type LogType =
  | 'tbm'
  | 'nearmiss'
  | 'workforce'
  | 'risk'
  | 'yncc-workers'
  | 'yncc-vehicles'
  | 'chem-workers'
  | 'cards';

const PASS_KEY = 'sj-sync-passcode';

export function getPasscode(): string {
  try {
    return localStorage.getItem(PASS_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setPasscode(v: string): void {
  try {
    localStorage.setItem(PASS_KEY, v);
  } catch {
    // ignore
  }
}

export class SyncError extends Error {
  status: number;
  constructor(status: number) {
    super(`sync_${status}`);
    this.status = status;
  }
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const pass = getPasscode();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(pass ? { 'x-passcode': pass } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new SyncError(res.status);
  return res;
}

export async function listEntries<T>(type: LogType): Promise<T[]> {
  const res = await call(`/api/records/${type}`);
  const data = (await res.json()) as { entries: T[] };
  return data.entries;
}

/** 메인 화면용 조용한 조회 — 암호 프롬프트 없이 서버 시도 후 실패하면 로컬 저장분으로 폴백 */
export async function listEntriesSilently<T>(type: LogType, localKey: string): Promise<T[]> {
  try {
    return await listEntries<T>(type);
  } catch {
    // 서버 미설정/미인증 → 로컬 폴백
  }
  try {
    return JSON.parse(localStorage.getItem(localKey) ?? '[]') as T[];
  } catch {
    return [];
  }
}

export async function saveEntryRemote(type: LogType, entry: unknown): Promise<void> {
  await call(`/api/records/${type}`, { method: 'POST', body: JSON.stringify(entry) });
}

export async function removeEntryRemote(type: LogType, id: string): Promise<void> {
  await call(`/api/records/${type}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function uploadPhoto(dataUrl: string): Promise<string> {
  const res = await call('/api/photos', { method: 'POST', body: JSON.stringify({ dataUrl }) });
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** AI가 생성한 위험성평가 항목 */
export interface AiRiskRow {
  step: string;
  hazard: string;
  measure: string;
  freq1: number;
  sev1: number;
  action: string;
  freq2: number;
  sev2: number;
  timing: string;
}

/** AI 생성 실패 — 서버가 알려준 원인 코드·상세를 담는다 */
export class RiskAiError extends SyncError {
  code: string;
  detail: string;
  constructor(status: number, code: string, detail: string) {
    super(status);
    this.code = code;
    this.detail = detail;
  }
}

/** 작업 사진으로 위험성평가 초안 생성 (Vercel AI Gateway — 배포 환경 전용) */
export async function generateRiskRows(photos: string[], context: string): Promise<AiRiskRow[]> {
  const pass = getPasscode();
  const res = await fetch('/api/risk-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(pass ? { 'x-passcode': pass } : {}) },
    body: JSON.stringify({ photos, context }),
  });
  if (!res.ok) {
    let code = '';
    let detail = '';
    try {
      const j = (await res.json()) as { error?: string; detail?: string };
      code = j.error ?? '';
      detail = j.detail ?? '';
    } catch {
      // 본문 없는 오류(504 등)는 상태코드만 전달
    }
    throw new RiskAiError(res.status, code, detail);
  }
  const data = (await res.json()) as { rows: AiRiskRow[] };
  return data.rows ?? [];
}
