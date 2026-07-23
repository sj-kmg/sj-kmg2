'use client';

import { useState } from 'react';
import type { ScheduleRow } from '@/lib/types';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export default function CalendarPanel({ schedule }: { schedule: ScheduleRow[] }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const startDow = new Date(ym.y, ym.m, 1).getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const marked = new Set(schedule.map((s) => s.date));
  const dstr = (d: number) => `${ym.y}-${pad2(ym.m + 1)}-${pad2(d)}`;
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  const move = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="text-center">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => move(-1)} className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-100" aria-label="이전 달">
          ‹
        </button>
        <p className="text-sm font-bold text-slate-700">
          {ym.y}년 {ym.m + 1}월
        </p>
        <button onClick={() => move(1)} className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-100" aria-label="다음 달">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-xs">
        {DOW.map((d, i) => (
          <div key={d} className={`py-1 font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const ds = dstr(d);
          const isToday = ds === todayStr;
          const has = marked.has(ds);
          return (
            <div key={i} className="flex flex-col items-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-[#1f3864] font-bold text-white'
                    : i % 7 === 0
                      ? 'text-red-500'
                      : i % 7 === 6
                        ? 'text-blue-500'
                        : 'text-slate-700'
                }`}
              >
                {d}
              </span>
              <span className={`mt-0.5 h-1 w-1 rounded-full ${has ? 'bg-orange-500' : 'bg-transparent'}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
