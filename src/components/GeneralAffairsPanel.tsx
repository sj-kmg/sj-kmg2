'use client';

import { useEffect, useState } from 'react';
import { CARD_NOTICE_DAYS, VEHICLE_NOTICE_DAYS } from '@/lib/cards';
import { NOTICE_STYLE } from '@/lib/education';
import { collectGeneralAffairsStatus, type GaDueItem, type GaUpcoming } from '@/lib/generalAffairsLive';

/**
 * 메인 [공무관리 현황] 패널 — 공무관리(신청현황 등)에서 D-day 관리가 필요한 항목을 모아 표시.
 * 상시카드·상시차량·건강검진·장비 점검을 함께 본다.
 * 차량점검내역·측정기 검교정은 건수가 많아 목록을 덮어 버려 각자의 메뉴에서만 본다.
 */
export default function GeneralAffairsPanel() {
  const [due, setDue] = useState<GaDueItem[] | null>(null);
  const [next, setNext] = useState<GaUpcoming | null>(null);

  useEffect(() => {
    void collectGeneralAffairsStatus(new Date()).then(({ due, upcoming }) => {
      setDue(due);
      if (upcoming.length > 0) setNext(upcoming[0]);
    });
  }, []);

  if (!due) return null;

  if (due.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center">
          <p className="text-2xl" aria-hidden>✅</p>
          <p className="mt-1.5 text-sm font-medium text-slate-500">만료 도래 대상이 없습니다</p>
          {next && (
            <p className="mt-1 text-xs text-slate-400">
              다음 만료: <b>{next.name}</b> · {next.kind} {next.date} (D-{next.days})
            </p>
          )}
        </div>
        <Footnote />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="max-h-44 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
        {due.map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-1.5">
            <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${NOTICE_STYLE[r.level].badge}`}>
              {r.days < 0 ? `D+${-r.days}` : `D-${r.days}`}
            </span>
            <span className="shrink-0 text-xs font-semibold text-slate-700">{r.name}</span>
            <span className="min-w-0 truncate text-[11px] text-slate-500">{r.kind}</span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">{r.date}</span>
          </li>
        ))}
      </ul>
      <Footnote />
    </div>
  );
}

function Footnote() {
  return (
    <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
      상시카드 D-{CARD_NOTICE_DAYS} · 상시차량/건강검진/장비 점검 D-{VEHICLE_NOTICE_DAYS}부터 표시 · 공무관리 메뉴와
      연동
    </p>
  );
}
