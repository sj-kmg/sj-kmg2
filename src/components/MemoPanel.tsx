'use client';

import { useState } from 'react';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';

interface Memo {
  id: string;
  text: string;
  pinned?: boolean;
  createdAt: string;
}

const MEMO_KEY = 'sj-memo:v1';

/** 메인 [메모장] 패널 — 중요한 내용을 바로 입력·확인. 고정(📌)한 메모는 위로 올라온다. */
export default function MemoPanel() {
  const { entries, mode, add, remove } = useSyncedLog<Memo>('memo', MEMO_KEY);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const ok = await add({ id: `MEMO-${Date.now()}`, text: t, createdAt: new Date().toISOString() });
      if (ok) setText('');
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (m: Memo) => {
    if (busy) return;
    setBusy(true);
    try {
      await add({ ...m, pinned: !m.pinned });
    } finally {
      setBusy(false);
    }
  };

  const del = async (m: Memo) => {
    if (!confirm('이 메모를 삭제할까요?')) return;
    await remove(m.id);
  };

  const list = [...entries].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="flex h-full flex-col">
      {/* 입력 */}
      <form onSubmit={submit} className="mb-2 flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="중요한 내용을 입력하고 Enter"
          aria-label="메모 입력"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-lg bg-[#1f3864] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a4a80] disabled:opacity-50"
        >
          기록
        </button>
      </form>

      {/* 목록 */}
      {list.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center">
          <p className="text-sm text-slate-400">
            {mode === 'loading' ? '불러오는 중…' : '메모가 없습니다'}
            <span className="mt-1 block text-xs text-slate-300">위 입력창에 바로 기록해 보세요</span>
          </p>
        </div>
      ) : (
        <ul className="max-h-52 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
          {list.map((m) => (
            <li key={m.id} className="group flex items-start gap-1.5 py-1.5">
              <button
                onClick={() => void togglePin(m)}
                aria-label={m.pinned ? '고정 해제' : '고정'}
                title={m.pinned ? '고정 해제' : '위로 고정'}
                className={`mt-0.5 shrink-0 text-[11px] ${m.pinned ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
              >
                📌
              </button>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
                {m.text}
              </span>
              <span className="shrink-0 font-mono text-[9px] text-slate-400">{m.createdAt.slice(5, 10)}</span>
              <button
                onClick={() => void del(m)}
                aria-label="메모 삭제"
                className="shrink-0 text-[11px] text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
        {list.length}건 · 📌 고정 시 위로 이동 {mode === 'server' ? '· 모든 기기 공유' : '· 이 브라우저에 저장'}
      </p>
    </div>
  );
}
