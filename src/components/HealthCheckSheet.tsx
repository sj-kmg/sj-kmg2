'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import {
  HEALTH_KEY,
  HEALTH_LABEL,
  HEALTH_NOTICE_DAYS,
  healthGeneralSeed,
  healthRenewDate,
  type HealthCheck,
} from '@/lib/health';
import { SyncError, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { CELL, SheetToolbar, TH } from './SheetUI';
import { fileHref } from '@/lib/ids';

const GROUPS: HealthCheck['group'][] = ['직원', '인력'];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 건강검진(일반·특수) 시트 — 직원/인력 탭.
 * 검진일자를 입력하면 갱신일자(1년 후)가 자동 입력되고, 결과서(이수증)를 첨부·교체할 수 있다.
 * 값을 바꾸면 자동 저장되며 [되돌리기]로 직전 상태로 복구할 수 있다.
 */
export default function HealthCheckSheet({ kind }: { kind: HealthCheck['kind'] }) {
  const [tab, setTab] = useState<HealthCheck['group']>('직원');
  const tabBtn = (active: boolean) =>
    `rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-bold ${
      active ? 'border-slate-200 bg-white text-[#1f3864]' : 'border-transparent bg-slate-100 text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex gap-1">
        {GROUPS.map((g) => (
          <button key={g} onClick={() => setTab(g)} className={tabBtn(tab === g)}>
            {g === '직원' ? '🧑‍💼' : '👷'} {g}
          </button>
        ))}
      </div>
      <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Sheet kind={kind} group={tab} />
      </div>
    </div>
  );
}

function Sheet({ kind, group }: { kind: HealthCheck['kind']; group: HealthCheck['group'] }) {
  const seed = useMemo(() => (kind === 'general' ? healthGeneralSeed() : []), [kind]);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<HealthCheck>(
    'health',
    HEALTH_KEY,
    {
      seed,
      isBlank: (r) => !r.name.trim(),
      sort: (a, b) => a.name.localeCompare(b.name, 'ko'),
    },
  );

  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  // 이 탭(검진종류·소속)에 해당하는 행만 보여준다
  const shown = rows.filter((r) => r.kind === kind && r.group === group);

  const add = () => {
    seq.current += 1;
    addRow({
      id: `HC-${kind}-${Date.now()}-${seq.current}`,
      kind,
      group,
      name: '',
      birth: '',
      checkDate: '',
      renewDate: '',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: HealthCheck) => {
    if (r.name.trim() && !confirm(`[${r.name}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  /** 결과서(이수증) 첨부·교체 */
  const attachCert = async (row: HealthCheck, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.name || '검진결과'}`);
      setRow(row.id, { certFile: url });
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('결과서 첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  const dday = (r: HealthCheck) => {
    if (!r.renewDate || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.renewDate, today);
    const level = noticeLevel(days, HEALTH_NOTICE_DAYS);
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
          🩺 {HEALTH_LABEL[kind]} — {group}
          <span className="ml-1.5 font-normal text-slate-400">{shown.length}명</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1100px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className={`${TH} w-36`}>성명</th>
              <th className={`${TH} w-40`}>생년월일</th>
              <th className={`${TH} w-40`}>검진일자</th>
              <th className={`${TH} w-40`}>갱신일자 (1년)</th>
              <th className={`${TH} w-24 text-center`}>D-day</th>
              <th className={`${TH} w-36 text-center`}>이수증</th>
              <th className={`${TH} w-56`}>비고</th>
              <th className="w-10 px-1 py-2" aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-slate-300">
                  아래 ＋ 버튼으로 {group}을 추가해 주세요
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-1.5 py-1.5">
                  <input aria-label="성명" placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="생년월일" type="date" value={r.birth ?? ''} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={CELL} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input
                    aria-label="검진일자"
                    type="date"
                    value={r.checkDate}
                    onChange={(e) => setRow(r.id, { checkDate: e.target.value, renewDate: healthRenewDate(e.target.value) })}
                    className={CELL}
                  />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="갱신일자" type="date" value={r.renewDate} onChange={(e) => setRow(r.id, { renewDate: e.target.value })} className={CELL} />
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
                        title={`${r.name} 결과서 열기`}
                      >
                        📄 보기
                      </a>
                    )}
                    <label
                      htmlFor={`hc-${r.id}`}
                      className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                      title="결과서 첨부·교체 (PDF·이미지)"
                    >
                      {uploading === r.id ? '업로드중' : r.certFile ? '교체' : '첨부'}
                    </label>
                    <input
                      id={`hc-${r.id}`}
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

      <SheetToolbar addLabel={`＋ ${group} 추가`} onAdd={add} onUndo={() => void undo()} canUndo={canUndo} save={save} />

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        검진일자를 입력하면 갱신일자(1년 후)가 자동 입력되며 직접 수정할 수 있습니다. 이수증은 [첨부]로 올리고 [교체]로
        바꿀 수 있으며, 갱신 {HEALTH_NOTICE_DAYS}일 전부터 메인 [공무관리 현황]에 D-day가 표시됩니다.
      </p>
    </div>
  );
}
