'use client';

import { useEffect, useState } from 'react';

export type Role = 'admin' | 'field';

/** 현장 계정이 쓸 수 있는 화면 */
export const FIELD_VIEWS = ['tbm', 'nearmiss'];

/**
 * 지금 암호로 어떤 권한이 있는지 확인한다.
 * 화면 구성용이며, 실제 차단은 서버가 한다.
 *  - 'admin' : 전체
 *  - 'field' : TBM일지·아차사고 작성만 (삭제 불가)
 *  - null    : 확인 전 / 서버 미설정(로컬 모드) → 제한 없이 보여 준다
 */
export function useRole(): { role: Role | null; loading: boolean } {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const pass = localStorage.getItem('sj-sync-passcode') ?? '';
        const res = await fetch('/api/session', { headers: pass ? { 'x-passcode': pass } : {} });
        if (!alive) return;
        if (res.ok) {
          const j = (await res.json()) as { role?: Role };
          setRole(j.role ?? null);
        } else {
          // 401(암호 미입력)·503(서버 미설정) — 로컬 모드로 동작하므로 제한하지 않는다
          setRole(null);
        }
      } catch {
        if (alive) setRole(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { role, loading };
}
