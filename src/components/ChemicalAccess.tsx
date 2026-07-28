'use client';

import { useEffect, useMemo, useState } from 'react';
import { chemicalSeedWorkers } from '@/lib/education';
import { CHEM_WORKERS_KEY } from '@/lib/yncc';
import EduWorkerSheet from './EduWorkerSheet';

type Tab = '직원' | '인력';
const TABS: { key: Tab; icon: string }[] = [
  { key: '직원', icon: '🧑‍💼' },
  { key: '인력', icon: '👷' },
];

/** 공무관리 > 안전교육 > 유해화학물질 — 직원/인력 입력 시트 (기존 수료증 명부는 직원으로 통합) */
export default function ChemicalAccess({ initialTab = '직원' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  // 정적 수료증 명부 → 직원 시트 초기 데이터
  const seed = useMemo(() => chemicalSeedWorkers(), []);

  const tabBtn = (active: boolean) =>
    `rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-bold ${
      active ? 'border-slate-200 bg-white text-[#1f3864]' : 'border-transparent bg-slate-100 text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tabBtn(tab === t.key)}>
            {t.icon} {t.key}
          </button>
        ))}
      </div>
      <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 shadow-sm">
        <EduWorkerSheet
          logType="chem-workers"
          localKey={CHEM_WORKERS_KEY}
          group={tab}
          variant="chem"
          seed={seed}
        />
      </div>
    </div>
  );
}
