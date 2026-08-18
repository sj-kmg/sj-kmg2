'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PASS_VEHICLES_KEY, VEHICLE_NOTICE_DAYS, passVehicleSeed, type PassVehicle } from '@/lib/cards';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { CELL, SheetToolbar, TD_STICKY, TH, TH_STICKY } from './SheetUI';

const KINDS: PassVehicle['kind'][] = ['일반차량', '특수차량'];

/**
 * 신청현황 › 상시카드&차량 — 상시차량 시트.
 * 일반차량·특수차량을 위아래 별도 표로 구분해 관리하며, 출입일자는 직접 입력한다.
 */
export default function PassVehicleSheet() {
  const seed = useMemo(() => passVehicleSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<PassVehicle>(
    'pass-vehicles',
    PASS_VEHICLES_KEY,
    {
      seed,
      isBlank: (r) => !r.plate.trim(),
      sort: (a, b) => a.plate.localeCompare(b.plate, 'ko', { numeric: true }),
    },
  );

  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  const add = (kind: PassVehicle['kind']) => {
    seq.current += 1;
    addRow({
      id: `PV-${Date.now()}-${seq.current}`,
      kind,
      plate: '',
      driver: '',
      startDate: '',
      endDate: '',
      plant: '화치, 용성1/2, 본관',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: PassVehicle) => {
    if (r.plate.trim() && !confirm(`[${r.plate}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  const dday = (r: PassVehicle) => {
    if (!r.endDate || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.endDate, today);
    const level = noticeLevel(days, VEHICLE_NOTICE_DAYS);
    if (!level) return <span className="font-mono text-[11px] text-slate-400">D-{days}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>
        {days < 0 ? `D+${-days}` : `D-${days}`}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          🚗 상시차량 신청현황
          <span className="ml-1.5 font-normal text-slate-400">{rows.length}대</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>

      {/* 일반차량 · 특수차량 구분 표 */}
      {KINDS.map((kind) => {
        const list = rows.filter((r) => r.kind === kind);
        return (
          <section key={kind} className="mb-5">
            <p className="mb-1.5 flex items-center gap-1.5">
              <span aria-hidden className={`h-3 w-1 rounded-full ${kind === '일반차량' ? 'bg-cyan-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-bold text-slate-600">{kind}</span>
              <span className="text-[11px] font-normal text-slate-400">{list.length}대</span>
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[1320px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                    <th className={`${TH} ${TH_STICKY} w-40`}>차량번호</th>
                    <th className={`${TH} w-32`}>대표 운전자</th>
                    <th className={`${TH} w-40`}>출입시작일</th>
                    <th className={`${TH} w-40`}>출입종료일</th>
                    <th className={`${TH} w-24 text-center`}>D-day</th>
                    <th className={`${TH} w-56`}>단위공장</th>
                    <th className={`${TH} w-52`}>비고</th>
                    <th className={`${TH} w-28 text-center`}>구분</th>
                    <th className="w-10 px-1 py-2" aria-label="행 삭제" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-slate-300">
                        아래 ＋ 버튼으로 {kind}을 추가해 주세요
                      </td>
                    </tr>
                  )}
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td className={`${TD_STICKY} px-1.5 py-1.5`}>
                        <input aria-label="차량번호" placeholder="예: 12가 3456" value={r.plate} onChange={(e) => setRow(r.id, { plate: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="대표 운전자" placeholder="이름" value={r.driver} onChange={(e) => setRow(r.id, { driver: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="출입시작일" type="date" value={r.startDate} onChange={(e) => setRow(r.id, { startDate: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="출입종료일" type="date" value={r.endDate} onChange={(e) => setRow(r.id, { endDate: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="단위공장" value={r.plant ?? ''} onChange={(e) => setRow(r.id, { plant: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          aria-label="차량구분"
                          value={r.kind}
                          onChange={(e) => setRow(r.id, { kind: e.target.value as PassVehicle['kind'] })}
                          className={CELL}
                          title="변경하면 해당 구분 표로 이동합니다"
                        >
                          {KINDS.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
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
            <button
              onClick={() => add(kind)}
              className="mt-2 rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
            >
              ＋ {kind} 추가
            </button>
          </section>
        );
      })}

      <div className="border-t border-slate-100 pt-3">
        <SheetToolbar addLabel="" onUndo={() => void undo()} canUndo={canUndo} save={save} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        출입시작일·종료일은 직접 입력합니다. 오른쪽 [구분]을 바꾸면 해당 표로 이동하며, 출입종료 {VEHICLE_NOTICE_DAYS}일
        전부터 메인 [공무관리 현황]에 D-day가 표시됩니다.
      </p>
    </div>
  );
}
