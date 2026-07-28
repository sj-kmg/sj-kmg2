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
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';

/** 공무관리 › 공무연간계획 — 해당 연도의 시기별 업무를 월별로 정리 */
export default function AnnualPlan() {
  const { entries, mode, add } = useSyncedLog<PlanCheck>('annual-plan', ANNUAL_PLAN_KEY);
  const [year, setYear] = useState<number | null>(null);
  const [thisMonth, setThisMonth] = useState(0);
  const [phase, setPhase] = useState<'월초' | '월말' | '중순'>('중순');
  const [busy, setBusy] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => {
    const d = new Date();
    setYear(d.getFullYear());
    setThisMonth(d.getMonth() + 1);
    setPhase(currentPhase(d));
  }, []);

  if (!year) return null;

  const isDone = (m: number, t: AnnualTask) => entries.find((e) => e.id === checkId(year, m, t.id))?.done ?? false;

  const toggle = async (m: number, t: AnnualTask) => {
    if (busy) return;
    const id = checkId(year, m, t.id);
    const cur = isDone(m, t);
    setBusy(id);
    try {
      await add({
        id,
        year,
        month: m,
        taskId: t.id,
        done: !cur,
        doneAt: !cur ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(null);
    }
  };

  // 연간 진행률 — 월별 (특정 시기 + 매월 반복) 전체 기준
  let total = 0;
  let totalDone = 0;
  for (let m = 1; m <= 12; m++) {
    const list = [...specialTasksOf(m), ...MONTHLY_TASKS];
    total += list.length;
    totalDone += list.filter((t) => isDone(m, t)).length;
  }
  const badge = modeBadge(mode);

  const TaskRow = ({ m, t }: { m: number; t: AnnualTask }) => {
    const done = isDone(m, t);
    if (hideDone && done) return null;
    return (
      <li>
        <button
          onClick={() => void toggle(m, t)}
          disabled={busy === checkId(year, m, t.id)}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/5 ${done ? 'opacity-50' : ''}`}
        >
          <span
            aria-hidden
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
              done ? 'border-cyan-400 bg-cyan-400/25 text-cyan-200' : 'border-slate-300 text-transparent'
            }`}
          >
            ✓
          </span>
          <span className={`min-w-0 flex-1 text-xs ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
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
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* 요약 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setYear(year - 1)} aria-label="이전 연도" className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-100">
            ◀
          </button>
          <h3 className="font-mono text-lg font-bold text-slate-800">{year}년</h3>
          <button onClick={() => setYear(year + 1)} aria-label="다음 연도" className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-100">
            ▶
          </button>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          <button
            onClick={() => setHideDone(!hideDone)}
            className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            {hideDone ? '전체 보기' : '미완료만 보기'}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700"
              style={{ width: `${total ? (totalDone / total) * 100 : 0}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-sm font-bold text-slate-700">
            {totalDone} / {total}
          </span>
        </div>
        {/* 수시 업무 */}
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2">
          <p className="text-[11px] font-bold text-slate-500">수시 — 발생 시 상시 처리</p>
          <p className="mt-0.5 text-xs text-slate-600">{ANYTIME_TASKS.map((t) => t.title).join(' · ')}</p>
        </div>
      </div>

      {/* 월별 카드 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MONTH_LABEL.map((label, i) => {
          const m = i + 1;
          const special = specialTasksOf(m);
          const early = MONTHLY_TASKS.filter((t) => t.period === '월초');
          const late = MONTHLY_TASKS.filter((t) => t.period === '월말');
          const all = [...special, ...MONTHLY_TASKS];
          const done = all.filter((t) => isDone(m, t)).length;
          const current = m === thisMonth;
          return (
            <section key={m} className={`rounded-xl border bg-white shadow-sm ${current ? 'border-cyan-400/50' : 'border-slate-200'}`}>
              <header className="flex items-center gap-2 px-3 py-2">
                <span
                  aria-hidden
                  className={`h-3.5 w-1 shrink-0 rounded-full ${
                    current ? 'bg-gradient-to-b from-cyan-300 to-blue-600 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-300'
                  }`}
                />
                <h4 className={`text-sm font-bold ${current ? 'text-cyan-300' : 'text-slate-700'}`}>{label}</h4>
                {current && (
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">
                    이번 달{phase !== '중순' ? ` · ${phase}` : ''}
                  </span>
                )}
                {done === all.length && all.length > 0 && (
                  <span className="text-[9px] font-bold text-green-600">완료</span>
                )}
                <span className="ml-auto font-mono text-[10px] text-slate-400">
                  {done}/{all.length}
                </span>
              </header>
              <div className="space-y-1.5 border-t border-slate-100 p-2">
                {special.length > 0 && (
                  <div>
                    <p className="px-2 text-[10px] font-bold text-slate-400">연간 업무</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {special.map((t) => (
                        <TaskRow key={t.id} m={m} t={t} />
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="px-2 text-[10px] font-bold text-slate-400">월초 (1~10일)</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {early.map((t) => (
                      <TaskRow key={t.id} m={m} t={t} />
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="px-2 text-[10px] font-bold text-slate-400">월말 (10일 전~)</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {late.map((t) => (
                      <TaskRow key={t.id} m={m} t={t} />
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        사내 공무 연간계획 기준 — 년초·년2회(1월·7월)·연말·혹서기(6월)·혹한기(12월) 업무와 매월 반복되는 월초·월말 업무를
        월별로 정리했습니다. 항목을 클릭하면 완료 처리되고 연·월별로 저장되어 매월 새로 시작됩니다.
      </p>
    </div>
  );
}
