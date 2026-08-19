'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  DETECTOR_KEY,
  DETECTOR_KIND_LABEL,
  DETECTOR_NOTICE_DAYS,
  DETECTOR_STATUSES,
  DETECTOR_STATUS_STYLE,
  compareDetector,
  detectorKind,
  detectorNextCalDate,
  detectorSeed,
  type DetectorStatus,
  type GasDetector,
} from '@/lib/detector';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import { SyncError, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { useSortable } from '@/lib/useSortable';
import { CELL, SheetToolbar, SortButton, TD_STICKY_POS, TH, TH_STICKY } from './SheetUI';
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
 * 공무관리 › 산소&가스측정기 — 검교정 관리대장.
 * 검교정일을 입력하면 차기 검교정일(1년 후)이 자동 입력되고, 교정성적서를 첨부·교체할 수 있다.
 * 값을 바꾸면 자동 저장되며 [되돌리기]로 직전 상태로 복구할 수 있다.
 */
export default function GasDetectorSheet() {
  const seed = useMemo(() => detectorSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<GasDetector>(
    'detectors',
    DETECTOR_KEY,
    {
      seed,
      isBlank: (r) => !r.mgmtNo.trim(),
      sort: compareDetector,
    },
  );

  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [onlyInUse, setOnlyInUse] = useState(false);
  const sortCtl = useSortable<GasDetector>();
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  const add = () => {
    seq.current += 1;
    addRow({
      id: `GD-${Date.now()}-${seq.current}`,
      mgmtNo: '',
      detector: '복합가스 측정기',
      model: '',
      usage: '',
      calDate: '',
      nextCalDate: '',
      maker: '',
      vendor: '',
      status: '사용',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: GasDetector) => {
    if (r.mgmtNo.trim() && !confirm(`[${r.mgmtNo}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  /** 교정성적서 첨부·교체 — 파일명에 관리번호가 들어가 저장소에서도 구분된다 */
  const attachCert = async (row: GasDetector, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.mgmtNo || '교정성적서'}`);
      setRow(row.id, { certFile: url });
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('성적서 첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  /** 상태와 무관하게 차기 검교정일 기준 D-day를 표시한다 */
  const dday = (r: GasDetector) => {
    if (!r.nextCalDate || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.nextCalDate, today);
    const level = noticeLevel(days, DETECTOR_NOTICE_DAYS);
    const text = days < 0 ? `D+${-days}` : `D-${days}`;
    if (!level) return <span className="font-mono text-[11px] text-slate-400">{text}</span>;
    // 사용 중이 아닌 장비는 같은 D-day를 흐리게 (메인 알림 대상은 사용 장비만)
    if (r.status !== '사용') {
      return <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-400">{text}</span>;
    }
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>{text}</span>
    );
  };

  const shown = sortCtl.apply(onlyInUse ? rows.filter((r) => r.status === '사용') : rows, {
    mgmtNo: (r) => r.mgmtNo,
    due: (r) => r.nextCalDate,
  });
  const inUse = rows.filter((r) => r.status === '사용').length;
  const overdue = today
    ? rows.filter((r) => r.status === '사용' && r.nextCalDate && daysUntil(r.nextCalDate, today) < 0).length
    : 0;

  const kindHeaderAt = (i: number): string | null => {
    const k = detectorKind(shown[i].mgmtNo);
    if (i === 0) return k;
    return detectorKind(shown[i - 1].mgmtNo) === k ? null : k;
  };

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            🧪 산소·가스측정기 검교정 관리
            <span className="ml-1.5 font-normal text-slate-400">
              전체 {rows.length}대 · 사용 {inUse}대
            </span>
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          {overdue > 0 && (
            <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
              교정 기한 초과 {overdue}대
            </span>
          )}
          <button
            onClick={() => setOnlyInUse(!onlyInUse)}
            className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            {onlyInUse ? '전체 보기' : '사용 장비만 보기'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1560px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className={`${TH} ${TH_STICKY} w-28`}>관리번호<SortButton ctl={sortCtl} col="mgmtNo" label="관리번호" /></th>
                <th className={`${TH} w-44`}>MODEL</th>
                <th className={`${TH} w-44`}>용도</th>
                <th className={`${TH} w-36`}>검교정일</th>
                <th className={`${TH} w-36`}>차기 검교정일</th>
                <th className={`${TH} w-20 text-center`}>D-day<SortButton ctl={sortCtl} col="due" label="D-day" /></th>
                <th className={`${TH} w-44`}>제조사</th>
                <th className={`${TH} w-24`}>검교정업체</th>
                <th className={`${TH} w-24 text-center`}>상태</th>
                <th className={`${TH} w-32 text-center`}>성적서</th>
                <th className={`${TH} w-40`}>비고</th>
                <th className="w-10 px-1 py-2" aria-label="행 삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-4 text-center text-slate-300">
                    아래 ＋ 버튼으로 측정기를 추가해 주세요
                  </td>
                </tr>
              )}
              {shown.map((r, i) => {
                const head = kindHeaderAt(i);
                return (
                  <Fragment key={r.id}>
                    {head && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={12} className="px-2 py-1 text-[10px] font-bold tracking-wide text-slate-500">
                          {DETECTOR_KIND_LABEL[head] ?? head}
                        </td>
                      </tr>
                    )}
                    <tr className={r.status !== '사용' ? 'bg-slate-50/40' : ''}>
                      <td className={`${TD_STICKY_POS} ${r.status !== '사용' ? 'bg-slate-50/40' : 'bg-white'} px-1.5 py-1.5`}>
                        <input aria-label="관리번호" placeholder="SJ-5G-10" value={r.mgmtNo} onChange={(e) => setRow(r.id, { mgmtNo: e.target.value })} className={`${CELL} font-mono`} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="MODEL" value={r.model} onChange={(e) => setRow(r.id, { model: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="용도" placeholder="O2, CO, H2S, LEL" value={r.usage} onChange={(e) => setRow(r.id, { usage: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label="검교정일"
                          type="date"
                          value={r.calDate}
                          onChange={(e) => setRow(r.id, { calDate: e.target.value, nextCalDate: detectorNextCalDate(e.target.value) })}
                          className={CELL}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="차기 검교정일" type="date" value={r.nextCalDate} onChange={(e) => setRow(r.id, { nextCalDate: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="제조사" value={r.maker} onChange={(e) => setRow(r.id, { maker: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="검교정업체" value={r.vendor} onChange={(e) => setRow(r.id, { vendor: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          aria-label="상태"
                          value={r.status}
                          onChange={(e) => setRow(r.id, { status: e.target.value as DetectorStatus })}
                          className={`${CELL} font-semibold ${DETECTOR_STATUS_STYLE[r.status]}`}
                          title="메인 [공무관리 현황] 알림은 [사용] 장비만 표시됩니다"
                        >
                          {DETECTOR_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          {r.certFile && (
                            <a
                              href={fileHref(r.certFile)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                              title={`${r.mgmtNo} 교정성적서 열기`}
                            >
                              📄 보기
                            </a>
                          )}
                          <label
                            htmlFor={`gd-${r.id}`}
                            className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                            title="교정성적서 첨부·교체 (PDF·이미지)"
                          >
                            {uploading === r.id ? '업로드중' : r.certFile ? '교체' : '첨부'}
                          </label>
                          <input
                            id={`gd-${r.id}`}
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
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <SheetToolbar addLabel="＋ 측정기 추가" onAdd={add} onUndo={() => void undo()} canUndo={canUndo} save={save} />

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          검교정일을 입력하면 차기 검교정일(1년 후)이 자동 입력되며 직접 수정할 수 있습니다. 교정성적서는 [첨부]로 올리고
          [교체]로 바꿀 수 있습니다. 차기 검교정 {DETECTOR_NOTICE_DAYS}일 전부터 메인 [공무관리 현황]에 D-day가 표시되며, 메인 알림은 상태가
          [사용]인 장비만 올라옵니다.
        </p>
      </div>
    </div>
  );
}
