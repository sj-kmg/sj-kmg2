'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import {
  AIR_UNIT_COUNT,
  EQUIP_KEY,
  EQUIP_META,
  EQUIP_NOTICE_DAYS,
  EQUIP_STATUSES,
  EQUIP_STATUS_STYLE,
  airDistributorSeed,
  compareEquip,
  equipNextDue,
  type EquipCheck,
  type EquipStatus,
} from '@/lib/equipment';
import { fileHref } from '@/lib/ids';
import { SyncError, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { CELL, SheetToolbar, TH } from './SheetUI';

const META = EQUIP_META.AIR분배기;

/** 새로 추가하는 행의 ID — 렌더 중 계산되지 않도록 모듈 함수로 분리한다 */
function newRowId(seq: number): string {
  return `EQ-${Date.now()}-${seq}`;
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
 * 장비점검 › AIR분배기 — 호기별 필터교체 현황.
 * 교체일자를 넣으면 차기 교체예정일(6개월 후)이 자동 계산되고,
 * 차기 교체 60일 전부터 메인 [공무관리 현황]에 D-day가 표시된다.
 */
export default function AirDistributorSheet() {
  const seed = useMemo(() => airDistributorSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<EquipCheck>(
    'equipment',
    EQUIP_KEY,
    {
      seed,
      isBlank: (r) => !r.name.trim(),
      sort: compareEquip,
    },
  );

  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  const air = rows.filter((r) => r.equip === 'AIR분배기');
  const done = air.filter((r) => r.status === '교체 완료').length;
  const notDone = air.filter((r) => r.status === '미실시').length;
  const actionSum = air.reduce((n, r) => n + (Number(r.actionCount) || 0), 0);

  const add = () => {
    seq.current += 1;
    const nextUnit = air.length ? Math.max(...air.map((r) => r.unitNo)) + 1 : 1;
    addRow({
      id: newRowId(seq.current),
      equip: 'AIR분배기',
      unitNo: nextUnit,
      name: `에어분배기 ${nextUnit}호기`,
      status: '',
      doneAt: '',
      nextDue: '',
      actionCount: 0,
      owner: '',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: EquipCheck) => {
    if (r.name.trim() && !confirm(`[${r.name}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  const attach = async (row: EquipCheck, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.name}_${META.itemLabel}`);
      setRow(row.id, { certFile: url });
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

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  const dday = (r: EquipCheck) => {
    if (!r.nextDue || !today) return <span className="text-[11px] text-slate-300">미기재</span>;
    const days = daysUntil(r.nextDue, today);
    const level = noticeLevel(days, EQUIP_NOTICE_DAYS);
    const text = days < 0 ? `D+${-days}` : `D-${days}`;
    if (!level) return <span className="font-mono text-[11px] text-slate-400">{text}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>{text}</span>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          🔧 에어분배기 관리현황
          <span className="ml-1.5 font-normal text-slate-400">총 관리대수 {air.length}</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
          {META.itemLabel} 완료 {done}
        </span>
        {notDone > 0 && (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">미실시 {notDone}</span>
        )}
        {actionSum > 0 && (
          <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">조치 필요 {actionSum}건</span>
        )}
        <span className="ml-auto text-[11px] text-slate-500">점검주기 {META.cycleLabel}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1360px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className={`${TH} w-14 text-center`}>No</th>
              <th className={`${TH} w-56`}>설비명</th>
              <th className={`${TH} w-32`}>{META.itemLabel} 여부</th>
              <th className={`${TH} w-40`}>{META.itemLabel}일자</th>
              <th className={`${TH} w-40`}>차기 교체예정일</th>
              <th className={`${TH} w-24 text-center`}>D-day</th>
              <th className={`${TH} w-28 text-center`}>조치 필요</th>
              <th className={`${TH} w-28`}>담당자</th>
              <th className={`${TH} w-56`}>비고</th>
              <th className={`${TH} w-32 text-center`}>첨부</th>
              <th className="w-10 px-1 py-2" aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {air.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-slate-300">
                  아래 ＋ 버튼으로 설비를 추가해 주세요
                </td>
              </tr>
            )}
            {air.map((r) => (
              <tr key={r.id} className={r.status === '미실시' ? 'bg-amber-50/40' : ''}>
                <td className="px-2 py-1.5 text-center font-mono text-slate-400">{r.unitNo}</td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="설비명" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                </td>
                <td className="px-1 py-1.5">
                  <select
                    aria-label="교체 여부"
                    value={r.status}
                    onChange={(e) => setRow(r.id, { status: e.target.value as EquipStatus })}
                    className={`${CELL} font-semibold ${r.status ? EQUIP_STATUS_STYLE[r.status] : ''}`}
                  >
                    <option value="">선택</option>
                    {EQUIP_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1.5 py-1.5">
                  <input
                    aria-label="교체일자"
                    type="date"
                    value={r.doneAt}
                    onChange={(e) => setRow(r.id, { doneAt: e.target.value, nextDue: equipNextDue(e.target.value, META.cycleMonths) })}
                    className={CELL}
                  />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="차기 교체예정일" type="date" value={r.nextDue} onChange={(e) => setRow(r.id, { nextDue: e.target.value })} className={CELL} />
                </td>
                <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                <td className="px-1.5 py-1.5">
                  <input
                    aria-label="조치 필요 건수"
                    type="number"
                    min={0}
                    value={r.actionCount}
                    onChange={(e) => setRow(r.id, { actionCount: Number(e.target.value) || 0 })}
                    className={`${CELL} text-center`}
                  />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="담당자" value={r.owner} onChange={(e) => setRow(r.id, { owner: e.target.value })} className={CELL} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="비고" value={r.note} onChange={(e) => setRow(r.id, { note: e.target.value })} className={CELL} />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-1">
                    {r.certFile && (
                      <a
                        href={fileHref(r.certFile)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                        title={`${r.name} 자료 열기`}
                      >
                        📄 보기
                      </a>
                    )}
                    <label
                      htmlFor={`eq-${r.id}`}
                      className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                      title="점검·교체 증빙 첨부·교체 (PDF·이미지)"
                    >
                      {uploading === r.id ? '업로드중' : r.certFile ? '교체' : '첨부'}
                    </label>
                    <input
                      id={`eq-${r.id}`}
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
                  <button aria-label="행 삭제" onClick={() => del(r)} className="text-slate-300 hover:text-red-500">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SheetToolbar addLabel="＋ 설비 추가" onAdd={add} onUndo={() => void undo()} canUndo={canUndo} save={save} />

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        {META.itemLabel}일자를 입력하면 차기 교체예정일(6개월 후)이 자동 계산되며 직접 수정할 수 있습니다. 점검·교체
        증빙은 [첨부]로 올리고 [교체]로 바꿀 수 있으며, 차기 교체 {EQUIP_NOTICE_DAYS}일 전부터 메인 [공무관리 현황]에
        D-day가 표시됩니다. 값을 바꾸면 자동 저장됩니다. (총 {AIR_UNIT_COUNT}호기 기준)
      </p>
    </div>
  );
}
