'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANNUAL_PLAN_KEY,
  ANNUAL_PLAN_TASKS_KEY,
  ANNUAL_TASKS,
  ANYTIME_TASKS,
  MONTH_LABEL,
  PERIOD_META,
  checkId,
  currentPhase,
  monthlyTaskSeed,
  specialTasksOf,
  type AnnualTask,
  type MonthlyPeriod,
  type MonthlyTaskItem,
  type PlanCheck,
} from '@/lib/annualPlan';
import { CELL, SheetToolbar } from './SheetUI';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import SheetExport from './SheetExport';
import type { ExportSpec } from '@/lib/sheetExport';
import { useSheetLog } from '@/lib/useSheetLog';

/** 공무관리 › 공무연간계획 — 해당 연도의 시기별 업무를 월별로 정리 */
export default function AnnualPlan() {
  const { entries, mode, add } = useSyncedLog<PlanCheck>('annual-plan', ANNUAL_PLAN_KEY);
  const monthlySeed = useMemo(() => monthlyTaskSeed(), []);
  const monthly = useSheetLog<MonthlyTaskItem>('annual-plan-tasks', ANNUAL_PLAN_TASKS_KEY, {
    seed: monthlySeed,
    isBlank: (r) => !r.title.trim(),
    sort: (a, b) => (a.period === b.period ? 0 : a.period === '월초' ? -1 : 1),
  });

  const [year, setYear] = useState<number | null>(null);
  const [thisMonth, setThisMonth] = useState(0);
  const [phase, setPhase] = useState<'월초' | '월말' | '중순'>('중순');
  const [busy, setBusy] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const d = new Date();
    setYear(d.getFullYear());
    setThisMonth(d.getMonth() + 1);
    setPhase(currentPhase(d));
  }, []);

  if (!year) return null;

  const monthlyTasks: AnnualTask[] = monthly.rows
    .filter((r) => r.title.trim())
    .map((r) => ({ id: r.id, period: r.period, title: r.title, note: r.note }));

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

  const addMonthlyTask = (period: MonthlyPeriod) => {
    seq.current += 1;
    monthly.addRow({ id: `MT-${Date.now()}-${seq.current}`, period, title: '', updatedAt: '' });
  };

  const removeMonthlyTask = (t: MonthlyTaskItem) => {
    if (t.title.trim() && !confirm(`[${t.title}] 항목을 삭제할까요? 매월 목록에서 함께 사라집니다. 되돌리기로 복구할 수 있습니다.`)) return;
    void monthly.removeRow(t.id);
  };

  // 연간 진행률 — 월별 (특정 시기 + 매월 반복) 전체 기준
  let total = 0;
  let totalDone = 0;
  for (let m = 1; m <= 12; m++) {
    const list = [...specialTasksOf(m), ...monthlyTasks];
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
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-cyan-500/8 ${done ? 'opacity-50' : ''}`}
        >
          <span
            aria-hidden
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
              done ? 'border-cyan-600 bg-cyan-500/20 text-cyan-700' : 'border-slate-300 text-transparent'
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

  /**
   * 엑셀·인쇄에 넘길 표 — 보고 있는 해의 월별 계획과 완료 여부.
   * 한 줄이 '업무 1건'이고, 지정된 달마다 완료 표시를 칸으로 펼친다.
   */
  type PlanRow = { period: string; title: string; months: number[]; note: string };
  const exportSpec = (): ExportSpec<PlanRow> => {
    const rows: PlanRow[] = [
      ...ANNUAL_TASKS.map((t: AnnualTask) => ({
        period: t.period,
        title: t.title,
        months: t.months ?? [],
        note: t.note ?? '',
      })),
      ...monthly.rows.map((t) => ({
        period: t.period,
        title: t.title,
        months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        note: t.note ?? '',
      })),
    ];
    const doneAt = (taskTitle: string, m: number) => {
      const t =
        ANNUAL_TASKS.find((x: AnnualTask) => x.title === taskTitle) ??
        monthly.rows.find((x) => x.title === taskTitle);
      if (!t) return '';
      const rec = entries.find((e) => e.id === checkId(year, m, t.id));
      return rec?.done ? '완료' : '';
    };
    return {
      title: `${year}년 공무 연간계획`,
      landscape: true,
      columns: [
        { label: '구분', value: (r) => r.period, width: 12 },
        { label: '업무', value: (r) => r.title, align: 'left', width: 34 },
        ...Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
          label: `${m}월`,
          width: 6,
          value: (r: PlanRow) => (r.months.includes(m) ? doneAt(r.title, m) || '○' : ''),
        })),
        { label: '비고', value: (r) => r.note, align: 'left' as const, width: 18 },
      ],
      rows,
    };
  };

  return (
    <div className="w-full">
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
          <SheetExport spec={exportSpec} className="ml-auto" />
          <button
            onClick={() => setEditing(!editing)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
              editing
                ? 'border-[#1f3864] bg-[#1f3864] text-white'
                : 'border-slate-200 text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]'
            }`}
          >
            {editing ? '편집 완료' : '✎ 월별 항목 편집'}
          </button>
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

      {/* 월별 반복 항목 편집 — 여기서 바꾸면 1~12월 전체 카드에 함께 반영된다 */}
      {editing && (
        <div className="mb-4 rounded-xl border border-[#1f3864]/30 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-slate-700">매월 반복 항목 편집</p>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
            여기서 추가·수정·삭제하면 1~12월 카드 전체에 똑같이 반영됩니다. 회사 사정에 따라 매년 바뀌는 서류·업무를
            여기서 관리하세요.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['월초', '월말'] as const).map((period) => (
              <div key={period}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PERIOD_META[period].badge}`}>{period}</span>
                  <span className="text-[10px] text-slate-400">{PERIOD_META[period].hint}</span>
                  <button
                    onClick={() => addMonthlyTask(period)}
                    className="ml-auto rounded-md border border-dashed border-slate-400 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
                  >
                    ＋ 항목 추가
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {monthly.rows
                    .filter((r) => r.period === period)
                    .map((r) => (
                      <li key={r.id} className="flex items-center gap-1.5">
                        <input
                          aria-label={`${period} 항목명`}
                          placeholder="예: SAP 안전서류"
                          value={r.title}
                          onChange={(e) => monthly.setRow(r.id, { title: e.target.value })}
                          className={CELL}
                        />
                        <button
                          onClick={() => removeMonthlyTask(r)}
                          aria-label="항목 삭제"
                          className="shrink-0 text-slate-300 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  {monthly.rows.filter((r) => r.period === period).length === 0 && (
                    <li className="rounded-lg border-2 border-dashed border-slate-200 py-3 text-center text-[11px] text-slate-400">
                      등록된 항목이 없습니다
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <SheetToolbar
              addLabel="＋ 월초 항목 추가"
              onUndo={() => void monthly.undo()}
              canUndo={monthly.canUndo}
              save={null}
            />
          </div>
        </div>
      )}

      {/* 월별 카드 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MONTH_LABEL.map((label, i) => {
          const m = i + 1;
          const special = specialTasksOf(m);
          const early = monthlyTasks.filter((t) => t.period === '월초');
          const late = monthlyTasks.filter((t) => t.period === '월말');
          const all = [...special, ...monthlyTasks];
          const done = all.filter((t) => isDone(m, t)).length;
          const current = m === thisMonth;
          return (
            <section key={m} className={`rounded-xl border bg-white shadow-sm ${current ? 'border-cyan-500/50' : 'border-slate-200'}`}>
              <header className="flex items-center gap-2 px-3 py-2">
                <span
                  aria-hidden
                  className={`h-3.5 w-1 shrink-0 rounded-full ${
                    current ? 'bg-gradient-to-b from-cyan-300 to-blue-600 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-300'
                  }`}
                />
                <h4 className={`text-sm font-bold ${current ? 'text-cyan-700' : 'text-slate-700'}`}>{label}</h4>
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
        사내 공무 연간계획 기준 — 년초·년2회(비상시 계획 및 훈련 1월·7월 / 관리감독자 평가·법규 준수평가 6월·12월)·연말·혹서기(6월)·혹한기(12월) 업무와 매월 반복되는 월초·월말 업무를
        월별로 정리했습니다. 항목을 클릭하면 완료 처리되고 연·월별로 저장되어 매월 새로 시작됩니다. 매월 반복 항목은
        [✎ 월별 항목 편집]에서 추가·수정·삭제할 수 있습니다.
      </p>
    </div>
  );
}
