'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AccessEntry, AccessStatus } from '@/lib/access';
import { VIEWABLE_MENUS } from '@/lib/menus';
import { authHeaders } from '@/lib/sync';

const STATUS_STYLE: Record<AccessStatus, { label: string; cls: string }> = {
  pending: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: '승인됨', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: '거절됨', cls: 'bg-red-50 text-red-700' },
};

/**
 * 권한허용 — 구글 로그인으로 접근을 신청한 사람을 승인하고,
 * 볼 수 있는 메뉴를 하나씩 지정한다. 승인해도 열람만 가능하며 수정은 서버에서 막는다.
 */
export default function AccessAdmin({ onChanged }: { onChanged?: () => void }) {
  const [entries, setEntries] = useState<AccessEntry[] | null>(null);
  const [error, setError] = useState('');
  /** 편집 중인 메뉴 선택 (uid → 메뉴 키 목록) */
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/access', { headers: await authHeaders() });
      if (!res.ok) {
        setError(res.status === 403 ? '관리자만 볼 수 있습니다.' : '목록을 불러오지 못했습니다.');
        setEntries([]);
        return;
      }
      const j = (await res.json()) as { entries: AccessEntry[] };
      setEntries(j.entries);
      setDraft(Object.fromEntries(j.entries.map((e) => [e.uid, e.menus ?? []])));
      setError('');
    } catch {
      setError('목록을 불러오지 못했습니다.');
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (uid: string, status: AccessStatus) => {
    setBusy(uid);
    try {
      const res = await fetch('/api/access', {
        method: 'PATCH',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, status, menus: draft[uid] ?? [] }),
      });
      if (!res.ok) {
        alert('처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      await load();
      onChanged?.();
    } finally {
      setBusy('');
    }
  };

  const removeEntry = async (uid: string, email: string) => {
    if (!confirm(`${email} 의 신청 기록을 삭제할까요?\n(다시 로그인하면 새 신청이 접수됩니다)`)) return;
    setBusy(uid);
    try {
      await fetch(`/api/access?uid=${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      await load();
      onChanged?.();
    } finally {
      setBusy('');
    }
  };

  const toggleMenu = (uid: string, key: string) =>
    setDraft((d) => {
      const cur = d[uid] ?? [];
      return { ...d, [uid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });

  const setAll = (uid: string, all: boolean) =>
    setDraft((d) => ({ ...d, [uid]: all ? VIEWABLE_MENUS.map((m) => m.key) : [] }));

  if (entries === null) {
    return <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>;
  }
  if (error) {
    return <p className="py-16 text-center text-sm text-slate-400">{error}</p>;
  }

  const pending = entries.filter((e) => e.status === 'pending');
  const decided = entries.filter((e) => e.status !== 'pending');

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">권한 안내</h3>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-500">
          <li>· 승인된 계정은 <b className="text-slate-700">열람만</b> 가능합니다. 저장·수정·삭제는 서버에서 차단됩니다.</li>
          <li>· 체크한 메뉴만 보입니다. 체크하지 않은 메뉴는 주소를 직접 입력해도 열리지 않습니다.</li>
          <li>· 승인 후에도 메뉴를 바꾸거나 거절로 되돌릴 수 있습니다.</li>
        </ul>
      </div>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
          승인 대기
          {pending.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {pending.length}
            </span>
          )}
        </h3>
        {pending.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            대기 중인 신청이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((e) => (
              <Card
                key={e.uid}
                entry={e}
                menus={draft[e.uid] ?? []}
                busy={busy === e.uid}
                onToggle={(k) => toggleMenu(e.uid, k)}
                onAll={(v) => setAll(e.uid, v)}
                onDecide={(s) => decide(e.uid, s)}
                onRemove={() => removeEntry(e.uid, e.email)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-800">처리된 계정 ({decided.length})</h3>
        {decided.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            아직 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {decided.map((e) => (
              <Card
                key={e.uid}
                entry={e}
                menus={draft[e.uid] ?? []}
                busy={busy === e.uid}
                onToggle={(k) => toggleMenu(e.uid, k)}
                onAll={(v) => setAll(e.uid, v)}
                onDecide={(s) => decide(e.uid, s)}
                onRemove={() => removeEntry(e.uid, e.email)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  entry: e,
  menus,
  busy,
  onToggle,
  onAll,
  onDecide,
  onRemove,
}: {
  entry: AccessEntry;
  menus: string[];
  busy: boolean;
  onToggle: (key: string) => void;
  onAll: (all: boolean) => void;
  onDecide: (status: AccessStatus) => void;
  onRemove: () => void;
}) {
  const style = STATUS_STYLE[e.status];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#22d3ee] to-[#4b7bff] text-xs font-bold text-white"
        >
          {(e.name || e.email || '?').slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-800">{e.name || '(이름 없음)'}</span>
          <span className="block truncate text-[11px] text-slate-400">{e.email}</span>
        </span>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${style.cls}`}>{style.label}</span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">
          신청 {(e.requestedAt ?? '').slice(0, 10)}
          {e.decidedAt && ` · 처리 ${e.decidedAt.slice(0, 10)}`}
        </span>
      </div>

      {/* 열어 줄 메뉴 */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">볼 수 있는 메뉴 ({menus.length})</span>
          <button onClick={() => onAll(true)} className="ml-auto text-[10px] font-semibold text-blue-700 hover:underline">
            전체 선택
          </button>
          <button onClick={() => onAll(false)} className="text-[10px] font-semibold text-slate-400 hover:underline">
            전체 해제
          </button>
        </div>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {VIEWABLE_MENUS.map((m) => (
            <label key={m.key} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={menus.includes(m.key)}
                onChange={() => onToggle(m.key)}
                className="h-3.5 w-3.5 accent-[#4b7bff]"
              />
              <span className="truncate">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onDecide('approved')}
          disabled={busy || menus.length === 0}
          title={menus.length === 0 ? '먼저 볼 수 있는 메뉴를 하나 이상 선택해 주세요' : undefined}
          className="rounded-lg bg-[#1f3864] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {e.status === 'approved' ? '메뉴 변경 저장' : '승인'}
        </button>
        {e.status !== 'rejected' && (
          <button
            onClick={() => onDecide('rejected')}
            disabled={busy}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            거절
          </button>
        )}
        <button
          onClick={onRemove}
          disabled={busy}
          className="ml-auto text-[11px] text-slate-300 hover:text-red-500 disabled:opacity-40"
        >
          기록 삭제
        </button>
      </div>
    </article>
  );
}
