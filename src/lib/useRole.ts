'use client';

import { useCallback, useEffect, useState } from 'react';
import { authHeaders } from './sync';
import { watchUser } from './firebaseClient';

export type Role = 'admin' | 'field' | 'viewer';
/**
 * 현장 암호로 볼 수 있는 화면.
 * YNCC차량은 현장에서 서류를 제시할 일이 있어 **보기 전용**으로 열어 둔다
 * (수정·첨부는 canWrite에서 막는다).
 */
export const FIELD_VIEWS = ['tbm', 'nearmiss', 'yncc-vehicle'];

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
  photo: string;
}

export interface Session {
  /**
   *  'admin'  : 전체 (암호 또는 관리자 구글 계정)
   *  'field'  : TBM일지·아차사고 작성만
   *  'viewer' : 승인된 구글 계정 — 지정된 메뉴만 읽기 전용
   *  null     : 확인 전 / 서버 미설정(로컬 모드) → 제한 없이 보여 준다
   */
  role: Role | null;
  loading: boolean;
  /** viewer가 볼 수 있는 메뉴 키 (admin·field·로컬 모드는 null = 제한 없음) */
  menus: string[] | null;
  /** 구글 로그인 사용자 */
  user: SessionUser | null;
  /** 로그인은 했으나 승인 대기 중 */
  pending: boolean;
  /** 관리자가 처리해야 할 신청 건수 */
  pendingCount: number;
  /** 서버가 구글 로그인을 판단할 수 없는 로컬 모드 */
  localMode: boolean;
  refresh: () => void;
}

/**
 * 지금 자격으로 어떤 권한이 있는지 서버에 물어본다.
 * 화면 구성용이며, 실제 차단은 서버가 한다.
 */
export function useRole(): Session {
  const [state, setState] = useState<Omit<Session, 'refresh'>>({
    role: null,
    loading: true,
    menus: null,
    user: null,
    pending: false,
    pendingCount: 0,
    localMode: false,
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // 구글 로그인/로그아웃이 일어나면 세션을 다시 확인한다
  useEffect(() => {
    let first = true;
    return watchUser(() => {
      // 최초 콜백은 아래 조회와 겹치므로 건너뛴다
      if (first) {
        first = false;
        return;
      }
      refresh();
    });
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/session', { headers: await authHeaders() });
        if (!alive) return;
        const j = (await res.json().catch(() => ({}))) as {
          role?: Role;
          menus?: string[] | null;
          user?: SessionUser | null;
          status?: string;
          pendingCount?: number;
        };
        if (res.ok) {
          setState({
            role: j.role ?? null,
            loading: false,
            menus: j.menus ?? null,
            user: j.user ?? null,
            pending: false,
            pendingCount: j.pendingCount ?? 0,
            localMode: false,
          });
          return;
        }
        // 403 + 사용자 정보 = 구글 로그인은 됐으나 승인 전
        if (res.status === 403 && j.user) {
          setState({
            role: null,
            loading: false,
            menus: [],
            user: j.user,
            pending: j.status === 'pending',
            pendingCount: 0,
            localMode: false,
          });
          return;
        }
        // 401(암호 미입력)·503(서버 미설정) — 로컬 모드로 동작하므로 제한하지 않는다
        setState({
          role: null,
          loading: false,
          menus: null,
          user: null,
          pending: false,
          pendingCount: 0,
          localMode: true,
        });
      } catch {
        if (alive) {
          setState((s) => ({ ...s, loading: false, localMode: true }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  return { ...state, refresh };
}
