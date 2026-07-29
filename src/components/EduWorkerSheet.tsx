'use client';

import { useEffect, useRef, useState } from 'react';
import { NOTICE_STYLE, chemicalRenewalFromDates, daysUntil, noticeLevel } from '@/lib/education';
import { SyncError, uploadCert, type LogType } from '@/lib/sync';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import { YNCC_NOTICE_DAYS, type EduSheetWorker } from '@/lib/yncc';

interface Props {
  logType: LogType;
  localKey: string;
  group: '직원' | '인력';
  /** yncc: 교육유효종료일 입력·기준 / chem: 이수년도 기준 갱신일 / supervisor: 이수일 + 1년 */
  variant: 'yncc' | 'chem' | 'supervisor';
  /** 저장 이력이 없을 때 표시할 초기 명부 (정적 수료증 명부 이관용) */
  seed?: EduSheetWorker[];
}

/** 파일 → dataURL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 교육 입력 시트(직원·인력 공용) — 작업자명·생년월일·집체/온라인 이수일자·수료증 (+YNCC 교육유효종료일).
 * 집체교육과 온라인교육 이수일자가 같으면 등록(저장)할 수 없다.
 */
export default function EduWorkerSheet({ logType, localKey, group, variant, seed }: Props) {
  const { entries, mode, add, remove } = useSyncedLog<EduSheetWorker>(logType, localKey);
  const [rows, setRows] = useState<EduSheetWorker[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  // 저장된 목록(해당 구분만)을 편집본으로 로드 — 편집 중에는 덮어쓰지 않는다
  useEffect(() => {
    if (mode === 'loading' || dirty) return;
    const saved = entries
      .filter((e) => e.group === group)
      .map((e) => ({ ...e, offlineDate: e.offlineDate ?? e.lastEdu ?? '' })); // 구버전 최근교육일 → 집체로 이관 표시
    // 아직 저장되지 않은 정적 명부 인원은 초기 데이터로 함께 보여준다
    const savedNames = new Set(saved.map((s) => s.name.trim()));
    const pending = (seed ?? []).filter((s) => s.group === group && !savedNames.has(s.name.trim()));
    setRows([...saved, ...pending].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  }, [entries, mode, dirty, group, seed]);

  const setRow = (id: string, patch: Partial<EduSheetWorker>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    seq.current += 1;
    setRows((list) => [
      ...list,
      {
        id: `${variant === 'chem' ? 'CW' : 'YW'}-${Date.now()}-${seq.current}`,
        group,
        name: '',
        birth: '',
        offlineDate: '',
        onlineDate: '',
        eduExpire: '',
        updatedAt: '',
      },
    ]);
    setDirty(true);
  };

  const removeRow = (id: string, name: string) => {
    if (name.trim() && !confirm(`[${name}] 행을 삭제할까요? [변경사항 저장]을 눌러야 반영됩니다.`)) return;
    setRows((list) => list.filter((r) => r.id !== id));
    if (entries.some((e) => e.id === id)) setRemovedIds((l) => [...l, id]);
    setDirty(true);
  };

  /** 수료증 첨부 — 서버(Blob)에 업로드하고 URL을 행에 기록 */
  const attachCert = async (row: EduSheetWorker, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.name || '수료증'}`);
      setRow(row.id, { certFile: url });
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert(
          '수료증 첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.\n(로컬 개발 환경에서는 저장소가 설정되지 않아 업로드되지 않습니다)',
        );
      } else {
        alert('수료증 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (saving) return;
    // ⚠️ 집체·온라인 이수일자 동일 검증 — 같은 날 두 교육을 모두 이수할 수 없다
    const conflict = rows.find(
      (r) => r.name.trim() && r.offlineDate && r.onlineDate && r.offlineDate === r.onlineDate,
    );
    if (conflict) {
      alert(
        `⚠️ 등록할 수 없습니다.\n\n[${conflict.name.trim()}] 집체교육과 온라인교육의 이수일자가 같습니다 (${conflict.offlineDate}).\n두 교육은 같은 날 이수할 수 없으니 날짜를 확인해 주세요.`,
      );
      return;
    }
    setSaving(true);
    try {
      for (const id of removedIds) {
        await remove(id);
      }
      for (const r of rows) {
        if (!r.name.trim()) continue;
        const orig = entries.find((e) => e.id === r.id);
        const changed =
          !orig ||
          orig.name !== r.name.trim() ||
          orig.birth !== r.birth ||
          (orig.offlineDate ?? orig.lastEdu ?? '') !== (r.offlineDate ?? '') ||
          (orig.onlineDate ?? '') !== (r.onlineDate ?? '') ||
          (orig.eduExpire ?? '') !== (r.eduExpire ?? '') ||
          (orig.certFile ?? '') !== (r.certFile ?? '');
        if (changed) {
          const { lastEdu: _legacy, ...rest } = r;
          await add({ ...rest, name: r.name.trim(), updatedAt: new Date().toISOString() });
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

  const renewOf = (r: EduSheetWorker): string | null => {
    if (variant === 'yncc') return r.eduExpire || null;
    if (variant === 'supervisor') {
      // 관리감독자 — 이수일 + 1년
      if (!r.offlineDate) return null;
      const d = new Date(`${r.offlineDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      d.setFullYear(d.getFullYear() + 1);
      const p = (n: number) => (n < 10 ? `0${n}` : String(n));
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    return chemicalRenewalFromDates(r.offlineDate, r.onlineDate);
  };

  const noticeDays = variant === 'supervisor' ? 90 : YNCC_NOTICE_DAYS;

  const dday = (r: EduSheetWorker) => {
    const renew = renewOf(r);
    if (!renew || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(renew, today);
    const level = noticeLevel(days, noticeDays);
    if (!level) return <span className="font-mono text-[11px] text-slate-400">D-{days}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>
        {days < 0 ? `D+${-days}` : `D-${days}`}
      </span>
    );
  };

  const pendingCount = rows.filter((r) => r.name.trim() && !entries.some((e) => e.id === r.id)).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          {group === '직원' ? '🧑‍💼 직원' : '👷 인력'} 교육 관리
          <span className="ml-1.5 font-normal text-slate-400">{rows.length}명</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        {dirty && <span className="text-[11px] font-semibold text-orange-500">● 저장되지 않은 변경</span>}
        {!dirty && pendingCount > 0 && (
          <span className="text-[11px] text-slate-400">명부 {pendingCount}명 — [변경사항 저장]을 누르면 등록됩니다</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[880px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className="min-w-28 px-2 py-2 font-semibold">작업자명</th>
              <th className="w-36 px-2 py-2 font-semibold">생년월일</th>
              <th className="w-36 px-2 py-2 font-semibold">
                {variant === 'supervisor' ? '이수일자' : '집체교육 이수일자'}
              </th>
              {variant !== 'supervisor' && <th className="w-36 px-2 py-2 font-semibold">온라인교육 이수일자</th>}
              {variant === 'yncc' ? (
                <th className="w-36 px-2 py-2 font-semibold">교육유효종료일</th>
              ) : (
                <th className="w-28 px-2 py-2 font-semibold">갱신 도래일</th>
              )}
              <th className="w-20 px-2 py-2 text-center font-semibold">D-day</th>
              <th className="w-28 px-2 py-2 text-center font-semibold">수료증</th>
              <th className="w-8 px-1 py-2" aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-slate-300">
                  아래 ＋ 버튼으로 {group}을 추가해 주세요
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const sameDate = !!(r.offlineDate && r.onlineDate && r.offlineDate === r.onlineDate);
              return (
                <tr key={r.id} className={sameDate ? 'bg-red-50' : ''}>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="작업자명" placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={cell} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="생년월일" type="date" value={r.birth} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={cell} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      aria-label={variant === 'supervisor' ? '이수일자' : '집체교육 이수일자'}
                      type="date"
                      value={r.offlineDate ?? ''}
                      onChange={(e) => setRow(r.id, { offlineDate: e.target.value })}
                      className={cell}
                    />
                  </td>
                  {variant !== 'supervisor' && (
                    <td className="px-1.5 py-1.5">
                      <input
                        aria-label="온라인교육 이수일자"
                        type="date"
                        value={r.onlineDate ?? ''}
                        onChange={(e) => setRow(r.id, { onlineDate: e.target.value })}
                        className={`${cell} ${sameDate ? 'border-red-200' : ''}`}
                        title={sameDate ? '집체교육과 이수일자가 같습니다 — 등록 불가' : undefined}
                      />
                    </td>
                  )}
                  {variant === 'yncc' ? (
                    <td className="px-1.5 py-1.5">
                      <input aria-label="교육유효종료일" type="date" value={r.eduExpire ?? ''} onChange={(e) => setRow(r.id, { eduExpire: e.target.value })} className={cell} />
                    </td>
                  ) : (
                    <td className="px-2 py-1.5 font-mono text-[11px] font-semibold text-slate-600">
                      {renewOf(r) ?? '—'}
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                      {r.certFile && (
                        <a
                          href={encodeURI(r.certFile)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                          title={`${r.name} 수료증 열기`}
                        >
                          📄 보기
                        </a>
                      )}
                      <label
                        htmlFor={`cert-${r.id}`}
                        className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                        title="수료증 첨부 (PDF·이미지)"
                      >
                        {uploading === r.id ? '업로드중' : r.certFile ? '교체' : '첨부'}
                      </label>
                      <input
                        id={`cert-${r.id}`}
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
                  <td className="px-1 py-1.5 text-center">
                    <button aria-label="행 삭제" onClick={() => removeRow(r.id, r.name)} className="text-slate-300 hover:text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
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
          ＋ {group} 추가
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
        {variant === 'yncc'
          ? `교육유효종료일 ${YNCC_NOTICE_DAYS}일 전부터 메인 [안전교육 현황]에 표시됩니다.`
          : '이수년도 기준 2년 유효(예: 24년 이수 → 27년 1월 갱신), 갱신년도 1월 1일 30일 전부터 메인에 표시됩니다.'}{' '}
        수료증은 [첨부]로 PDF·이미지를 올리면 [📄 보기]로 열람할 수 있습니다. 집체교육과 온라인교육의 이수일자가 같으면
        등록할 수 없습니다.
      </p>
    </div>
  );
}
