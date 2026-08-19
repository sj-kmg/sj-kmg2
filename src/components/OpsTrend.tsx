'use client';

import { useMemo } from 'react';
import type { OpsData } from '@/lib/useOps';
import { ymd } from '@/lib/workforce';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 투입 추세 — 오늘을 가운데 두고 지난 날짜와 앞으로의 날짜를 함께 본다.
 * 기준이 늘 오늘이라 어느 날짜를 골라도 그래프가 흔들리지 않는다.
 * 막대를 누르면 그 날짜로 보드가 이동한다.
 */
export default function OpsTrend({
  ops,
  date,
  onSelect,
  days = 15,
}: {
  ops: OpsData;
  date: string;
  onSelect: (d: string) => void;
  days?: number;
}) {
  const today = ymd(new Date());
  const series = useMemo(() => {
    // 오늘이 한가운데 오도록 앞뒤로 나눈다 (15일이면 지난 7일 + 오늘 + 앞으로 7일)
    const half = Math.floor(days / 2);
    const anchor = new Date(`${today}T00:00:00`);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() - half + i);
      const key = ymd(d);
      const day = ops.byDate.get(key);
      return {
        key,
        dow: d.getDay(),
        label: String(d.getDate()),
        head: day?.headcount ?? 0,
        sites: day?.sites.length ?? 0,
        future: key > today,
      };
    });
  }, [ops.byDate, today, days]);

  const max = Math.max(...series.map((s) => s.head), 1);
  const active = series.filter((s) => s.head > 0);
  const avg = active.length ? Math.round(active.reduce((a, s) => a + s.head, 0) / active.length) : 0;
  const peak = series.reduce((a, s) => (s.head > a.head ? s : a), series[0]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-end gap-3">
        <div>
          <p className="text-[10px] text-slate-400">가동일 평균</p>
          <p className="font-mono text-xl font-bold text-slate-800">
            {avg}
            <span className="ml-0.5 text-[11px] font-normal text-slate-400">명/일</span>
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] text-slate-400">최다 투입</p>
          <p className="font-mono text-sm font-bold text-cyan-700">
            {peak.head}명 <span className="text-[10px] font-normal text-slate-400">({peak.key.slice(5)})</span>
          </p>
        </div>
      </div>

      {/* 막대 */}
      <div className="flex flex-1 items-end gap-[3px]" style={{ minHeight: '92px' }}>
        {series.map((s) => {
          const sel = s.key === date;
          const isToday = s.key === today;
          const h = s.head === 0 ? 3 : Math.max((s.head / max) * 100, 8);
          return (
            <button
              key={s.key}
              onClick={() => onSelect(s.key)}
              title={`${s.key} · 인원 ${s.head}명 · 현장 ${s.sites}곳`}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
              aria-label={`${s.key} 인원 ${s.head}명`}
            >
              <span
                className={`mb-0.5 text-center font-mono text-[9px] leading-none ${
                  sel ? 'text-slate-800' : 'text-transparent group-hover:text-slate-400'
                }`}
              >
                {s.head || ''}
              </span>
              <span
                className="w-full rounded-t-[3px]"
                style={{
                  height: `${h}%`,
                  background: sel
                    ? 'linear-gradient(180deg, #7aa2ff, #4b7bff)'
                    : isToday
                      ? 'linear-gradient(180deg, #22d3ee, #4b7bff)'
                      : s.head === 0
                        ? 'var(--surface-3)'
                        : `linear-gradient(180deg, rgba(75,123,255,${s.future ? 0.35 : 0.75}), rgba(75,123,255,0.18))`,
                  boxShadow: sel || isToday ? '0 0 14px -2px rgba(75,123,255,0.9)' : 'none',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* 날짜 눈금 */}
      <div className="mt-1 flex gap-[3px] border-t border-slate-100 pt-1">
        {series.map((s) => (
          <span
            key={s.key}
            className={`min-w-0 flex-1 text-center font-mono text-[8px] ${
              s.key === today
                ? 'font-bold text-cyan-600'
                : s.key === date
                  ? 'font-bold text-slate-700'
                  : s.dow === 0
                    ? 'text-red-400'
                    : s.dow === 6
                      ? 'text-sky-400'
                      : 'text-slate-400'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        막대 = 총 투입 인원 · 오늘 기준 앞뒤 {Math.floor(days / 2)}일 ({DOW[series[0].dow]}~
        {DOW[series[series.length - 1].dow]})
      </p>
    </div>
  );
}
