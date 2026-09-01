'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { keepAttachments } from './attachments';
import {
  enqueue,
  flushOutbox,
  isRetriable,
  onOutboxChange,
  outboxCount,
  pendingEntries,
  pendingRemovals,
} from './outbox';
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

/** 저장 실패 원인을 구분해 안내 — 네트워크 문제로 뭉뚱그리면 원인 파악이 어렵다 */
function saveFailMessage(e: unknown): string {
  if (e instanceof SyncError) {
    if (e.status === 400) {
      return '저장 형식이 올바르지 않아 서버가 거부했습니다 (400).\n개발자에게 문의해 주세요.';
    }
    if (e.status === 413) {
      return '내용이 너무 커서 저장할 수 없습니다. 첨부파일 크기를 줄여 주세요.';
    }
    if (e.status >= 500) {
      return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
    }
    return `서버 저장에 실패했습니다 (${e.status}).`;
  }
  return '서버 저장에 실패했습니다. 네트워크를 확인해 주세요.';
}

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
  /** 아직 서버로 못 보낸 기록 수 (신호 불량 등) */
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setPending(outboxCount());
    return onOutboxChange(setPending);
  }, []);

  /** 서버 목록 + 아직 못 보낸 기록 (신호 불량 중에도 화면에서 사라지지 않게) */
  const withPending = useCallback(
    (list: T[]): T[] => {
      const queued = pendingEntries<T>(type);
      const removed = new Set(pendingRemovals(type));
      const ids = new Set(queued.map((e) => e.id));
      return [...queued, ...list.filter((e) => !ids.has(e.id))].filter((e) => !removed.has(e.id));
    },
    [type],
  );

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
      setEntries(withPending(loadLocal<T>(localKey)));
      setMode('local');
      return;
    }

    // 로컬에 남은 기록을 서버로 이관
    const local = loadLocal<T>(localKey);
    const serverIds = new Set(serverList.map((e) => e.id));
    const toMigrate = local.filter((e) => !serverIds.has(e.id));
    let migrated = 0;
    for (const raw of toMigrate) {
      try {
        const entry = opts?.migrateExtra ? await opts.migrateExtra(raw) : raw;
        await saveEntryRemote(type, entry);
        serverList.push(entry);
        migrated++;
      } catch {
        // 이관 실패 항목은 로컬에 남긴다
      }
    }
    if (local.length > 0 && migrated === toMigrate.length) {
      try {
        localStorage.removeItem(localKey);
      } catch {
        // ignore
      }
    }
    setEntries(withPending(serverList));
    setMode('server');
  }, [type, localKey, opts, withPending]);

  // StrictMode 이중 마운트 시 load()가 동시에 두 번 돌면
  // 이관 직후 빈 로컬을 읽은 두 번째 실행이 목록을 덮어쓸 수 있어 1회로 제한한다
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 저장 직전의 원본 — 첨부파일을 이어받을 때 참조한다 */
  const entriesRef = useRef<T[]>([]);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const add = useCallback(
    async (incoming: T): Promise<boolean> => {
      // 내용만 고쳐 저장하는 경우에도 첨부파일이 사라지지 않게 이어받는다
      const entry = keepAttachments(incoming, entriesRef.current.find((e) => e.id === incoming.id));
      if (mode === 'server') {
        try {
          await saveEntryRemote(type, entry);
        } catch (e) {
          let err = e;
          if (e instanceof SyncError && e.status === 401 && askPasscode()) {
            try {
              await saveEntryRemote(type, entry);
              err = null;
            } catch (e2) {
              err = e2;
            }
          }
          if (err) {
            // 네트워크 문제면 잃지 않도록 미전송함에 넣고 나중에 자동 전송한다
            if (isRetriable(err)) {
              enqueue({ type, action: 'save', id: entry.id, entry });
            } else {
              alert(saveFailMessage(err));
              return false;
            }
          }
        }
        // 같은 id 재저장(수정)은 기존 항목을 대체한다
        setEntries((list) => [entry, ...list.filter((e) => e.id !== entry.id)]);
        return true;
      }
      setEntries((list) => {
        const next = [entry, ...list.filter((e) => e.id !== entry.id)];
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
        } catch (e) {
          if (isRetriable(e)) {
            enqueue({ type, action: 'remove', id });
          } else {
            alert('서버에서 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
            return;
          }
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

  return { entries, mode, pending, add, remove, reload: load, flush: flushOutbox };
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
