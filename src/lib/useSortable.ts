'use client';

import { useCallback, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortCtl {
  /** 지금 정렬 기준인 열 키 (없으면 null = 원래 순서) */
  col: string | null;
  dir: SortDir;
  /** 같은 열을 다시 누르면 오름차순 → 내림차순 → 해제로 돈다 */
  toggle: (key: string) => void;
}

/**
 * 표·목록 정렬 — 이름은 가나다순, 날짜(D-day)는 빠른 날짜순으로 정렬한다.
 *
 * 저장된 순서는 건드리지 않고 화면에 보여줄 때만 정렬한다(다시 누르면 원래대로 돌아온다).
 * 값이 비어 있는 행은 정렬 방향과 상관없이 항상 뒤로 보낸다 — 미입력 항목이 위로 올라와
 * 목록을 가리는 것을 막기 위함이다.
 */
export function useSortable<T>(): SortCtl & { apply: (rows: T[], getters: Record<string, (r: T) => string>) => T[] } {
  const [state, setState] = useState<{ col: string | null; dir: SortDir }>({ col: null, dir: 'asc' });

  const toggle = useCallback((key: string) => {
    setState((s) =>
      s.col !== key ? { col: key, dir: 'asc' } : s.dir === 'asc' ? { col: key, dir: 'desc' } : { col: null, dir: 'asc' },
    );
  }, []);

  const apply = useCallback(
    (rows: T[], getters: Record<string, (r: T) => string>): T[] => {
      const get = state.col ? getters[state.col] : undefined;
      if (!get) return rows;
      const sign = state.dir === 'asc' ? 1 : -1;
      return [...rows].sort((a, b) => {
        const av = (get(a) ?? '').trim();
        const bv = (get(b) ?? '').trim();
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return sign * av.localeCompare(bv, 'ko', { numeric: true });
      });
    },
    [state],
  );

  return { col: state.col, dir: state.dir, toggle, apply };
}
