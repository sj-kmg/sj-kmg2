'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PASS_VEHICLES_KEY,
  VEHICLE_NOTICE_DAYS,
  cardEndDate,
  passVehicleSeed,
  type PassVehicle,
} from '@/lib/cards';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';

const KINDS: PassVehicle['kind'][] = ['일반차량', '특수차량'];

/**
 * 신청현황 › 상시카드&차량 — 상시차량 시트.
 * 출입시작일을 입력하면 종료일이 자동 계산되며 직접 수정할 수 있고, 종료 60일 전부터 D-day가 표시된다.
 */
export default function PassVehicleSheet() {
  const { entries, mode, add, remove } = useSyncedLog<PassVehicle>('pass-vehicles', PASS_VEHICLES_KEY);
  const seed = useMemo(() => passVehicleSeed(), []);
  const [rows, setRows] = useState<PassVehicle[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  useEffect(() => {
    if (mode === 'loading' || dirty) return;
    const savedPlates = new Set(entries.map((e) => e.plate.trim()));
    const pending = seed.filter((s) => !savedPlates.has(s.plate.trim()));
    setRows(
      [...entries, ...pending].sort(
        (a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.startDate.localeCompare(b.startDate),
      ),
    );
  }, [entries, mode, dirty, seed]);

  const setRow = (id: string, patch: Partial<PassVehicle>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    seq.current += 1;
    setRows((list) => [
      ...list,
      {
        id: `PV-${Date.now()}-${seq.current}`,
        kind: '일반차량',
        plate: '',
        driver: '',
        startDate: '',
        endDate: '',
        plant: '화치, 용성1/2, 본관',
        note: '',
        updatedAt: '',
      },
    ]);
    setDirty(true);
  };

  const removeRow = (id: string, plate: string) => {
    if (plate.trim() && !confirm(`[${plate}] 행을 삭제할까요? [변경사항 저장]을 눌러야 반영됩니다.`)) return;
    setRows((list) => list.filter((r) => r.id !== id));
    if (entries.some((e) => e.id === id)) setRemovedIds((l) => [...l, id]);
    setDirty(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      for (const id of removedIds) {
        await remove(id);
      }
      for (const r of rows) {
        if (!r.plate.trim()) continue;
        const orig = entries.find((e) => e.id === r.id);
        const changed =
          !orig ||
          orig.kind !== r.kind ||
          orig.plate !== r.plate.trim() ||
          orig.driver !== r.driver ||
          orig.startDate !== r.startDate ||
          orig.endDate !== r.endDate ||
          (orig.plant ?? '') !== (r.plant ?? '') ||
          (orig.note ?? '') !== (r.note ?? '');
        if (changed) {
          await add({ ...r, plate: r.plate.trim(), updatedAt: new Date().toISOString() });
        }
      }
      setRemovedIds([]);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const badge = modeBadge(mode);
  const cell =
    'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none';

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

  const pending = rows.filter((r) => r.plate.trim() && !entries.some((e) => e.id === r.id)).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          🚗 상시차량 신청현황
          <span className="ml-1.5 font-normal text-slate-400">{rows.length}대</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        {dirty && <span className="text-[11px] font-semibold text-orange-500">● 저장되지 않은 변경</span>}
        {!dirty && pending > 0 && (
          <span className="text-[11px] text-slate-400">기존 현황 {pending}대 — [변경사항 저장]을 누르면 등록됩니다</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className="w-24 px-2 py-2 font-semibold">차량구분</th>
              <th className="min-w-28 px-2 py-2 font-semibold">차량번호</th>
              <th className="w-24 px-2 py-2 font-semibold">대표 운전자</th>
              <th className="w-36 px-2 py-2 font-semibold">출입시작일</th>
              <th className="w-36 px-2 py-2 font-semibold">출입종료일</th>
              <th className="w-20 px-2 py-2 text-center font-semibold">D-day</th>
              <th className="min-w-36 px-2 py-2 font-semibold">단위공장</th>
              <th className="min-w-20 px-2 py-2 font-semibold">비고</th>
              <th className="w-8 px-1 py-2" aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-slate-300">
                  아래 ＋ 버튼으로 상시차량을 추가해 주세요
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-1.5 py-1.5">
                  <select
                    aria-label="차량구분"
                    value={r.kind}
                    onChange={(e) => setRow(r.id, { kind: e.target.value as PassVehicle['kind'] })}
                    className={cell}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="차량번호" placeholder="예: 12가 3456" value={r.plate} onChange={(e) => setRow(r.id, { plate: e.target.value })} className={cell} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="대표 운전자" placeholder="이름" value={r.driver} onChange={(e) => setRow(r.id, { driver: e.target.value })} className={cell} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input
                    aria-label="출입시작일"
                    type="date"
                    value={r.startDate}
                    onChange={(e) => setRow(r.id, { startDate: e.target.value, endDate: r.endDate || cardEndDate(e.target.value) })}
                    className={cell}
                  />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="출입종료일" type="date" value={r.endDate} onChange={(e) => setRow(r.id, { endDate: e.target.value })} className={cell} />
                </td>
                <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="단위공장" value={r.plant ?? ''} onChange={(e) => setRow(r.id, { plant: e.target.value })} className={cell} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={cell} />
                </td>
                <td className="px-1 py-1.5 text-center">
                  <button aria-label="행 삭제" onClick={() => removeRow(r.id, r.plate)} className="text-slate-300 hover:text-red-500">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          onClick={addRow}
          className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
        >
          ＋ 차량 추가
        </button>
        <button
          onClick={() => void save()}
          disabled={saving || (!dirty && pending === 0)}
          className="rounded-lg bg-[#1f3864] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a4a80] disabled:opacity-50"
        >
          {saving ? '저장 중…' : '변경사항 저장'}
        </button>
        {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        갱신 시 출입시작일·종료일을 직접 수정하면 됩니다. 출입종료 {VEHICLE_NOTICE_DAYS}일 전부터 이 화면과 메인 [공무관리
        현황]에 D-day가 표시됩니다.
      </p>
    </div>
  );
}
