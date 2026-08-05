'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { daysUntil, noticeLevel } from '@/lib/education';
import { fileHref } from '@/lib/ids';
import { SyncError, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import {
  CATEGORY_STYLE,
  VEHICLE_CATEGORIES,
  VEHICLE_CHECK_KEY,
  VEHICLE_CHECK_NOTICE_DAYS,
  VEHICLE_ITEMS_KEY,
  compareItem,
  compareVehicle,
  itemKind,
  nextDueDate,
  vehicleCheckSeed,
  vehicleItemSeed,
  type VehicleCategory,
  type VehicleCheck,
  type VehicleItem,
  type VehicleItemKind,
} from '@/lib/vehicleCheck';
import { CELL, SheetToolbar, TH } from './SheetUI';

function newId(prefix: string, seq: number): string {
  return `${prefix}-${Date.now()}-${seq}`;
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
 * 공무관리 › 차량점검내역 — 차량이 행, 정비항목이 열인 표.
 * 각 칸에는 「마지막 교체·시행일」만 넣으면 되고, 주기가 있는 항목은 칸 색으로 상태를 보여 준다.
 * 항목 구성은 [항목 관리]에서 직접 고칠 수 있다.
 */
export default function VehicleCheckSheet() {
  const vSeed = useMemo(() => vehicleCheckSeed(), []);
  const iSeed = useMemo(() => vehicleItemSeed(), []);

  const veh = useSheetLog<VehicleCheck>('vehicle-check', VEHICLE_CHECK_KEY, {
    seed: vSeed,
    isBlank: (r) => !r.plate.trim(),
    sort: compareVehicle,
  });
  const itm = useSheetLog<VehicleItem>('vehicle-items', VEHICLE_ITEMS_KEY, {
    seed: iSeed,
    isBlank: (r) => !r.label.trim(),
    sort: compareItem,
  });

  const [cat, setCat] = useState<VehicleCategory | ''>('');
  const [manage, setManage] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  const items = itm.rows;
  const shown = cat ? veh.rows.filter((r) => r.category === cat) : veh.rows;

  /** 칸 상태 — 주기가 있는 항목만 판정 */
  const cellState = (row: VehicleCheck, item: VehicleItem) => {
    const done = row.dates?.[item.id] ?? '';
    if (itemKind(item) === 'text' || !done || !item.cycleMonths || !today) {
      return { done, days: null as number | null, level: null };
    }
    const due = nextDueDate(done, item.cycleMonths);
    if (!due) return { done, days: null, level: null };
    const days = daysUntil(due, today);
    return { done, days, level: noticeLevel(days, VEHICLE_CHECK_NOTICE_DAYS), due };
  };

  /** 도래·초과 건수 */
  const overdue = useMemo(() => {
    if (!today) return { over: 0, soon: 0 };
    let over = 0;
    let soon = 0;
    for (const r of veh.rows) {
      for (const it of items) {
        const s = cellState(r, it);
        if (s.days === null) continue;
        if (s.days < 0) over++;
        else if (s.level) soon++;
      }
    }
    return { over, soon };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veh.rows, items, today]);

  const setDate = (row: VehicleCheck, itemId: string, value: string) => {
    veh.setRow(row.id, { dates: { ...(row.dates ?? {}), [itemId]: value } });
  };

  const addVehicle = () => {
    seq.current += 1;
    veh.addRow({
      id: newId('VC', seq.current),
      category: (cat || '일반차량') as VehicleCategory,
      name: '',
      plate: '',
      dates: {},
      note: '',
      updatedAt: '',
    });
  };

  const delVehicle = (r: VehicleCheck) => {
    if (r.plate.trim() && !confirm(`[${r.plate}] 차량을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void veh.removeRow(r.id);
  };

  const addItem = () => {
    seq.current += 1;
    itm.addRow({
      id: newId('VI', seq.current),
      label: '',
      kind: 'date',
      cycleMonths: 12,
      order: (items.length ? Math.max(...items.map((i) => i.order)) : 0) + 1,
      updatedAt: '',
    });
  };

  const delItem = (it: VehicleItem) => {
    if (!confirm(`[${it.label || '이름 없음'}] 항목(열)을 삭제할까요?\n차량별로 입력해 둔 이 항목의 날짜는 사라집니다.`))
      return;
    void itm.removeRow(it.id);
  };

  const attach = async (row: VehicleCheck, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.plate || '차량'}_정비명세서`);
      veh.setRow(row.id, { certFile: url });
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  const badge = modeBadge(veh.mode);
  const save = saveBadge(veh.status === 'idle' ? itm.status : veh.status, veh.mode);

  /** 날짜 칸 색 — 초과(빨강) · 도래(주황) · 정상(기본) */
  const dateCls = (level: string | null, days: number | null) => {
    if (days === null) return CELL;
    if (days < 0) return `${CELL} border-red-300 bg-red-50 text-red-800`;
    if (level) return `${CELL} border-amber-300 bg-amber-50 text-amber-800`;
    return CELL;
  };

  const catBtn = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-semibold ${
      active ? 'border-[#1f3864] bg-[#1f3864] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#1f3864]'
    }`;

  return (
    <div className="mx-auto max-w-[1800px]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            🚙 차량점검내역
            <span className="ml-1.5 font-normal text-slate-400">
              차량 {veh.rows.length}대 · 정비항목 {items.length}개
            </span>
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          {overdue.over > 0 && (
            <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">교체시기 초과 {overdue.over}건</span>
          )}
          {overdue.soon > 0 && (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">도래 임박 {overdue.soon}건</span>
          )}
          <button
            onClick={() => setManage(!manage)}
            className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            {manage ? '항목 관리 닫기' : '⚙ 항목 관리'}
          </button>
        </div>

        {/* 정비항목(열) 관리 */}
        {manage && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-bold text-slate-600">
              정비항목 관리
              <span className="ml-1.5 font-normal text-slate-400">
                이름·주기를 고치거나 항목을 추가·삭제하면 표의 열이 바뀝니다. 주기를 0으로 두면 날짜만 기록하고 알림은 뜨지 않습니다.
              </span>
            </p>
            <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                  <input
                    aria-label="항목 순서"
                    type="number"
                    value={it.order}
                    onChange={(e) => itm.setRow(it.id, { order: Number(e.target.value) || 0 })}
                    className="w-12 rounded border border-slate-200 px-1 py-1 text-center text-[11px] text-slate-500"
                    title="표시 순서"
                  />
                  <input
                    aria-label="항목 이름"
                    value={it.label}
                    placeholder="예: 타이밍벨트"
                    onChange={(e) => itm.setRow(it.id, { label: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none"
                  />
                  <select
                    aria-label="항목 형식"
                    value={itemKind(it)}
                    onChange={(e) => itm.setRow(it.id, { kind: e.target.value as VehicleItemKind })}
                    className="shrink-0 rounded border border-slate-200 px-1 py-1 text-[11px] text-slate-600"
                    title="날짜 = 달력에서 고르는 칸 / 자유 입력 = 아무 내용이나 적는 칸"
                  >
                    <option value="date">날짜</option>
                    <option value="text">자유 입력</option>
                  </select>
                  {itemKind(it) === 'date' ? (
                    <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                      <input
                        aria-label="주기(개월)"
                        type="number"
                        min={0}
                        value={it.cycleMonths}
                        onChange={(e) => itm.setRow(it.id, { cycleMonths: Number(e.target.value) || 0 })}
                        className="w-14 rounded border border-slate-200 px-1 py-1 text-center text-[11px] text-slate-700"
                      />
                      개월
                    </label>
                  ) : (
                    <span className="shrink-0 text-[11px] text-slate-300">주기 없음</span>
                  )}
                  <button aria-label="항목 삭제" onClick={() => delItem(it)} className="shrink-0 text-slate-300 hover:text-red-500">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={addItem}
                className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
              >
                ＋ 정비항목 추가
              </button>
              <button
                onClick={() => void itm.undo()}
                disabled={!itm.canUndo}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] disabled:opacity-40"
              >
                ↩ 항목 되돌리기
              </button>
            </div>
          </div>
        )}

        {/* 분류 필터 */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button onClick={() => setCat('')} className={catBtn(cat === '')}>
            전체 <span className="ml-1 font-normal opacity-70">{veh.rows.length}</span>
          </button>
          {VEHICLE_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={catBtn(cat === c)}>
              {c} <span className="ml-1 font-normal opacity-70">{veh.rows.filter((r) => r.category === c).length}</span>
            </button>
          ))}
          <span className="ml-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-red-300 bg-red-50" /> 기한 초과
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-50" /> D-{VEHICLE_CHECK_NOTICE_DAYS} 이내
            </span>
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs" style={{ minWidth: `${640 + items.length * 132}px` }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className={`${TH} w-24`}>구분</th>
                <th className={`${TH} w-56`}>장비명</th>
                <th className={`${TH} w-32`}>차량번호</th>
                {items.map((it) => (
                  <th
                    key={it.id}
                    className={`${TH} ${itemKind(it) === 'text' ? 'w-48' : 'w-32'}`}
                    title={itemKind(it) === 'text' ? '자유 입력' : it.cycleMonths ? `${it.cycleMonths}개월 주기` : '주기 없음'}
                  >
                    {it.label || '(이름 없음)'}
                    <span className="ml-1 font-normal text-slate-400">
                      {itemKind(it) === 'text' ? '✎' : it.cycleMonths ? `${it.cycleMonths}M` : ''}
                    </span>
                  </th>
                ))}
                <th className={`${TH} w-48`}>비고</th>
                <th className={`${TH} w-32 text-center`}>명세서</th>
                <th className="w-10 px-1 py-2" aria-label="행 삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={items.length + 6} className="px-3 py-6 text-center text-slate-300">
                    아래 ＋ 버튼으로 차량을 추가해 주세요
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="px-1 py-1.5">
                    <select
                      aria-label="구분"
                      value={r.category}
                      onChange={(e) => veh.setRow(r.id, { category: e.target.value as VehicleCategory })}
                      className={`${CELL} font-semibold ${CATEGORY_STYLE[r.category]}`}
                    >
                      {VEHICLE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="장비명" placeholder="예: 봉고Ⅲ 1톤" value={r.name} onChange={(e) => veh.setRow(r.id, { name: e.target.value })} className={CELL} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="차량번호" placeholder="예: 12가 3456" value={r.plate} onChange={(e) => veh.setRow(r.id, { plate: e.target.value })} className={`${CELL} font-mono`} />
                  </td>
                  {items.map((it) => {
                    const s = cellState(r, it);
                    const tip =
                      s.days === null
                        ? it.cycleMonths
                          ? '마지막 시행일을 입력하세요'
                          : '주기 없음 — 날짜만 기록'
                        : `차기 ${s.due} · ${s.days < 0 ? `D+${-s.days} (기한 초과)` : `D-${s.days}`}`;
                    const free = itemKind(it) === 'text';
                    return (
                      <td key={it.id} className="px-1 py-1.5">
                        <input
                          aria-label={`${r.plate} ${it.label}`}
                          type={free ? 'text' : 'date'}
                          placeholder={free ? '자유 기재' : undefined}
                          value={s.done}
                          onChange={(e) => setDate(r, it.id, e.target.value)}
                          className={free ? CELL : dateCls(s.level, s.days)}
                          title={free ? '자유롭게 적을 수 있는 칸입니다' : tip}
                        />
                      </td>
                    );
                  })}
                  <td className="px-1.5 py-1.5">
                    <input aria-label="비고" placeholder="자유 기재" value={r.note} onChange={(e) => veh.setRow(r.id, { note: e.target.value })} className={CELL} />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                      {r.certFile && (
                        <a
                          href={fileHref(r.certFile)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                          title={`${r.plate} 명세서 열기`}
                        >
                          📄 보기
                        </a>
                      )}
                      <label
                        htmlFor={`vc-${r.id}`}
                        className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                        title="정비명세서·영수증 첨부·교체"
                      >
                        {uploading === r.id ? '업로드중' : r.certFile ? '교체' : '첨부'}
                      </label>
                      <input
                        id={`vc-${r.id}`}
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          void attach(r, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button aria-label="행 삭제" onClick={() => delVehicle(r)} className="text-slate-300 hover:text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SheetToolbar
          addLabel="＋ 차량 추가"
          onAdd={addVehicle}
          onUndo={() => void veh.undo()}
          canUndo={veh.canUndo}
          save={save}
        />

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          차량 한 대가 한 줄이고, 각 정비항목 칸에 <b>마지막으로 교체·시행한 날짜</b>만 넣으면 됩니다. 주기가 있는 항목은
          날짜를 넣는 순간 다음 시기가 계산되어 칸 색으로 표시되고(빨강=기한 초과, 주황=D-
          {VEHICLE_CHECK_NOTICE_DAYS} 이내), 칸에 마우스를 올리면 차기 일자와 D-day가 나옵니다. 항목을 바꾸거나 새로
          만들려면 오른쪽 위 [항목 관리]를 쓰고, 정해진 항목에 없는 내용은 맨 오른쪽 [비고]에 자유롭게 적으면 됩니다.
        </p>
      </div>
    </div>
  );
}
