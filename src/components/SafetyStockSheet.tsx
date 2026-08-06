'use client';

import { useMemo, useRef, useState } from 'react';
import {
  FIRST_DATE,
  SAFETY_ITEMS_KEY,
  SAFETY_UNITS,
  compareSafetyItem,
  previousDate,
  recordedDates,
  safetyItemSeed,
  shortDate,
  type SafetyItem,
} from '@/lib/safety';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { CELL, SheetToolbar, TH } from './SheetUI';

function newId(seq: number): string {
  return `SI-${Date.now()}-${seq}`;
}

/**
 * 공무관리 › 안전용품관리 — 확인일자를 달력에서 고르고 그 날짜의 수량을 기록한다.
 * 지난 일자는 [기록된 일자] 버튼으로 바로 열어 볼 수 있다.
 */
export default function SafetyStockSheet() {
  const seed = useMemo(() => safetyItemSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<SafetyItem>(
    'safety-items',
    SAFETY_ITEMS_KEY,
    {
      seed,
      isBlank: (r) => !r.name.trim(),
      sort: compareSafetyItem,
    },
  );

  const [date, setDate] = useState('');
  const seq = useRef(0);

  const dates = useMemo(() => recordedDates(rows), [rows]);

  /** 고른 날짜가 없으면 가장 최근 확인일자를 보여 준다 */
  const active = date || dates[dates.length - 1] || FIRST_DATE;
  const prev = previousDate(dates, active);

  const filled = rows.filter((r) => r.qtys?.[active] !== null && r.qtys?.[active] !== undefined).length;

  const setQty = (row: SafetyItem, raw: string) => {
    const next = { ...(row.qtys ?? {}) };
    if (raw === '') delete next[active];
    else next[active] = Number(raw);
    setRow(row.id, { qtys: next });
  };

  const add = () => {
    seq.current += 1;
    addRow({
      id: newId(seq.current),
      name: '',
      unit: 'EA',
      qtys: {},
      note: '',
      order: (rows.length ? Math.max(...rows.map((r) => r.order)) : 0) + 1,
      updatedAt: '',
    });
  };

  const del = (r: SafetyItem) => {
    if (r.name.trim() && !confirm(`[${r.name}] 품목을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  /** 직전 확인일 대비 증감 */
  const diffOf = (r: SafetyItem) => {
    if (!prev) return null;
    const now = r.qtys?.[active];
    const before = r.qtys?.[prev];
    if (now === null || now === undefined || before === null || before === undefined) return null;
    return now - before;
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            🦺 안전용품 재고현황
            <span className="ml-1.5 font-normal text-slate-400">{rows.length}품목</span>
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            확인일자
            <input
              aria-label="확인일자"
              type="date"
              value={active}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none"
            />
          </label>
        </div>

        {/* 기록된 일자 바로가기 */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400">기록된 일자</span>
          {dates.length === 0 && <span className="text-[11px] text-slate-300">아직 없습니다</span>}
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                d === active
                  ? 'border-[#1f3864] bg-[#1f3864] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[#1f3864]'
              }`}
            >
              {shortDate(d)}
            </button>
          ))}
          <span className="ml-2 text-[11px] text-slate-400">
            {shortDate(active)} 입력 {filled}/{rows.length}품목
            {prev && <> · 직전 확인일 {shortDate(prev)}</>}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className={`${TH} w-64`}>품명</th>
                <th className={`${TH} w-20`}>단위</th>
                <th className={`${TH} w-28 text-center`}>수량</th>
                <th className={`${TH} w-24 text-center`}>직전 대비</th>
                <th className={`${TH} w-40`}>비고</th>
                <th className="w-10 px-1 py-2" aria-label="행 삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-300">
                    아래 ＋ 버튼으로 품목을 추가해 주세요
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const diff = diffOf(r);
                return (
                  <tr key={r.id}>
                    <td className="px-1.5 py-1.5">
                      <input aria-label="품명" placeholder="예: 안전대" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input aria-label="단위" list="sf-units" maxLength={4} value={r.unit} onChange={(e) => setRow(r.id, { unit: e.target.value })} className={`${CELL} text-center`} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        aria-label="수량"
                        type="number"
                        min={0}
                        step="any"
                        placeholder="미확인"
                        value={r.qtys?.[active] ?? ''}
                        onChange={(e) => setQty(r, e.target.value)}
                        className={`${CELL} text-center`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {diff === null ? (
                        <span className="text-[11px] text-slate-300">—</span>
                      ) : diff === 0 ? (
                        <span className="font-mono text-[11px] text-slate-400">0</span>
                      ) : (
                        <span className={`font-mono text-[11px] font-bold ${diff > 0 ? 'text-sky-700' : 'text-red-600'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input aria-label="비고" value={r.note} onChange={(e) => setRow(r.id, { note: e.target.value })} className={CELL} />
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <button aria-label="행 삭제" onClick={() => del(r)} className="text-slate-300 hover:text-red-500">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <datalist id="sf-units">
          {SAFETY_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <SheetToolbar addLabel="＋ 품목 추가" onAdd={add} onUndo={() => void undo()} canUndo={canUndo} save={save} />

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          오른쪽 위 <b>[확인일자]</b>에서 달력으로 날짜를 고르면 그 날짜의 수량만 표시됩니다. 새 날짜를 고르고 수량을
          적으면 그 날짜 기록이 새로 만들어지고, 아래 [기록된 일자] 버튼으로 지난 실사 내용을 언제든 다시 열어 볼 수
          있습니다. [직전 대비]는 바로 앞 확인일자와 비교한 증감입니다. 값을 바꾸면 자동 저장됩니다.
        </p>
      </div>
    </div>
  );
}
