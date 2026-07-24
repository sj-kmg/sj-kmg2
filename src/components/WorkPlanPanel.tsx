'use client';

import { useEffect, useState } from 'react';

interface WorkPlanItem {
  company: string; // 업체명(발주처)
  work: string; // 작업내용
  manager: string; // 담당자
}

interface WorkPlanDay {
  date: string; // YYYY-MM-DD
  items: WorkPlanItem[];
}

interface WorkPlan {
  updatedAt: string;
  source: string;
  days: WorkPlanDay[];
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDate(ds: string): string {
  const d = new Date(`${ds}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ds;
  return `${d.getMonth() + 1}/${d.getDate()} (${DOW[d.getDay()]})`;
}

/** 일자별 작업계획 — 그룹웨어에서 매일 갱신되는 workplan.json 표시, ◀▶로 일자 이동 */
export default function WorkPlanPanel() {
  const [plan, setPlan] = useState<WorkPlan | null>(null);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetch('/workplan.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: WorkPlan) => {
        const sorted = { ...d, days: [...(d.days ?? [])].sort((a, b) => a.date.localeCompare(b.date)) };
        setPlan(sorted);
        const today = todayStr();
        const ti = sorted.days.findIndex((day) => day.date === today);
        setIdx(ti >= 0 ? ti : Math.max(sorted.days.length - 1, 0));
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-400">작업계획을 불러오지 못했습니다.</p>;
  }
  if (!plan) {
    return <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-300">작업계획 불러오는 중…</p>;
  }

  const day = plan.days[idx];
  const today = todayStr();

  return (
    <div className="flex h-full flex-col">
      {/* 일자 이동 */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          disabled={idx <= 0}
          className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
          aria-label="이전 날짜"
        >
          ◀
        </button>
        <p className="text-sm font-bold text-slate-700">
          {day ? fmtDate(day.date) : '작업계획'}
          {day?.date === today && <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">오늘</span>}
          {day && day.date > today && <span className="ml-1.5 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">명일</span>}
        </p>
        <button
          onClick={() => setIdx((i) => Math.min(i + 1, plan.days.length - 1))}
          disabled={idx >= plan.days.length - 1}
          className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
          aria-label="다음 날짜"
        >
          ▶
        </button>
      </div>

      {/* 목록 */}
      {!day || day.items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center">
          <p className="text-sm text-slate-400">
            {plan.days.length === 0 ? '그룹웨어 연동 대기 중입니다' : '등록된 작업계획이 없습니다'}
            <span className="mt-1 block text-xs text-slate-300">{plan.source}</span>
          </p>
        </div>
      ) : (
        <ul className="max-h-40 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
          {day.items.map((it, i) => (
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
        {plan.updatedAt ? `최근 확인 ${plan.updatedAt}` : '연동 준비 중'} · 그룹웨어 작업계획 기준
      </p>
    </div>
  );
}
