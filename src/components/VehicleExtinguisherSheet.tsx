'use client';

import { useMemo } from 'react';
import {
  EXT_VEHICLE_KEY,
  VEHICLE_EXT_STATUSES,
  vehicleExtinguisherSeed,
  type VehicleExtinguisher,
} from '@/lib/extinguisher';
import { modeBadge } from '@/lib/useSyncedLog';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { useSortable } from '@/lib/useSortable';
import { CELL, SheetToolbar, SortButton, TD_STICKY_POS, TH, TH_STICKY } from './SheetUI';

const STATUS_STYLE: Record<VehicleExtinguisher['status'], string> = {
  '비치(신규)': 'text-cyan-700',
  '비치(기존)': 'text-slate-600',
  미비치: 'text-red-600 font-bold',
};

/** 공무관리 › 소화기관리 › 차량 소화기 — 차량별 소화기 비치현황 */
export default function VehicleExtinguisherSheet() {
  const seed = useMemo(() => vehicleExtinguisherSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<VehicleExtinguisher>(
    'extinguisher-vehicle',
    EXT_VEHICLE_KEY,
    {
      seed,
      isBlank: (r) => !r.plate.trim(),
      sort: (a, b) => a.plate.localeCompare(b.plate, 'ko'),
    },
  );

  const add = () => {
    addRow({
      id: `EXT-veh-${Date.now()}`,
      plate: '',
      vehicleType: '',
      spec: '',
      status: '비치(신규)',
      checkedAt: '',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: VehicleExtinguisher) => {
    if (r.plate.trim() && !confirm(`[${r.plate}] 차량 소화기 기록을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);
  const sortCtl = useSortable<VehicleExtinguisher>();
  const shown = sortCtl.apply(rows, { plate: (r) => r.plate, checked: (r) => r.checkedAt ?? '' });
  const missing = rows.filter((r) => r.status === '미비치').length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          🧯 차량 소화기 비치현황
          <span className="ml-1.5 font-normal text-slate-400">{rows.length}대</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        {missing > 0 && (
          <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">미비치 {missing}대</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[850px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className={`${TH} ${TH_STICKY} w-28`}>차량번호<SortButton ctl={sortCtl} col="plate" label="차량번호" /></th>
              <th className={`${TH} w-36`}>구분</th>
              <th className={`${TH} w-44`}>소화기규격</th>
              <th className={`${TH} w-28 text-center`}>비치상태</th>
              <th className={`${TH} w-28`}>확인일자<SortButton ctl={sortCtl} col="checked" label="확인일자" /></th>
              <th className={`${TH} w-36`}>비고</th>
              <th className="w-8 px-1 py-2" aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-300">
                  아래 ＋ 버튼으로 차량을 추가해 주세요
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className={r.status === '미비치' ? 'bg-red-50/50' : ''}>
                <td className={`${TD_STICKY_POS} ${r.status === '미비치' ? 'bg-red-50/50' : 'bg-white'} px-1 py-1.5`}>
                  <input aria-label="차량번호" placeholder="예: 12가 3456" value={r.plate} onChange={(e) => setRow(r.id, { plate: e.target.value })} className={`${CELL} px-1.5 font-mono font-semibold`} />
                </td>
                <td className="px-1 py-1.5">
                  <input aria-label="구분" placeholder="예: 6.5톤 트럭" value={r.vehicleType} onChange={(e) => setRow(r.id, { vehicleType: e.target.value })} className={`${CELL} px-1.5`} />
                </td>
                <td className="px-1 py-1.5">
                  <input aria-label="소화기규격" placeholder="예: 차량용 1.5kg" value={r.spec} onChange={(e) => setRow(r.id, { spec: e.target.value })} className={`${CELL} px-1.5`} />
                </td>
                <td className="px-1 py-1.5">
                  <select
                    aria-label="비치상태"
                    value={r.status}
                    onChange={(e) => setRow(r.id, { status: e.target.value as VehicleExtinguisher['status'] })}
                    className={`${CELL} text-center font-semibold ${STATUS_STYLE[r.status]}`}
                  >
                    {VEHICLE_EXT_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="확인일자" type="date" value={r.checkedAt ?? ''} onChange={(e) => setRow(r.id, { checkedAt: e.target.value })} className={CELL} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={CELL} />
                </td>
                <td className="px-1 py-1.5 text-center">
                  <button aria-label="행 삭제" onClick={() => del(r)} className="text-slate-300 hover:text-red-500">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SheetToolbar addLabel="＋ 차량 추가" onAdd={add} onUndo={() => void undo()} canUndo={canUndo} save={save} />

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        차량이 새로 들어오거나 소화기를 교체하면 비치상태·확인일자를 갱신해 주세요. 미비치 차량은 붉게 표시됩니다.
      </p>
    </div>
  );
}
