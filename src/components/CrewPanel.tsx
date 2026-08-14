'use client';

import { useMemo } from 'react';
import type { OpsData } from '@/lib/useOps';
import { laborColor, siteColor, staffNames } from '@/lib/workforce';

const STAFF_COLOR = '#e7ecf9';

interface Slice {
  label: string;
  value: number;
  color: string;
}

/**
 * 인원 배치 현황 — 선택한 날짜의 투입 인원을 소속(직원/인력 구분)과 현장별로 나눠 본다.
 * "누가 어디에 몇 명" 이 한 화면에서 끝나도록 도넛 + 현장별 막대를 함께 둔다.
 */
export default function CrewPanel({ ops, date }: { ops: OpsData; date: string }) {
  const day = ops.dayOf(date);

  const { slices, total, bySite } = useMemo(() => {
    const cat = new Map<string, number>();
    let staff = 0;
    const site = new Map<string, { staff: number; labor: number }>();

    for (const e of day.entries) {
      const s = staffNames(e.staff).length;
      const l = e.laborRows?.length ?? (Number(e.laborCount) || 0);
      staff += s;
      for (const r of e.laborRows ?? []) {
        const k = r.category || '기타';
        cat.set(k, (cat.get(k) ?? 0) + 1);
      }
      const prev = site.get(e.site) ?? { staff: 0, labor: 0 };
      site.set(e.site, { staff: prev.staff + s, labor: prev.labor + l });
    }

    const list: Slice[] = [];
    if (staff > 0) list.push({ label: '직원', value: staff, color: STAFF_COLOR });
    [...cat.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => list.push({ label: k, value: v, color: laborColor(k) }));

    const sum = list.reduce((a, s) => a + s.value, 0);
    const sites = [...site.entries()]
      .map(([name, v]) => ({ name, ...v, total: v.staff + v.labor }))
      .sort((a, b) => b.total - a.total);

    return { slices: list, total: sum, bySite: sites };
  }, [day]);

  if (total === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-4 text-center">
        <p className="text-2xl" aria-hidden>
          👷
        </p>
        <p className="mt-1.5 text-sm font-medium text-slate-500">투입 인원 기록이 없습니다</p>
        <p className="mt-1 text-xs text-slate-400">날짜를 바꾸거나 작업인원을 기록해 주세요.</p>
      </div>
    );
  }

  const maxSite = Math.max(...bySite.map((s) => s.total), 1);

  return (
    <div className="flex h-full flex-col">
      {/* 도넛 + 범례 */}
      <div className="flex items-center gap-4">
        <Donut slices={slices} total={total} />
        <ul className="min-w-0 flex-1 space-y-1">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 truncate text-[11px] text-slate-500">{s.label}</span>
              <span className="ml-auto shrink-0 font-mono text-xs font-bold text-slate-700">{s.value}</span>
              <span className="w-9 shrink-0 text-right font-mono text-[10px] text-slate-400">
                {Math.round((s.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 현장별 인원 */}
      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <p className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400">현장별 배치</p>
        <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
          {bySite.map((s) => (
            <li key={s.name}>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: siteColor(s.name) }} />
                <span className="min-w-0 truncate text-[11px] font-semibold text-slate-600">{s.name}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-slate-400">
                  직원 {s.staff} · 인력 {s.labor}
                </span>
                <span className="w-7 shrink-0 text-right font-mono text-xs font-bold text-slate-800">{s.total}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(s.total / maxSite) * 100}%`,
                    background: `linear-gradient(90deg, ${siteColor(s.name)}, ${siteColor(s.name)}66)`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 소속 비율 도넛 */
function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="relative shrink-0">
      <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`총 투입 인원 ${total}명`}>
        <circle cx="46" cy="46" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="13" />
        {slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.label}
              cx="46"
              cy="46"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="13"
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 46 46)"
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="hud-num font-mono text-xl font-bold leading-none">{total}</span>
        <span className="mt-0.5 text-[9px] text-slate-400">총 인원</span>
      </span>
    </div>
  );
}
