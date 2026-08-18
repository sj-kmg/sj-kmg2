'use client';

import { useState } from 'react';
import AccessCardSheet from './AccessCardSheet';
import PassVehicleSheet from './PassVehicleSheet';

type Tab = '상시카드' | '상시차량';
const TABS: { key: Tab; icon: string }[] = [
  { key: '상시카드', icon: '💳' },
  { key: '상시차량', icon: '🚗' },
];

/** 공무관리 › 출입신청 › LG 상시카드&차량 */
export default function AccessPass() {
  const [tab, setTab] = useState<Tab>('상시카드');

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
        {tab === '상시카드' ? <AccessCardSheet /> : <PassVehicleSheet />}
      </div>
    </div>
  );
}
