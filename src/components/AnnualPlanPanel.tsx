'use client';

import { useEffect, useState } from 'react';
import {
  ANNUAL_PLAN_KEY,
  ANYTIME_TASKS,
  MONTHLY_TASKS,
  MONTH_LABEL,
  PERIOD_META,
  checkId,
  currentPhase,
  specialTasksOf,
  type AnnualTask,
  type PlanCheck,
} from '@/lib/annualPlan';
import { useSyncedLog } from '@/lib/useSyncedLog';

/**
 * 메인 [업무관리] 패널 — 이번 달 해야 할 일을 시기별로 묶어 바로 처리.
 * 오늘이 월초(1~10일)/월말(말일 10일 전~)이면 해당 묶음이 먼저 펼쳐진다.
 */
export default function AnnualPlanPanel({ onOpenPlan }: { onOpenPlan?: () => void }) {
  const { entries, mode, add } = useSyncedLog<PlanCheck>('annual-plan', ANNUAL_PLAN_KEY);
  const [now, setNow] = useState<{ year: number; month: number; phase: '월초' | '월말' | '중순' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date();
    setNow({ year: d.getFullYear(), month: d.getMonth() + 1, phase: currentPhase(d) });
  }, []);

  if (!now) return null;
  const { year, month, phase } = now;

  const isDone = (t: AnnualTask) => entries.find((e) => e.id === checkId(year, month, t.id))?.done ?? false;

  const toggle = async (t: AnnualTask) => {
    if (busy) return;
    const id = checkId(year, month, t.id);
    const cur = isDone(t);
    setBusy(id);
    try {
      await add({
        id,
        year,
        month,
        taskId: t.id,
        done: !cur,
        doneAt: !cur ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(null);
    }
  };

  const special = specialTasksOf(month);
  const early = MONTHLY_TASKS.filter((t) => t.period === '월초');
  const late = MONTHLY_TASKS.filter((t) => t.period === '월말');
  // 오늘 구간을 먼저 배치
  const groups: { key: string; label: string; tasks: AnnualTask[]; hot: boolean }[] = [
    ...(special.length > 0 ? [{ key: 'special', label: `${MONTH_LABEL[month - 1]} 연간업무`, tasks: special, hot: true }] : []),
    { key: '월초', label: '월초 (1~10일)', tasks: early, hot: phase === '월초' },
    { key: '월말', label: '월말 (10일 전~)', tasks: late, hot: phase === '월말' },
  ].sort((a, b) => Number(b.hot) - Number(a.hot));

  const allTasks = [...special, ...MONTHLY_TASKS];
  const doneCount = allTasks.filter(isDone).length;

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-lg bg-gradient-to-br from-cyan-500/25 to-blue-600/20 px-2.5 py-1 text-xs font-bold text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]">
          {MONTH_LABEL[month - 1]}
        </span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
          오늘 {phase === '중순' ? '중순' : phase}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
              style={{ width: `${(doneCount / allTasks.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            {doneCount}/{allTasks.length}
          </span>
          {onOpenPlan && (
            <button onClick={onOpenPlan} className="text-[11px] font-medium text-sky-600 hover:underline">
              연간 →
            </button>
          )}
        </div>
      </div>

      {/* 시기별 할 일 */}
      <div className="max-h-52 flex-1 space-y-2 overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-0.5 flex items-center gap-1.5 px-1">
              <span className={`text-[10px] font-bold ${g.hot ? 'text-cyan-300' : 'text-slate-400'}`}>{g.label}</span>
              {g.hot && (
                <span aria-hidden className="h-1 w-1 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
              )}
              <span className="ml-auto font-mono text-[9px] text-slate-400">
                {g.tasks.filter(isDone).length}/{g.tasks.length}
              </span>
            </p>
            <ul className="space-y-0.5">
              {g.tasks.map((t) => {
                const done = isDone(t);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => void toggle(t)}
                      disabled={busy === checkId(year, month, t.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/5 ${
                        done ? 'opacity-45' : ''
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                          done ? 'border-cyan-400 bg-cyan-400/25 text-cyan-200' : 'border-slate-300 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                      >
                        {t.title}
                      </span>
                      {t.period !== '월초' && t.period !== '월말' && (
                        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${PERIOD_META[t.period].badge}`}>
                          {t.period}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* 수시 업무 — 체크 없이 상시 참고 */}
        <div className="border-t border-slate-100 pt-1.5">
          <p className="mb-0.5 px-1 text-[10px] font-bold text-slate-400">수시</p>
          <p className="px-1 text-[11px] leading-relaxed text-slate-500">
            {ANYTIME_TASKS.map((t) => t.title).join(' · ')}
          </p>
        </div>
      </div>

      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
        항목을 누르면 완료 처리 · 매월 초기화 {mode === 'server' ? '· 모든 기기 공유' : '· 이 브라우저에 저장'}
      </p>
    </div>
  );
}
