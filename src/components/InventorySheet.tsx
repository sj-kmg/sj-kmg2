'use client';

import { useMemo, useRef, useState } from 'react';
import { fileHref } from '@/lib/ids';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_KEY,
  INVENTORY_UNITS,
  compareInventory,
  inventorySeed,
  type InventoryItem,
} from '@/lib/inventory';
import { SyncError, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { CELL, SheetToolbar, TH } from './SheetUI';

/** 새로 추가하는 행의 ID — 렌더 중 계산되지 않도록 모듈 함수로 분리한다 */
function newRowId(seq: number): string {
  return `IV-${Date.now()}-${seq}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 공무관리 › 통합재고관리 — 기자재 보유 현황.
 * 큰 분류가 탭이 되고, 탭 안에서 기자재를 추가하거나 규격·수량을 고칠 수 있다.
 * 값을 바꾸면 자동 저장되며 [되돌리기]로 직전 상태로 복구할 수 있다.
 */
export default function InventorySheet() {
  const seed = useMemo(() => inventorySeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<InventoryItem>(
    'inventory',
    INVENTORY_KEY,
    {
      seed,
      isBlank: (r) => !r.name.trim(),
      sort: compareInventory,
    },
  );

  const [tab, setTab] = useState(INVENTORY_CATEGORIES[0]);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const seq = useRef(0);

  /** 데이터에 있는 분류를 모두 탭으로 — 새 분류를 입력하면 탭이 늘어난다 */
  const categories = useMemo(() => {
    const set = new Set(INVENTORY_CATEGORIES);
    rows.forEach((r) => r.category.trim() && set.add(r.category.trim()));
    return [...set];
  }, [rows]);

  /** 고른 분류가 사라졌으면(이름 변경 등) 첫 번째 탭을 보여 준다 */
  const activeTab = categories.includes(tab) ? tab : (categories[0] ?? '');

  const q = query.trim().toLowerCase();
  /** 검색 중이면 분류를 건너뛰고 전체에서 찾는다 */
  const shown = q
    ? rows.filter((r) =>
        [r.name, r.spec, r.note, r.category].some((v) => v?.toLowerCase().includes(q)),
      )
    : rows.filter((r) => r.category === activeTab);

  const names = new Set(shown.map((r) => r.name.trim()).filter(Boolean));
  const qtySum = shown.reduce((n, r) => n + (r.qty ?? 0), 0);
  const missing = shown.filter((r) => r.qty === null).length;

  const add = () => {
    seq.current += 1;
    addRow({
      id: newRowId(seq.current),
      category: q ? (categories[0] ?? '') : activeTab,
      name: '',
      spec: '',
      qty: null,
      unit: '개',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: InventoryItem) => {
    if (r.name.trim() && !confirm(`[${r.name}${r.spec ? ` ${r.spec}` : ''}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`))
      return;
    void removeRow(r.id);
  };

  const attach = async (row: InventoryItem, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.name || '기자재'}_${row.spec || ''}`);
      setRow(row.id, { photoFile: url });
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('사진 첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  const tabBtn = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-semibold ${
      active ? 'border-[#1f3864] bg-[#1f3864] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#1f3864]'
    }`;

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            📦 기자재 통합재고
            <span className="ml-1.5 font-normal text-slate-400">
              전체 {rows.length}행 · 분류 {categories.length}개
            </span>
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기자재명·규격 검색"
            aria-label="기자재 검색"
            className="ml-auto w-56 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 focus:border-[#1f3864] focus:outline-none"
          />
        </div>

        {/* 분류 탭 */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const n = rows.filter((r) => r.category === c).length;
            return (
              <button
                key={c}
                onClick={() => {
                  setQuery('');
                  setTab(c);
                }}
                className={tabBtn(!q && activeTab === c)}
              >
                {c}
                <span className="ml-1 font-normal opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span>
            {q ? `검색 결과 ${shown.length}행` : `${activeTab} — ${shown.length}행`} · 품목 {names.size}종 · 수량 합계{' '}
            <b className="font-mono text-slate-700">{qtySum.toLocaleString()}</b>
          </span>
          {missing > 0 && (
            <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">수량 미기재 {missing}행</span>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1280px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className={`${TH} w-56`}>기자재명</th>
                <th className={`${TH} w-40`}>규격</th>
                <th className={`${TH} w-24 text-center`}>보유수량</th>
                <th className={`${TH} w-24`}>단위</th>
                <th className={`${TH} w-44`}>분류</th>
                <th className={`${TH} w-32 text-center`}>사진</th>
                <th className={`${TH} w-72`}>비고</th>
                <th className="w-10 px-1 py-2" aria-label="행 삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-300">
                    {q ? '검색 결과가 없습니다' : '아래 ＋ 버튼으로 기자재를 추가해 주세요'}
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.id} className={r.qty === null ? 'bg-amber-50/40' : ''}>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="기자재명" placeholder="예: 다이아프램 펌프" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="규격" placeholder='예: 3"' value={r.spec} onChange={(e) => setRow(r.id, { spec: e.target.value })} className={CELL} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      aria-label="보유수량"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="미기재"
                      value={r.qty ?? ''}
                      onChange={(e) => setRow(r.id, { qty: e.target.value === '' ? null : Number(e.target.value) })}
                      className={`${CELL} text-center`}
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="단위" list="iv-units" value={r.unit} onChange={(e) => setRow(r.id, { unit: e.target.value })} className={CELL} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      aria-label="분류"
                      list="iv-cats"
                      value={r.category}
                      onChange={(e) => setRow(r.id, { category: e.target.value })}
                      className={CELL}
                      title="바꾸면 해당 분류 탭으로 이동합니다. 새 이름을 넣으면 탭이 새로 생깁니다."
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                      {r.photoFile && (
                        <a
                          href={fileHref(r.photoFile)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                          title={`${r.name} 사진 열기`}
                        >
                          🖼 보기
                        </a>
                      )}
                      <label
                        htmlFor={`iv-${r.id}`}
                        className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                        title="사진 첨부·교체"
                      >
                        {uploading === r.id ? '업로드중' : r.photoFile ? '교체' : '첨부'}
                      </label>
                      <input
                        id={`iv-${r.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          void attach(r, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </div>
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
              ))}
            </tbody>
          </table>
        </div>

        <datalist id="iv-units">
          {INVENTORY_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <datalist id="iv-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <SheetToolbar addLabel="＋ 기자재 추가" onAdd={add} onUndo={() => void undo()} canUndo={canUndo} save={save} />

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          같은 기자재라도 규격이 다르면 행을 따로 둡니다 (예: 함마렌치 32㎜ / 36㎜). 수량을 비우면 <b>미기재</b>로 표시되고
          노란색으로 구분됩니다. [분류] 칸을 바꾸면 해당 탭으로 옮겨지고, 없던 이름을 넣으면 탭이 새로 생깁니다. 값을
          바꾸면 자동 저장되며 [되돌리기]로 직전 상태로 복구할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
