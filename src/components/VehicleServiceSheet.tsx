'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import { SyncError, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import {
  CATEGORY_STYLE,
  SERVICE_ITEMS,
  VEHICLE_CATEGORIES,
  VEHICLE_SERVICE_KEY,
  VEHICLE_SERVICE_NOTICE_DAYS,
  compareVehicle,
  defaultCycle,
  nextDueDate,
  vehicleServiceSeed,
  type VehicleCategory,
  type VehicleService,
} from '@/lib/vehicleService';
import { CELL, SheetToolbar, TH } from './SheetUI';
import { fileHref } from '@/lib/ids';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 공무관리 › 차량점검내역 — 차량·장비별 정비(교체) 이력.
 * 일반차량·특수차량·중장비를 별도 표로 나누고, 한 차량에 정비항목을 계속 추가할 수 있다.
 * 값을 바꾸면 자동 저장되며 [되돌리기]로 직전 상태로 복구할 수 있다.
 */
export default function VehicleServiceSheet() {
  const seed = useMemo(() => vehicleServiceSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<VehicleService>(
    'vehicle-service',
    VEHICLE_SERVICE_KEY,
    {
      seed,
      isBlank: (r) => !r.plate.trim(),
      sort: compareVehicle,
    },
  );

  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [itemFilter, setItemFilter] = useState('');
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  /** 등록된 정비항목 목록 — 기본 선택지 + 직접 입력한 항목 */
  const itemOptions = useMemo(() => {
    const set = new Set(SERVICE_ITEMS.map(([n]) => n));
    rows.forEach((r) => r.item.trim() && set.add(r.item.trim()));
    return [...set];
  }, [rows]);

  const add = (category: VehicleCategory) => {
    seq.current += 1;
    addRow({
      id: `VS-${Date.now()}-${seq.current}`,
      category,
      name: '',
      plate: '',
      item: itemFilter || '엔진오일',
      replacedAt: '',
      cycleMonths: defaultCycle(itemFilter || '엔진오일'),
      nextDue: '',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: VehicleService) => {
    if (r.plate.trim() && !confirm(`[${r.plate} · ${r.item}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  /** 정비명세서·영수증 첨부·교체 */
  const attachCert = async (row: VehicleService, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.plate || '차량'}_${row.item}`);
      setRow(row.id, { certFile: url });
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('명세서 첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  const dday = (r: VehicleService) => {
    if (!r.nextDue || !today) return <span className="text-[11px] text-slate-300">미기재</span>;
    const days = daysUntil(r.nextDue, today);
    const level = noticeLevel(days, VEHICLE_SERVICE_NOTICE_DAYS);
    const text = days < 0 ? `D+${-days}` : `D-${days}`;
    if (!level) return <span className="font-mono text-[11px] text-slate-400">{text}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>{text}</span>
    );
  };

  const filtered = itemFilter ? rows.filter((r) => r.item === itemFilter) : rows;
  const overdue = today
    ? rows.filter((r) => r.nextDue && daysUntil(r.nextDue, today) < 0).length
    : 0;
  const missing = rows.filter((r) => !r.replacedAt).length;

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            🚙 차량점검내역
            <span className="ml-1.5 font-normal text-slate-400">
              {rows.length}건 · 차량 {new Set(rows.map((r) => r.plate)).size}대
            </span>
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          {overdue > 0 && (
            <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">교체시기 초과 {overdue}건</span>
          )}
          {missing > 0 && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">교체일 미기재 {missing}건</span>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
            정비항목
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
              aria-label="정비항목 필터"
            >
              <option value="">전체</option>
              {itemOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        {VEHICLE_CATEGORIES.map((cat) => {
          const list = filtered.filter((r) => r.category === cat);
          const style = CATEGORY_STYLE[cat];
          return (
            <section key={cat} className="mb-5">
              <p className="mb-1.5 flex items-center gap-1.5">
                <span aria-hidden className={`h-3 w-1 rounded-full ${style.bar}`} />
                <span className="text-xs font-bold text-slate-600">{cat}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.chip}`}>{list.length}건</span>
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[1420px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                      <th className={`${TH} w-64`}>장비명</th>
                      <th className={`${TH} w-36`}>차량번호</th>
                      <th className={`${TH} w-36`}>정비항목</th>
                      <th className={`${TH} w-40`}>교체일</th>
                      <th className={`${TH} w-24 text-center`}>주기(개월)</th>
                      <th className={`${TH} w-40`}>차기 교체일</th>
                      <th className={`${TH} w-24 text-center`}>D-day</th>
                      <th className={`${TH} w-32 text-center`}>명세서</th>
                      <th className={`${TH} w-52`}>비고</th>
                      <th className="w-10 px-1 py-2" aria-label="행 삭제" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-4 text-center text-slate-300">
                          아래 ＋ 버튼으로 {cat}을 추가해 주세요
                        </td>
                      </tr>
                    )}
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td className="px-1.5 py-1.5">
                          <input aria-label="장비명" placeholder="예: 봉고Ⅲ 1톤" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input aria-label="차량번호" placeholder="예: 12가 3456" value={r.plate} onChange={(e) => setRow(r.id, { plate: e.target.value })} className={CELL} />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            aria-label="정비항목"
                            list="vs-items"
                            placeholder="엔진오일"
                            value={r.item}
                            onChange={(e) => {
                              const item = e.target.value;
                              const cycle = defaultCycle(item);
                              setRow(r.id, { item, cycleMonths: cycle, nextDue: nextDueDate(r.replacedAt, cycle) });
                            }}
                            className={CELL}
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            aria-label="교체일"
                            type="date"
                            value={r.replacedAt}
                            onChange={(e) => setRow(r.id, { replacedAt: e.target.value, nextDue: nextDueDate(e.target.value, r.cycleMonths) })}
                            className={CELL}
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input
                            aria-label="주기(개월)"
                            type="number"
                            min={1}
                            value={r.cycleMonths}
                            onChange={(e) => {
                              const cycle = Number(e.target.value) || 0;
                              setRow(r.id, { cycleMonths: cycle, nextDue: nextDueDate(r.replacedAt, cycle) });
                            }}
                            className={`${CELL} text-center`}
                          />
                        </td>
                        <td className="px-1.5 py-1.5">
                          <input aria-label="차기 교체일" type="date" value={r.nextDue} onChange={(e) => setRow(r.id, { nextDue: e.target.value })} className={CELL} />
                        </td>
                        <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center justify-center gap-1">
                            {r.certFile && (
                              <a
                                href={fileHref(r.certFile)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                                title={`${r.plate} ${r.item} 명세서 열기`}
                              >
                                📄 보기
                              </a>
                            )}
                            <label
                              htmlFor={`vs-${r.id}`}
                              className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                              title="정비명세서·영수증 첨부·교체 (PDF·이미지)"
                            >
                              {uploading === r.id ? '업로드중' : r.certFile ? '교체' : '첨부'}
                            </label>
                            <input
                              id={`vs-${r.id}`}
                              type="file"
                              accept="application/pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                void attachCert(r, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </div>
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
              <button
                onClick={() => add(cat)}
                className="mt-2 rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
              >
                ＋ {cat} 정비내역 추가
              </button>
            </section>
          );
        })}

        <datalist id="vs-items">
          {itemOptions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="border-t border-slate-100 pt-3">
          <SheetToolbar addLabel="" onUndo={() => void undo()} canUndo={canUndo} save={save} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          한 행이 「차량 1대 + 정비항목 1건」입니다. 같은 차량에 타이어·배터리 등을 계속 추가하면 차량별 교체 이력이
          항목별로 쌓이고, 위쪽 [정비항목] 필터로 원하는 항목만 모아 볼 수 있습니다. 교체일을 입력하면 주기(개월)만큼
          더한 차기 교체일이 자동 계산되며(엔진오일 12개월), 차기 교체 {VEHICLE_SERVICE_NOTICE_DAYS}일 전부터 메인
          [공무관리 현황]에 D-day가 표시됩니다.
        </p>
      </div>
    </div>
  );
}
