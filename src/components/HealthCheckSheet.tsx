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
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';

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
 */
export default function HealthCheckSheet({ kind }: { kind: HealthCheck['kind'] }) {
  const [tab, setTab] = useState<HealthCheck['group']>('직원');
  const tabBtn = (active: boolean) =>
    `rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-bold ${
      active ? 'border-slate-200 bg-white text-[#1f3864]' : 'border-transparent bg-slate-100 text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="mx-auto max-w-6xl">
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
  const { entries, mode, add, remove } = useSyncedLog<HealthCheck>('health', HEALTH_KEY);
  const seed = useMemo(() => (kind === 'general' ? healthGeneralSeed() : []), [kind]);
  const [rows, setRows] = useState<HealthCheck[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  useEffect(() => {
    if (mode === 'loading' || dirty) return;
    const saved = entries.filter((e) => e.kind === kind && e.group === group);
    const savedNames = new Set(saved.map((s) => s.name.trim()));
    const pending = seed.filter((s) => s.group === group && !savedNames.has(s.name.trim()));
    setRows([...saved, ...pending].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  }, [entries, mode, dirty, kind, group, seed]);

  const setRow = (id: string, patch: Partial<HealthCheck>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    seq.current += 1;
    setRows((list) => [
      ...list,
      {
        id: `HC-${kind}-${Date.now()}-${seq.current}`,
        kind,
        group,
        name: '',
        birth: '',
        checkDate: '',
        renewDate: '',
        note: '',
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

  const save = async () => {
    if (saving) return;
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
          (orig.birth ?? '') !== (r.birth ?? '') ||
          orig.checkDate !== r.checkDate ||
          orig.renewDate !== r.renewDate ||
          (orig.certFile ?? '') !== (r.certFile ?? '') ||
          (orig.note ?? '') !== (r.note ?? '');
        if (changed) {
          await add({ ...r, name: r.name.trim(), updatedAt: new Date().toISOString() });
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

  const pendingCount = rows.filter((r) => r.name.trim() && !entries.some((e) => e.id === r.id)).length;

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
          <span className="ml-1.5 font-normal text-slate-400">{rows.length}명</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        {dirty && <span className="text-[11px] font-semibold text-orange-500">● 저장되지 않은 변경</span>}
        {!dirty && pendingCount > 0 && (
          <span className="text-[11px] text-slate-400">명부 {pendingCount}명 — [변경사항 저장]을 누르면 등록됩니다</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[820px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className="min-w-24 px-2 py-2 font-semibold">성명</th>
              <th className="w-36 px-2 py-2 font-semibold">생년월일</th>
              <th className="w-36 px-2 py-2 font-semibold">검진일자</th>
              <th className="w-36 px-2 py-2 font-semibold">갱신일자 (1년)</th>
              <th className="w-20 px-2 py-2 text-center font-semibold">D-day</th>
              <th className="w-32 px-2 py-2 text-center font-semibold">이수증</th>
              <th className="min-w-20 px-2 py-2 font-semibold">비고</th>
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-1.5 py-1.5">
                  <input aria-label="성명" placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={cell} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="생년월일" type="date" value={r.birth ?? ''} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={cell} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input
                    aria-label="검진일자"
                    type="date"
                    value={r.checkDate}
                    onChange={(e) => setRow(r.id, { checkDate: e.target.value, renewDate: healthRenewDate(e.target.value) })}
                    className={cell}
                  />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="갱신일자" type="date" value={r.renewDate} onChange={(e) => setRow(r.id, { renewDate: e.target.value })} className={cell} />
                </td>
                <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-1">
                    {r.certFile && (
                      <a
                        href={encodeURI(r.certFile)}
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
                      className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
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
                  <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={cell} />
                </td>
                <td className="px-1 py-1.5 text-center">
                  <button aria-label="행 삭제" onClick={() => removeRow(r.id, r.name)} className="text-slate-300 hover:text-red-500">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
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
        검진일자를 입력하면 갱신일자(1년 후)가 자동 입력되며 직접 수정할 수 있습니다. 이수증은 [첨부]로 올리고 [교체]로
        바꿀 수 있으며, 갱신 {HEALTH_NOTICE_DAYS}일 전부터 메인 [공무관리 현황]에 D-day가 표시됩니다.
      </p>
    </div>
  );
}
