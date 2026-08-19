'use client';

import { useState } from 'react';
import { holidayName } from '@/lib/holidays';
import { ymd } from '@/lib/workforce';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 현장·인원 캘린더 — 날짜별로 "몇 개 현장이 돌았고 몇 명이 투입됐는지"를 한눈에 보여 준다.
 * 날짜를 고르면 아래 [현장 운영 보드]·[인원 배치]가 그 날짜 기준으로 바뀐다.
 */
export default function OpsCalendar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (date: string) => void;
}) {
  const now = new Date();
  const [ym, setYm] = useState(() => {
    const d = new Date(`${selected}T00:00:00`);
    const base = Number.isNaN(d.getTime()) ? now : d;
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  const startDow = new Date(ym.y, ym.m, 1).getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dstr = (d: number) => `${ym.y}-${pad2(ym.m + 1)}-${pad2(d)}`;
  const todayStr = ymd(now);

  const move = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  const goToday = () => {
    setYm({ y: now.getFullYear(), m: now.getMonth() });
    onSelect(todayStr);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 월 이동 */}
      <div className="mb-2 flex items-center gap-1">
        <button onClick={() => move(-1)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="이전 달">
          ‹
        </button>
        <p className="font-mono text-sm font-bold text-slate-800">
          {ym.y}.{pad2(ym.m + 1)}
        </p>
        <button onClick={() => move(1)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="다음 달">
          ›
        </button>
        <button
          onClick={goToday}
          className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-800"
        >
          오늘
        </button>
      </div>

      {/* 날짜 격자 */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={`pb-1 text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'}`}
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const ds = dstr(d);
          const isToday = ds === todayStr;
          const isSel = ds === selected;
          const dow = i % 7;
          const holiday = holidayName(ds);
          /* 날짜 색은 요일·공휴일로만 정한다 — 오늘이든 고른 날이든 바뀌지 않는다 */
          const dayColor = holiday || dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-600';
          return (
            <button
              key={i}
              onClick={() => onSelect(ds)}
              title={`${ds}${holiday ? ` · ${holiday}` : ''}`}
              className={`flex min-h-[34px] items-center justify-center rounded-lg border px-0.5 py-1 ${
                isSel
                  ? 'border-blue-500/70 bg-blue-500/15 shadow-[0_0_16px_-4px_rgba(75,123,255,0.8)]'
                  : 'border-transparent hover:bg-slate-100'
              }`}
            >
              {/* 오늘은 테두리로만 표시해 요일·공휴일 색을 가리지 않는다 */}
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[11px] font-bold leading-none ${dayColor} ${
                  isToday ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent' : ''
                }`}
              >
                {d}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-3 w-3 rounded-full ring-2 ring-cyan-400" />
          오늘
        </span>
        <span className="flex items-center gap-1">
          <span className="font-bold text-blue-500">6</span>= 토요일
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono font-bold text-red-500">1</span>= 공휴일
        </span>
      </p>
    </div>
  );
}
