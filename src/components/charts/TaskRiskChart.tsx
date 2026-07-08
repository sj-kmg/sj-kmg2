'use client';

import { useState } from 'react';
import type { TaskRow } from '@/lib/types';

const W = 560;
const ROW_H = 26;
const PAD = { top: 8, right: 16, bottom: 28, left: 128 };
const R_MAX = 20;

const AVG_COLOR = '#2a78d6';
const MAX_COLOR = '#104281';

/** 작업별 평균·최고 위험성 비교 (가로 막대 + 최고값 눈금 마커) */
export default function TaskRiskChart({ tasks }: { tasks: TaskRow[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const sorted = [...tasks]
    .filter((t) => t.avgR !== null)
    .sort((a, b) => (b.avgR ?? 0) - (a.avgR ?? 0));
  const H = PAD.top + PAD.bottom + sorted.length * ROW_H;
  const plotW = W - PAD.left - PAD.right;
  const x = (v: number) => PAD.left + (v / R_MAX) * plotW;

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: AVG_COLOR }} />
          평균 위험성
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-1 rounded-sm" style={{ backgroundColor: MAX_COLOR }} />
          최고 위험성
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="작업별 평균 및 최고 위험성 비교">
        {[0, 5, 10, 15, 20].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom} stroke={t === 0 ? '#c3c2b7' : '#e1e0d9'} strokeWidth={1} />
            <text x={x(t)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize={11} fill="#898781">
              {t}
            </text>
          </g>
        ))}
        <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize={10} fill="#898781">
          위험성 R (F×S, 최대 20)
        </text>

        {sorted.map((t, i) => {
          const yc = PAD.top + ROW_H * i + ROW_H / 2;
          const barH = 12;
          return (
            <g key={t.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={PAD.top + ROW_H * i} width={W} height={ROW_H} fill={hover === i ? '#f1f5f9' : 'transparent'} />
              <text x={PAD.left - 8} y={yc + 4} textAnchor="end" fontSize={11} fill="#52514e">
                {t.name.length > 14 ? `${t.name.slice(0, 13)}…` : t.name}
              </text>
              <rect
                x={x(0)}
                y={yc - barH / 2}
                width={Math.max(x(t.avgR ?? 0) - x(0), 2)}
                height={barH}
                rx={3}
                fill={AVG_COLOR}
              />
              {t.maxR !== null && (
                <rect x={x(t.maxR) - 1.5} y={yc - 9} width={3} height={18} rx={1} fill={MAX_COLOR} />
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && sorted[hover] && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: '55%',
            top: `${((PAD.top + ROW_H * hover) / H) * 100}%`,
            transform: 'translateY(-100%)',
          }}
        >
          <p className="font-bold text-slate-800">{sorted[hover].name}</p>
          <p className="text-slate-600">
            평균 R {sorted[hover].avgR} · 최고 R {sorted[hover].maxR} · 요인 {sorted[hover].count}건
          </p>
          {sorted[hover].avgR2 !== null && <p className="text-slate-500">개선 후 평균 R {sorted[hover].avgR2}</p>}
        </div>
      )}
    </div>
  );
}
