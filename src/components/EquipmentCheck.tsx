'use client';

import { useState } from 'react';
import { EQUIP_TYPES, type EquipType } from '@/lib/equipment';
import AirDistributorSheet from './AirDistributorSheet';

/**
 * 공무관리 › 장비점검 — 장비 종류별 탭.
 * 새 장비를 추가할 때는 lib/equipment.ts의 EQUIP_TYPES에 종류를 넣고
 * 아래 switch에 해당 시트를 연결하면 탭이 자동으로 생긴다.
 */
export default function EquipmentCheck() {
  const [tab, setTab] = useState<EquipType>(EQUIP_TYPES[0]);

  const tabBtn = (active: boolean) =>
    `rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-bold ${
      active
        ? 'border-slate-200 bg-white text-[#1f3864]'
        : 'border-transparent bg-slate-100 text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap gap-1">
        {EQUIP_TYPES.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tabBtn(tab === t)}>
            🔧 {t}
          </button>
        ))}
        <span className="self-end px-3 pb-2 text-[11px] text-slate-400">장비를 추가하면 탭이 늘어납니다</span>
      </div>
      <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 shadow-sm">
        {tab === 'AIR분배기' && <AirDistributorSheet />}
      </div>
    </div>
  );
}
