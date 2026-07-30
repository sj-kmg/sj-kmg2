'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogType } from './sync';
import { useSyncedLog, type SyncMode } from './useSyncedLog';

/** 자동저장 상태 표시용 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Options<T> {
  /** 저장 이력이 전혀 없을 때 최초 1회 자동 등록할 기존 대장(명부) */
  seed?: T[];
  /** 빈 행 판별 — 이름·번호 등 핵심값이 비어 있으면 저장하지 않는다 */
  isBlank: (row: T) => boolean;
  /** 표시 정렬 */
  sort?: (a: T, b: T) => number;
}

const SAVE_DELAY = 700;

/**
 * 시트형 화면(대장·명부) 공용 저장 훅.
 *
 * - **자동저장**: 값을 바꾸면 잠시 후 자동으로 저장된다. [저장] 버튼이 필요 없다.
 * - **되돌리기**: 편집·삭제 직전 상태를 쌓아 두고 한 단계씩 복구한다.
 * - **시드 자동 등록**: 저장 이력이 없으면 기존 대장을 최초 1회 그대로 등록한다.
 *   이렇게 해야 이후의 삭제가 서버에 남아, 지운 행이 되살아나지 않는다.
 */
export function useSheetLog<T extends { id: string }>(type: LogType, localKey: string, opts: Options<T>) {
  const { seed, isBlank, sort } = opts;
  const { entries, mode, add, remove } = useSyncedLog<T>(type, localKey);

  const [rows, setRowsState] = useState<T[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  /** 되돌리기 스택은 ref로 들고, 버튼 활성화 판단용 길이만 상태로 둔다 */
  const historyRef = useRef<T[][]>([]);
  const [undoCount, setUndoCount] = useState(0);

  /** 현재 행 목록의 최신값 — 저장·되돌리기에서 렌더 밖에서 읽는다 */
  const rowsRef = useRef<T[]>([]);
  const setRows = useCallback((next: T[] | ((cur: T[]) => T[])) => {
    const value = typeof next === 'function' ? (next as (cur: T[]) => T[])(rowsRef.current) : next;
    rowsRef.current = value;
    setRowsState(value);
  }, []);

  /** 저장 대기·진행 중인 행 — 이 동안에는 서버 목록으로 덮어쓰지 않는다 */
  const pending = useRef<Set<string>>(new Set());
  /** 아직 저장 대상이 아닌 새 빈 행 */
  const drafts = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const seeded = useRef(false);

  // 호출부에서 인라인으로 넘기는 함수들 — 매 렌더 새 참조라 ref에 담아 의존성에서 뺀다
  // (그러지 않으면 목록 동기화 이펙트가 자기 자신을 다시 트리거해 무한 렌더가 된다)
  const sortRef = useRef(sort);
  const isBlankRef = useRef(isBlank);
  useEffect(() => {
    sortRef.current = sort;
    isBlankRef.current = isBlank;
  });

  const sortRows = useCallback((list: T[]) => {
    const cmp = sortRef.current;
    return cmp ? [...list].sort(cmp) : list;
  }, []);

  // 서버·로컬 목록 → 화면 (저장 대기 중이거나 작성 중인 행은 보존)
  useEffect(() => {
    if (mode === 'loading') return;
    if (pending.current.size > 0) return;
    setRows((prev) => {
      const keep = prev.filter((r) => drafts.current.has(r.id));
      return sortRows([...entries, ...keep]);
    });
  }, [entries, mode, sortRows, setRows]);

  // 저장 이력이 없으면 기존 대장을 최초 1회 자동 등록
  useEffect(() => {
    if (mode === 'loading' || seeded.current) return;
    // 등록할 대장이 없으면 표시만 하고, 나중에 대장이 생기면 그때 판단한다
    if (!seed?.length) return;
    seeded.current = true;
    if (entries.length > 0) return;
    void (async () => {
      setStatus('saving');
      const stamped = seed.map((s) => ({ ...s, updatedAt: new Date().toISOString() }));
      for (const row of stamped) {
        if (!(await add(row))) {
          setStatus('error');
          return;
        }
      }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    })();
  }, [mode, entries.length, seed, add]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  /** 되돌리기용 스냅샷 — 변경 직전 상태를 최대 30단계 보관 */
  const snapshot = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-29), rowsRef.current];
    setUndoCount(historyRef.current.length);
  }, []);

  /** 실제 저장 — 빈 행은 건너뛴다 */
  const flush = useCallback(
    async (id: string) => {
      timers.current.delete(id);
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row || isBlankRef.current(row)) {
        pending.current.delete(id);
        if (pending.current.size === 0) setStatus('idle');
        return;
      }
      drafts.current.delete(id);
      setStatus('saving');
      const ok = await add({ ...row, updatedAt: new Date().toISOString() });
      pending.current.delete(id);
      if (!ok) {
        setStatus('error');
        return;
      }
      if (pending.current.size === 0) {
        setStatus('saved');
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
      }
    },
    [add],
  );

  const scheduleSave = useCallback(
    (id: string) => {
      pending.current.add(id);
      setStatus('saving');
      const prev = timers.current.get(id);
      if (prev) clearTimeout(prev);
      timers.current.set(
        id,
        setTimeout(() => void flush(id), SAVE_DELAY),
      );
    },
    [flush],
  );

  /** 값 수정 — 잠시 후 자동 저장 */
  const setRow = useCallback(
    (id: string, patch: Partial<T>) => {
      snapshot();
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      scheduleSave(id);
    },
    [snapshot, scheduleSave, setRows],
  );

  /** 행 추가 — 내용을 채우면 그때 저장된다 */
  const addRow = useCallback(
    (row: T) => {
      snapshot();
      drafts.current.add(row.id);
      setRows((cur) => [...cur, row]);
    },
    [snapshot, setRows],
  );

  /** 행 삭제 — 즉시 반영 (되돌리기로 복구 가능) */
  const removeRow = useCallback(
    async (id: string) => {
      snapshot();
      const timer = timers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
      pending.current.delete(id);
      drafts.current.delete(id);
      setRows((cur) => cur.filter((r) => r.id !== id));
      setStatus('saving');
      await remove(id);
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
    },
    [snapshot, remove, setRows],
  );

  /** 되돌리기 — 직전 상태로 복구하고 서버에도 반영 */
  const undo = useCallback(async () => {
    const stack = historyRef.current;
    if (stack.length === 0) return;
    const prevRows = stack[stack.length - 1];
    historyRef.current = stack.slice(0, -1);
    setUndoCount(historyRef.current.length);

    const current = rowsRef.current;
    setRows(prevRows);

    setStatus('saving');
    const prevIds = new Set(prevRows.map((r) => r.id));
    // 되돌린 뒤 사라지는 행은 서버에서도 삭제
    for (const r of current) {
      if (!prevIds.has(r.id) && !drafts.current.has(r.id)) await remove(r.id);
    }
    // 되살아나거나 값이 달라진 행은 다시 저장
    for (const r of prevRows) {
      if (isBlankRef.current(r)) continue;
      const now = current.find((c) => c.id === r.id);
      if (!now || JSON.stringify(now) !== JSON.stringify(r)) {
        drafts.current.delete(r.id);
        await add({ ...r, updatedAt: new Date().toISOString() });
      }
    }
    setStatus('saved');
    setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
  }, [add, remove, setRows]);

  return {
    rows,
    mode,
    status,
    setRow,
    addRow,
    removeRow,
    undo,
    canUndo: undoCount > 0,
  };
}

/** 자동저장 상태 문구 */
export function saveBadge(status: SaveStatus, mode: SyncMode): { text: string; className: string } | null {
  if (status === 'saving') return { text: '저장 중…', className: 'text-slate-400' };
  if (status === 'saved') return { text: '자동 저장됨 ✓', className: 'text-green-600' };
  if (status === 'error') return { text: '저장 실패 — 네트워크를 확인해 주세요', className: 'text-red-600 font-semibold' };
  if (mode === 'loading') return null;
  return { text: '변경하면 자동 저장됩니다', className: 'text-slate-400' };
}
