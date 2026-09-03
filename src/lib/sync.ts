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
  | 'cards'
  | 'workplan'
  | 'annual-plan'
  | 'annual-plan-tasks'
  | 'memo'
  | 'pass-vehicles'
  | 'health'
  | 'health-followup'
  | 'supervisor'
  | 'detectors'
  | 'vehicle-service'
  | 'vehicle-check'
  | 'vehicle-items'
  | 'equipment'
  | 'inventory'
  | 'safety-items'
  | 'safety-dates'
  | 'labor-roster'
  | 'extinguisher-hq'
  | 'extinguisher-hq-check'
  | 'extinguisher-vehicle';

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

/**
 * 요청 공통 헤더 — 구글 로그인 토큰과 기존 암호를 함께 싣는다.
 * 서버는 구글 토큰을 먼저 보고, 없으면 암호로 판단한다.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const pass = getPasscode();
  if (pass) headers['x-passcode'] = pass;
  try {
    const { idToken } = await import('./firebaseClient');
    const token = await idToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // 구글 로그인을 쓰지 않는 환경 — 암호만으로 동작한다
  }
  return headers;
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(await authHeaders()),
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

/** 교육 수료증(PDF·이미지) 업로드 — 저장된 URL 반환 */
export async function uploadCert(dataUrl: string, name: string): Promise<string> {
  const res = await call('/api/certs', { method: 'POST', body: JSON.stringify({ dataUrl, name }) });
  const data = (await res.json()) as { url: string };
  return data.url;
}

/**
 * 유효기간이 있는 서류 올리기 — 주소와 함께 문서에서 읽어 낸 만료일·차량번호를 돌려준다.
 * 스캔본이라 글자층이 없으면 둘 다 null이고, 화면이 AI 판독으로 한 번 더 시도한다.
 */
export async function uploadDatedCert(
  dataUrl: string,
  name: string,
  expiryKind: 'inspection' | 'insurance',
): Promise<{ url: string; expiresAt: string | null; plate: string | null }> {
  const res = await call('/api/certs', { method: 'POST', body: JSON.stringify({ dataUrl, name, expiryKind }) });
  const data = (await res.json()) as { url: string; expiresAt?: string | null; plate?: string | null };
  return { url: data.url, expiresAt: data.expiresAt ?? null, plate: data.plate ?? null };
}

/**
 * 이미 붙어 있는 서류에서 유효기간을 다시 읽는다.
 * 붙일 때 못 읽고 넘어간 서류(스캔본 등)를 나중에 채우는 데 쓴다.
 */
export async function readCertPeriod(
  src: string,
  kind: 'inspection' | 'insurance',
): Promise<{ expiresAt: string | null; plate: string | null; source: string } | null> {
  try {
    const res = await call('/api/certs/period', { method: 'POST', body: JSON.stringify({ src, kind }) });
    return (await res.json()) as { expiresAt: string | null; plate: string | null; source: string };
  } catch {
    return null;
  }
}

/** 첨부서류에서 읽어 낸 값 — 확인되지 않은 항목은 null */
export interface DocFields {
  docType: string | null;
  personName: string | null;
  birth: string | null;
  /** 휴대폰 번호 010-0000-0000 */
  phone: string | null;
  /** 서류에 적힌 유해인자 목록 원문 (특수검진 확인서 등) */
  hazards: string | null;
  issuedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  plate: string | null;
  note: string | null;
}

/**
 * 첨부서류 자동 판독 — 올린 파일에서 성명·생년월일·일자 등을 읽어 온다.
 * 판독은 어디까지나 입력을 돕는 보조 수단이라, 실패하면 조용히 null을 돌려주고
 * 화면은 평소대로 수동 입력으로 진행한다 (첨부 자체는 이미 끝난 상태).
 */
export async function extractDocFields(dataUrl: string, hint?: string): Promise<DocFields | null> {
  try {
    const res = await call('/api/doc-extract', { method: 'POST', body: JSON.stringify({ dataUrl, hint }) });
    const data = (await res.json()) as { fields?: DocFields };
    return data.fields ?? null;
  } catch {
    return null;
  }
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
