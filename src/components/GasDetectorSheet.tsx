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
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';

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
 * 상태가 [사용]인 장비만 D-day 알림 대상이다 (고장·분실·폐기는 관리 대상 제외).
 */
export default function GasDetectorSheet() {
  const { entries, mode, add, remove } = useSyncedLog<GasDetector>('detectors', DETECTOR_KEY);
  const seed = useMemo(() => detectorSeed(), []);
  const [rows, setRows] = useState<GasDetector[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [onlyInUse, setOnlyInUse] = useState(false);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  useEffect(() => {
    if (mode === 'loading' || dirty) return;
    const savedNos = new Set(entries.map((e) => e.mgmtNo.trim()));
    const pending = seed.filter((s) => !savedNos.has(s.mgmtNo.trim()));
    setRows([...entries, ...pending].sort(compareDetector));
  }, [entries, mode, dirty, seed]);

  const setRow = (id: string, patch: Partial<GasDetector>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    seq.current += 1;
    setRows((list) => [
      ...list,
      {
        id: `GD-${Date.now()}-${seq.current}`,
        mgmtNo: '',
        detector: '복합가스 측정기',
        model: '',
        usage: '',
        calDate: '',
        nextCalDate: '',
        kolas: true,
        maker: '',
        vendor: '',
        status: '사용' as DetectorStatus,
        note: '',
        updatedAt: '',
      },
    ]);
    setDirty(true);
  };

  const removeRow = (id: string, mgmtNo: string) => {
    if (mgmtNo.trim() && !confirm(`[${mgmtNo}] 행을 삭제할까요? [변경사항 저장]을 눌러야 반영됩니다.`)) return;
    setRows((list) => list.filter((r) => r.id !== id));
    if (entries.some((e) => e.id === id)) setRemovedIds((l) => [...l, id]);
    setDirty(true);
  };

  /** 교정성적서 첨부·교체 */
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

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      for (const id of removedIds) {
        await remove(id);
      }
      for (const r of rows) {
        if (!r.mgmtNo.trim()) continue;
        const orig = entries.find((e) => e.id === r.id);
        const changed =
          !orig ||
          orig.mgmtNo !== r.mgmtNo.trim() ||
          orig.detector !== r.detector ||
          orig.model !== r.model ||
          orig.usage !== r.usage ||
          orig.calDate !== r.calDate ||
          orig.nextCalDate !== r.nextCalDate ||
          orig.kolas !== r.kolas ||
          orig.maker !== r.maker ||
          orig.vendor !== r.vendor ||
          orig.status !== r.status ||
          (orig.certFile ?? '') !== (r.certFile ?? '') ||
          (orig.note ?? '') !== (r.note ?? '');
        if (changed) {
          await add({ ...r, mgmtNo: r.mgmtNo.trim(), updatedAt: new Date().toISOString() });
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

  const pendingCount = rows.filter((r) => r.mgmtNo.trim() && !entries.some((e) => e.id === r.id)).length;

  /** 상태가 [사용]인 장비만 D-day를 계산한다 */
  const dday = (r: GasDetector) => {
    if (r.status !== '사용') return <span className="text-[11px] text-slate-300">관리 제외</span>;
    if (!r.nextCalDate || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.nextCalDate, today);
    const level = noticeLevel(days, DETECTOR_NOTICE_DAYS);
    if (!level) return <span className="font-mono text-[11px] text-slate-400">D-{days}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>
        {days < 0 ? `D+${-days}` : `D-${days}`}
      </span>
    );
  };

  const shown = onlyInUse ? rows.filter((r) => r.status === '사용') : rows;
  const inUse = rows.filter((r) => r.status === '사용').length;
  const overdue = today
    ? rows.filter((r) => r.status === '사용' && r.nextCalDate && daysUntil(r.nextCalDate, today) < 0).length
    : 0;

  /** 종류가 바뀌는 첫 행 앞에 구분 머리글을 넣는다 */
  const kindHeaderAt = (i: number): string | null => {
    const k = detectorKind(shown[i].mgmtNo);
    if (i === 0) return k;
    return detectorKind(shown[i - 1].mgmtNo) === k ? null : k;
  };

  return (
    <div className="mx-auto max-w-7xl">
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
          {dirty && <span className="text-[11px] font-semibold text-orange-500">● 저장되지 않은 변경</span>}
          {!dirty && pendingCount > 0 && (
            <span className="text-[11px] text-slate-400">대장 {pendingCount}대 — [변경사항 저장]을 누르면 등록됩니다</span>
          )}
          <button
            onClick={() => setOnlyInUse(!onlyInUse)}
            className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            {onlyInUse ? '전체 보기' : '사용 장비만 보기'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1180px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className="w-24 px-2 py-2 font-semibold">관리번호</th>
                <th className="w-40 px-2 py-2 font-semibold">MODEL</th>
                <th className="min-w-36 px-2 py-2 font-semibold">용도</th>
                <th className="w-32 px-2 py-2 font-semibold">검교정일</th>
                <th className="w-32 px-2 py-2 font-semibold">차기 검교정일</th>
                <th className="w-20 px-2 py-2 text-center font-semibold">D-day</th>
                <th className="w-32 px-2 py-2 font-semibold">제조사</th>
                <th className="w-20 px-2 py-2 font-semibold">검교정업체</th>
                <th className="w-12 px-1 py-2 text-center font-semibold">KOLAS</th>
                <th className="w-20 px-1 py-2 text-center font-semibold">상태</th>
                <th className="w-28 px-2 py-2 text-center font-semibold">성적서</th>
                <th className="min-w-24 px-2 py-2 font-semibold">비고</th>
                <th className="w-8 px-1 py-2" aria-label="행 삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-4 text-center text-slate-300">
                    아래 ＋ 버튼으로 측정기를 추가해 주세요
                  </td>
                </tr>
              )}
              {shown.map((r, i) => {
                const head = kindHeaderAt(i);
                const dim = r.status !== '사용';
                return (
                  <Fragment key={r.id}>
                    {head && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={13} className="px-2 py-1 text-[10px] font-bold tracking-wide text-slate-500">
                          {DETECTOR_KIND_LABEL[head] ?? head}
                        </td>
                      </tr>
                    )}
                    <tr className={dim ? 'bg-slate-50/40' : ''}>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label="관리번호"
                          placeholder="SJ-5G-10"
                          value={r.mgmtNo}
                          onChange={(e) => setRow(r.id, { mgmtNo: e.target.value })}
                          className={`${cell} font-mono`}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="MODEL" value={r.model} onChange={(e) => setRow(r.id, { model: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="용도" placeholder="O2, CO, H2S, LEL" value={r.usage} onChange={(e) => setRow(r.id, { usage: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label="검교정일"
                          type="date"
                          value={r.calDate}
                          onChange={(e) => setRow(r.id, { calDate: e.target.value, nextCalDate: detectorNextCalDate(e.target.value) })}
                          className={cell}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="차기 검교정일" type="date" value={r.nextCalDate} onChange={(e) => setRow(r.id, { nextCalDate: e.target.value })} className={cell} />
                      </td>
                      <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="제조사" value={r.maker} onChange={(e) => setRow(r.id, { maker: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="검교정업체" value={r.vendor} onChange={(e) => setRow(r.id, { vendor: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <input
                          aria-label="KOLAS 인정"
                          type="checkbox"
                          checked={r.kolas}
                          onChange={(e) => setRow(r.id, { kolas: e.target.checked })}
                          className="h-3.5 w-3.5 accent-cyan-600"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          aria-label="상태"
                          value={r.status}
                          onChange={(e) => setRow(r.id, { status: e.target.value as DetectorStatus })}
                          className={`${cell} font-semibold ${DETECTOR_STATUS_STYLE[r.status]}`}
                          title="[사용]인 장비만 교정일 D-day 알림 대상입니다"
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
                              href={encodeURI(r.certFile)}
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
                            className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
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
                        <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button aria-label="행 삭제" onClick={() => removeRow(r.id, r.mgmtNo)} className="text-slate-300 hover:text-red-500">
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

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={addRow}
            className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            ＋ 측정기 추가
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || (!dirty && pendingCount === 0)}
            className="rounded-lg bg-[#1f3864] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a4a80] disabled:opacity-50"
          >
            {saving ? '저장 중…' : '변경사항 저장'}
          </button>
          {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          검교정일을 입력하면 차기 검교정일(1년 후)이 자동 입력되며 직접 수정할 수 있습니다. 교정성적서는 [첨부]로 올리고
          [교체]로 바꿀 수 있으며, 차기 검교정 {DETECTOR_NOTICE_DAYS}일 전부터 메인 [공무관리 현황]에 D-day가 표시됩니다.
          상태가 [사용]인 장비만 알림 대상이고 고장·분실·폐기는 제외됩니다.
        </p>
      </div>
    </div>
  );
}
