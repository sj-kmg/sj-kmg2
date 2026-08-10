'use client';

import { useState } from 'react';
import { YNCC_WORKERS_KEY } from '@/lib/yncc';
import EduWorkerSheet from './EduWorkerSheet';

type Tab = '직원' | '인력';
const TABS: { key: Tab; icon: string }[] = [
  { key: '직원', icon: '🧑‍💼' },
  { key: '인력', icon: '👷' },
];

/** 공무관리 > 안전교육 > YNCC출입 — 직원/인력 탭 */
export default function YnccWorkers() {
  const [tab, setTab] = useState<Tab>('직원');

  const tabBtn = (active: boolean) =>
    `rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-bold ${
      active ? 'border-slate-200 bg-white text-[#1f3864]' : 'border-transparent bg-slate-100 text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="w-full">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tabBtn(tab === t.key)}>
            {t.icon} {t.key}
          </button>
        ))}
      </div>
      <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 shadow-sm">
        <EduWorkerSheet logType="yncc-workers" localKey={YNCC_WORKERS_KEY} group={tab} variant="yncc" />
      </div>
    </div>
  );
}
