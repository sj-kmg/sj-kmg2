/**
 * 접근 권한 — 암호 두 개로 역할을 나눈다 (서버 전용).
 *
 *  - 관리자(admin) : SJ_PASSCODE       — 모든 기능. 기록 수정·삭제 가능
 *  - 현장(field)   : SJ_FIELD_PASSCODE — TBM일지·아차사고 작성만. 삭제 불가,
 *                                        이미 저장된 기록은 덮어쓸 수 없다
 *
 * 현장 암호가 설정돼 있지 않으면 관리자 암호만 동작한다(기존과 동일).
 */
export type Role = 'admin' | 'field';

export interface AuthResult {
  /** 통과했으면 역할, 아니면 null */
  role: Role | null;
  /** 암호가 서버에 아예 설정되지 않은 상태 */
  notConfigured: boolean;
}

export function checkAuth(req: Request): AuthResult {
  const admin = process.env.SJ_PASSCODE;
  const field = process.env.SJ_FIELD_PASSCODE;
  if (!admin) return { role: null, notConfigured: true };

  const given = req.headers.get('x-passcode');
  if (given && given === admin) return { role: 'admin', notConfigured: false };
  if (given && field && given === field) return { role: 'field', notConfigured: false };
  return { role: null, notConfigured: false };
}

/** 현장 계정이 쓸 수 있는 기록 종류 — 이 외에는 접근할 수 없다 */
export const FIELD_TYPES = new Set(['tbm', 'nearmiss']);
