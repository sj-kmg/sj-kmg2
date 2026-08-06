'use client';

import { useMemo, useRef } from 'react';
import {
  SAFETY_DATES_KEY,
  SAFETY_ITEMS_KEY,
  SAFETY_UNITS,
  compareSafetyDate,
  compareSafetyItem,
  safetyDateSeed,
  safetyItemSeed,
  shortDate,
  type SafetyDate,
  type SafetyItem,
} from '@/lib/safety';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { CELL, SheetToolbar, TH } from './SheetUI';

function newId(prefix: string, seq: number): string {
  return `${prefix}-${Date.now()}-${seq}`;
}

/**
 * 공무관리 › 안전용품관리 — 품명이 행, 재고 확인 일자가 열인 표.
 * 재고를 실사할 때마다 [일자 추가]로 열을 만들고 품목별 수량을 적으면 된다.
 * 값을 바꾸면 자동 저장되며 [되돌리기]로 직전 상태로 복구할 수 있다.
 */
export default function SafetyStockSheet() {
  const iSeed = useMemo(() => safetyItemSeed(), []);
  const dSeed = useMemo(() => safetyDateSeed(), []);

  const itm = useSheetLog<SafetyItem>('safety-items', SAFETY_ITEMS_KEY, {
    seed: iSeed,
    isBlank: (r) => !r.name.trim(),
    sort: compareSafetyItem,
  });
  const dt = useSheetLog<SafetyDate>('safety-dates', SAFETY_DATES_KEY, {
    seed: dSeed,
    isBlank: () => false, // 일자를 비워 둔 채로도 열을 유지한다
    sort: compareSafetyDate,
  });

  const seq = useRef(0);

  const items = itm.rows;
  const dates = dt.rows;

  /** 품목별 합계 — 원본 대장의 [계] 열과 같이 일자 열을 모두 더한다 */
  const rowTotal = (r: SafetyItem) => dates.reduce((n, d) => n + (r.qtys?.[d.id] ?? 0), 0);
  /** 일자별 합계 — 원본 대장의 맨 아래 [계] 행 */
  const colTotal = (d: SafetyDate) => items.reduce((n, r) => n + (r.qtys?.[d.id] ?? 0), 0);
  const grandTotal = items.reduce((n, r) => n + rowTotal(r), 0);

  /** 가장 최근 일자 열 — 현재 재고로 본다 */
  const latest = dates.length ? dates[dates.length - 1] : null;

  const setQty = (row: SafetyItem, dateId: string, raw: string) => {
    const qty = raw === '' ? null : Number(raw);
    itm.setRow(row.id, { qtys: { ...(row.qtys ?? {}), [dateId]: qty } });
  };

  const addItem = () => {
    seq.current += 1;
    itm.addRow({
      id: newId('SI', seq.current),
      name: '',
      unit: 'EA',
      qtys: {},
      note: '',
      order: (items.length ? Math.max(...items.map((i) => i.order)) : 0) + 1,
      updatedAt: '',
    });
  };

  const delItem = (r: SafetyItem) => {
    if (r.name.trim() && !confirm(`[${r.name}] 품목을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void itm.removeRow(r.id);
  };

  const addDate = () => {
    seq.current += 1;
    dt.addRow({
      id: newId('SD', seq.current),
      date: '',
      order: (dates.length ? Math.max(...dates.map((d) => d.order)) : 0) + 1,
      updatedAt: '',
    });
  };

  const delDate = (d: SafetyDate) => {
    if (!confirm(`[${shortDate(d.date)}] 일자 열을 삭제할까요?\n이 날짜에 입력한 수량이 모두 사라집니다.`)) return;
    void dt.removeRow(d.id);
  };

  const badge = modeBadge(itm.mode);
  const save = saveBadge(itm.status === 'idle' ? dt.status : itm.status, itm.mode);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            🦺 안전용품 재고현황
            <span className="ml-1.5 font-normal text-slate-400">
              {items.length}품목 · 확인일자 {dates.length}개
            </span>
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          {latest && (
            <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
              최근 {shortDate(latest.date)} 확인 · 합계 {colTotal(latest).toLocaleString()}
            </span>
          )}
          <button
            onClick={addDate}
            className="ml-auto rounded-lg border border-dashed border-slate-400 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            ＋ 확인일자 추가
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs" style={{ minWidth: `${560 + dates.length * 116}px` }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className={`${TH} w-56`} rowSpan={2}>
                  품명
                </th>
                <th className={`${TH} w-24`} rowSpan={2}>
                  단위
                </th>
                <th className={`${TH} text-center`} colSpan={Math.max(dates.length, 1)}>
                  재고수량 — 확인일자별
                </th>
                <th className={`${TH} w-24 text-center`} rowSpan={2}>
                  계
                </th>
                <th className={`${TH} w-56`} rowSpan={2}>
                  비고
                </th>
                <th className="w-10 px-1 py-2" rowSpan={2} aria-label="행 삭제" />
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                {dates.length === 0 && (
                  <th className={`${TH} w-28 text-center font-normal text-slate-300`}>
                    [＋ 확인일자 추가]를 눌러 주세요
                  </th>
                )}
                {dates.map((d) => (
                  <th key={d.id} className="w-28 px-1 py-1.5">
                    <div className="flex items-center gap-0.5">
                      <input
                        aria-label="확인일자"
                        type="date"
                        value={d.date}
                        onChange={(e) => dt.setRow(d.id, { date: e.target.value })}
                        className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-1 text-[11px] text-slate-700 focus:border-[#1f3864] focus:outline-none"
                      />
                      <button
                        aria-label="일자 열 삭제"
                        onClick={() => delDate(d)}
                        className="shrink-0 px-0.5 text-slate-300 hover:text-red-500"
                        title="이 확인일자 열을 삭제합니다"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={dates.length + 5} className="px-3 py-6 text-center text-slate-300">
                    아래 ＋ 버튼으로 품목을 추가해 주세요
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="품명" placeholder="예: 안전대" value={r.name} onChange={(e) => itm.setRow(r.id, { name: e.target.value })} className={CELL} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="단위" list="sf-units" value={r.unit} onChange={(e) => itm.setRow(r.id, { unit: e.target.value })} className={CELL} />
                  </td>
                  {dates.length === 0 && <td className="px-2 py-1.5 text-center text-slate-300">—</td>}
                  {dates.map((d) => (
                    <td key={d.id} className="px-1 py-1.5">
                      <input
                        aria-label={`${r.name} ${shortDate(d.date)} 수량`}
                        type="number"
                        min={0}
                        step="any"
                        value={r.qtys?.[d.id] ?? ''}
                        onChange={(e) => setQty(r, d.id, e.target.value)}
                        className={`${CELL} text-center`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-700">{rowTotal(r).toLocaleString()}</td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="비고" value={r.note} onChange={(e) => itm.setRow(r.id, { note: e.target.value })} className={CELL} />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button aria-label="행 삭제" onClick={() => delItem(r)} className="text-slate-300 hover:text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {/* 합계 행 */}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-700">
                <td className="px-2 py-2">계</td>
                <td className="px-2 py-2" />
                {dates.length === 0 && <td className="px-2 py-2 text-center">—</td>}
                {dates.map((d) => (
                  <td key={d.id} className="px-2 py-2 text-center font-mono">
                    {colTotal(d).toLocaleString()}
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-mono">{grandTotal.toLocaleString()}</td>
                <td className="px-2 py-2" />
                <td className="px-1 py-2" />
              </tr>
            </tbody>
          </table>
        </div>

        <datalist id="sf-units">
          {SAFETY_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <SheetToolbar addLabel="＋ 품목 추가" onAdd={addItem} onUndo={() => void itm.undo()} canUndo={itm.canUndo} save={save} />

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          재고를 확인할 때마다 오른쪽 위 <b>[＋ 확인일자 추가]</b>로 열을 만들고 날짜를 직접 넣은 뒤, 품목별 수량을
          적으면 됩니다. 열 머리의 날짜는 언제든 고칠 수 있고 ✕로 지울 수 있습니다(그 날짜에 넣은 수량도 함께 사라집니다).
          품목도 자유롭게 추가·삭제할 수 있으며, 오른쪽 [계]는 그 품목의 일자별 수량을 모두 더한 값, 맨 아래 [계]는
          해당 일자에 확인한 전체 수량입니다.
        </p>
      </div>
    </div>
  );
}
