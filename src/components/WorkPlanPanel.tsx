'use client';

import { useCallback, useEffect, useState } from 'react';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';

interface WorkPlanItem {
  company: string; // 업체명(발주처)
  work: string; // 작업내용
  manager: string; // 담당자
}

interface WorkPlanDay {
  date: string; // YYYY-MM-DD
  items: WorkPlanItem[];
}

interface WorkPlanFile {
  updatedAt: string;
  source: string;
  days: WorkPlanDay[];
}

/** 서버 동기화 저장 단위 — 하루치 계획 (id = WP-YYYY-MM-DD) */
interface WorkPlanEntry {
  id: string;
  date: string;
  items: WorkPlanItem[];
  updatedAt: string;
}

const WORKPLAN_KEY = 'sj-workplan:v1';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDate(ds: string): string {
  const d = new Date(`${ds}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ds;
  return `${d.getMonth() + 1}/${d.getDate()} (${DOW[d.getDay()]})`;
}

/**
 * 일자별 작업계획 — 당일/명일 탭.
 * 저장된 계획(서버 동기화)을 우선 표시하고, 없으면 그룹웨어 연동 파일(workplan.json)을 보여준다.
 * ✏️ 버튼으로 당일·명일 계획을 직접 입력·수정할 수 있으며 모든 기기에 즉시 반영된다.
 */
export default function WorkPlanPanel() {
  const { entries, mode, add } = useSyncedLog<WorkPlanEntry>('workplan', WORKPLAN_KEY);
  const [file, setFile] = useState<WorkPlanFile | null>(null);
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today');
  const [today, setToday] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkPlanItem[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/workplan.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: WorkPlanFile) => setFile(d))
      .catch(() => setFile(null))
      .finally(() => setToday(dateStr()));
  }, []);

  useEffect(() => {
    load();
    // 탭을 다시 볼 때 + 10분마다 최신 확인 (날짜가 바뀌어도 자동 반영)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    const iv = setInterval(load, 10 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(iv);
    };
  }, [load]);

  if (!today) {
    return <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-300">작업계획 불러오는 중…</p>;
  }

  const targetDate = tab === 'today' ? today : dateStr(1);
  const saved = entries.find((e) => e.date === targetDate);
  const fromFile = file?.days.find((d) => d.date === targetDate);
  const items = saved?.items ?? fromFile?.items ?? [];
  const lastUpdate = saved?.updatedAt ? saved.updatedAt.slice(0, 10) : (file?.updatedAt ?? '');

  const startEdit = () => {
    setDraft(items.length > 0 ? items.map((i) => ({ ...i })) : [{ company: '', work: '', manager: '' }]);
    setEditing(true);
  };

  const saveDraft = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const clean = draft
        .map((d) => ({ company: d.company.trim(), work: d.work.trim(), manager: d.manager.trim() }))
        .filter((d) => d.company || d.work);
      const ok = await add({
        id: `WP-${targetDate}`,
        date: targetDate,
        items: clean,
        updatedAt: new Date().toISOString(),
      });
      if (ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-xs font-bold ${
      active
        ? 'bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
        : 'text-slate-400 hover:text-slate-200'
    }`;
  const cell =
    'w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-800 focus:border-[#1f3864] focus:outline-none';

  return (
    <div className="flex h-full flex-col">
      {/* 당일 / 명일 */}
      <div className="mb-2 flex items-center gap-1">
        <button onClick={() => setTab('today')} className={tabBtn(tab === 'today')}>당일</button>
        <button onClick={() => setTab('tomorrow')} className={tabBtn(tab === 'tomorrow')}>명일</button>
        <span className="ml-auto font-mono text-[11px] text-slate-400">{fmtDate(targetDate)}</span>
        {!editing && (
          <button
            onClick={startEdit}
            title="작업계획 입력·수정"
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-400 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            ✏️
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex-1">
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
            {draft.map((d, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  aria-label="업체명"
                  placeholder="업체"
                  value={d.company}
                  onChange={(e) => setDraft((l) => l.map((x, j) => (j === i ? { ...x, company: e.target.value } : x)))}
                  className={`${cell} w-24 shrink-0`}
                />
                <input
                  aria-label="작업내용"
                  placeholder="작업내용"
                  value={d.work}
                  onChange={(e) => setDraft((l) => l.map((x, j) => (j === i ? { ...x, work: e.target.value } : x)))}
                  className={cell}
                />
                <input
                  aria-label="담당자"
                  placeholder="담당"
                  value={d.manager}
                  onChange={(e) => setDraft((l) => l.map((x, j) => (j === i ? { ...x, manager: e.target.value } : x)))}
                  className={`${cell} w-16 shrink-0`}
                />
                <button
                  aria-label="행 삭제"
                  onClick={() => setDraft((l) => l.filter((_, j) => j !== i))}
                  className="shrink-0 text-slate-300 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setDraft((l) => [...l, { company: '', work: '', manager: '' }])}
              className="rounded border border-dashed border-slate-400 px-2 py-1 text-[11px] text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
            >
              ＋ 추가
            </button>
            <button
              onClick={() => void saveDraft()}
              disabled={saving}
              className="rounded bg-[#1f3864] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#2a4a80] disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button onClick={() => setEditing(false)} className="text-[11px] text-slate-400 hover:text-slate-200">
              취소
            </button>
            <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${modeBadge(mode).className}`}>
              {mode === 'server' ? '☁️ 공유' : '💻 로컬'}
            </span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center">
          <p className="text-sm text-slate-400">
            {tab === 'today' ? '당일' : '명일'} 등록된 작업계획이 없습니다
            <span className="mt-1 block text-xs text-slate-300">✏️ 버튼으로 입력할 수 있습니다</span>
          </p>
        </div>
      ) : (
        <ul className="max-h-40 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <span className="shrink-0 rounded bg-[#1f3864] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {it.company}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={it.work}>
                {it.work}
              </span>
              {it.manager && <span className="shrink-0 text-[11px] text-slate-500">{it.manager}</span>}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
        {lastUpdate ? `최근 갱신 ${lastUpdate}` : '입력 대기'} · {saved ? '직접 입력' : '그룹웨어 작업계획 기준'}
      </p>
    </div>
  );
}
