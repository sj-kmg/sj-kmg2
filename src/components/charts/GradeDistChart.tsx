'use client';

import { useState } from 'react';
import { GRADES } from '@/lib/risk';
import type { RiskRow } from '@/lib/types';

const W = 560;
const H = 260;
const PAD = { top: 24, right: 12, bottom: 44, left: 40 };

/** 위험등급 분포 (현재 위험성 기준) */
export default function GradeDistChart({ risks }: { risks: RiskRow[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const counts = GRADES.map((g) => risks.filter((r) => r.grade === g.key).length);
  const maxCount = Math.max(...counts, 1);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / GRADES.length;
  const barW = Math.min(band * 0.62, 64);

  const ticks = niceTicks(maxCount);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="위험등급별 유해위험요인 건수 분포">
        {/* 가로 격자선 + y축 눈금 */}
        {ticks.map((t) => {
          const y = PAD.top + plotH - (t / ticks[ticks.length - 1]) * plotH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e1e0d9" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#898781">
                {t}
              </text>
            </g>
          );
        })}
        {/* 기준선 */}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#c3c2b7" strokeWidth={1} />

        {GRADES.map((g, i) => {
          const h = (counts[i] / ticks[ticks.length - 1]) * plotH;
          const x = PAD.left + band * i + (band - barW) / 2;
          const y = PAD.top + plotH - h;
          return (
            <g
              key={g.key}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* 히트 영역(막대보다 넓게) */}
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" />
              {counts[i] > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={4}
                  fill={g.fill}
                  stroke={hover === i ? '#0b0b0b' : g.border}
                  strokeWidth={1}
                />
              )}
              {/* 값 라벨 — 잉크 색으로 (연한 막대색 보완) */}
              <text
                x={x + barW / 2}
                y={counts[i] > 0 ? y - 6 : PAD.top + plotH - 6}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#0b0b0b"
              >
                {counts[i]}
              </text>
              {/* x축 라벨: 등급명 + 범위 */}
              <text x={PAD.left + band * i + band / 2} y={H - 26} textAnchor="middle" fontSize={12} fill="#52514e">
                {g.label}
              </text>
              <text x={PAD.left + band * i + band / 2} y={H - 11} textAnchor="middle" fontSize={10} fill="#898781">
                R {g.range}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${((PAD.left + (plotW / GRADES.length) * (hover + 0.5)) / W) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-bold text-slate-800">
            {GRADES[hover].label} (R {GRADES[hover].range})
          </p>
          <p className="text-slate-600">
            {counts[hover]}건
            {risks.length > 0 && ` · ${Math.round((counts[hover] / risks.length) * 100)}%`}
          </p>
        </div>
      )}
    </div>
  );
}

function niceTicks(max: number): number[] {
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : 50;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return ticks;
}
