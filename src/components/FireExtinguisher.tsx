'use client';

import { useState } from 'react';
import HqExtinguisherSheet from './HqExtinguisherSheet';
import VehicleExtinguisherSheet from './VehicleExtinguisherSheet';

type Tab = '본사' | '차량';
const TABS: { key: Tab; icon: string }[] = [
  { key: '본사', icon: '🏢' },
  { key: '차량', icon: '🚗' },
];

/** 공무관리 › 소화기관리 — 본사/차량 소화기 탭 */
export default function FireExtinguisher() {
  const [tab, setTab] = useState<Tab>('본사');

  const tabBtn = (active: boolean) =>
    `rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-bold ${
      active ? 'border-slate-200 bg-white text-[#1f3864]' : 'border-transparent bg-slate-100 text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="w-full">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tabBtn(tab === t.key)}>
            {t.icon} {t.key} 소화기
          </button>
        ))}
      </div>
      <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 shadow-sm">
        {tab === '본사' ? <HqExtinguisherSheet /> : <VehicleExtinguisherSheet />}
      </div>
    </div>
  );
}
