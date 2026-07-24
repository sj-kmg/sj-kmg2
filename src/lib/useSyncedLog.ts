'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LogType,
  SyncError,
  getPasscode,
  setPasscode,
  listEntries,
  saveEntryRemote,
  removeEntryRemote,
} from './sync';

export type SyncMode = 'loading' | 'server' | 'local';

interface Options<T> {
  /** 로컬 → 서버 이관 시 항목 가공 (예: 아차사고 사진 업로드) */
  migrateExtra?: (entry: T) => Promise<T>;
}

function loadLocal<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

function saveLocal<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function askPasscode(): boolean {
  const entered = window.prompt(
    '기록 동기화 암호를 입력하세요.\n(모든 기기에서 같은 기록을 보려면 관리자에게 받은 암호가 필요합니다. 취소하면 이 브라우저에만 저장됩니다.)',
  );
  if (entered && entered.trim()) {
    setPasscode(entered.trim());
    return true;
  }
  return false;
}

/**
 * 현장 기록 저장 훅 — 서버 동기화 가능하면 서버, 아니면 로컬 저장.
 * 서버 연결 성공 시 이 브라우저에 남아 있던 로컬 기록을 자동으로 서버로 이관한다.
 */
export function useSyncedLog<T extends { id: string }>(type: LogType, localKey: string, opts?: Options<T>) {
  const [entries, setEntries] = useState<T[]>([]);
  const [mode, setMode] = useState<SyncMode>('loading');

  const load = useCallback(async () => {
    const tryServer = async (): Promise<T[]> => listEntries<T>(type);
    let serverList: T[] | null = null;
    try {
      serverList = await tryServer();
    } catch (e) {
      if (e instanceof SyncError && e.status === 401) {
        // 암호 필요 — 한 번 물어보고 재시도
        if (askPasscode()) {
          try {
            serverList = await tryServer();
          } catch {
            serverList = null;
          }
        }
      }
    }

    if (serverList === null) {
      setEntries(loadLocal<T>(localKey));
      setMode('local');
      return;
    }

    // 로컬에 남은 기록을 서버로 이관
    const local = loadLocal<T>(localKey);
    const serverIds = new Set(serverList.map((e) => e.id));
    const pending = local.filter((e) => !serverIds.has(e.id));
    let migrated = 0;
    for (const raw of pending) {
      try {
        const entry = opts?.migrateExtra ? await opts.migrateExtra(raw) : raw;
        await saveEntryRemote(type, entry);
        serverList.push(entry);
        migrated++;
      } catch {
        // 이관 실패 항목은 로컬에 남긴다
      }
    }
    if (local.length > 0 && migrated === pending.length) {
      try {
        localStorage.removeItem(localKey);
      } catch {
        // ignore
      }
    }
    setEntries(serverList);
    setMode('server');
  }, [type, localKey, opts]);

  // StrictMode 이중 마운트 시 load()가 동시에 두 번 돌면
  // 이관 직후 빈 로컬을 읽은 두 번째 실행이 목록을 덮어쓸 수 있어 1회로 제한한다
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback(
    async (entry: T): Promise<boolean> => {
      if (mode === 'server') {
        try {
          await saveEntryRemote(type, entry);
        } catch (e) {
          if (e instanceof SyncError && e.status === 401 && askPasscode()) {
            try {
              await saveEntryRemote(type, entry);
            } catch {
              alert('서버 저장에 실패했습니다. 네트워크를 확인해 주세요.');
              return false;
            }
          } else {
            alert('서버 저장에 실패했습니다. 네트워크를 확인해 주세요.');
            return false;
          }
        }
        setEntries((list) => [entry, ...list]);
        return true;
      }
      setEntries((list) => {
        const next = [entry, ...list];
        saveLocal(localKey, next);
        return next;
      });
      return true;
    },
    [mode, type, localKey],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (mode === 'server') {
        try {
          await removeEntryRemote(type, id);
        } catch {
          alert('서버에서 삭제하지 못했습니다. 네트워크를 확인해 주세요.');
          return;
        }
        setEntries((list) => list.filter((e) => e.id !== id));
        return;
      }
      setEntries((list) => {
        const next = list.filter((e) => e.id !== id);
        saveLocal(localKey, next);
        return next;
      });
    },
    [mode, type, localKey],
  );

  return { entries, mode, add, remove, reload: load };
}

/** 저장 모드 안내 배지 */
export function modeBadge(mode: SyncMode): { text: string; className: string } {
  if (mode === 'server') {
    return { text: '☁️ 서버 동기화 — 모든 기기에서 공유됨', className: 'bg-sky-50 text-sky-700' };
  }
  if (mode === 'local') {
    return { text: '💻 이 브라우저에만 저장됨', className: 'bg-slate-100 text-slate-500' };
  }
  return { text: '연결 확인 중…', className: 'bg-slate-100 text-slate-400' };
}
