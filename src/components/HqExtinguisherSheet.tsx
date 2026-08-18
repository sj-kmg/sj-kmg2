'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EXT_HQ_CHECK_KEY,
  EXT_HQ_KEY,
  MONTH_LABEL,
  hqCheckId,
  hqExtinguisherCheckSeed,
  hqExtinguisherSeed,
  type HqExtinguisher,
  type HqExtinguisherCheck,
} from '@/lib/extinguisher';
import { useSyncedLog, modeBadge } from '@/lib/useSyncedLog';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { CELL, SheetToolbar, TD_STICKY, TH, TH_STICKY } from './SheetUI';

/**
 * 공무관리 › 소화기관리 › 본사 소화기 — 위치·규격·소화기번호별 월별 점검대장.
 * 점검 체크는 연·월 단위로 저장되어 매년 새로 시작된다 (공무연간계획과 같은 방식).
 */
export default function HqExtinguisherSheet() {
  const rosterSeed = useMemo(() => hqExtinguisherSeed(), []);
  const roster = useSheetLog<HqExtinguisher>('extinguisher-hq', EXT_HQ_KEY, {
    seed: rosterSeed,
    isBlank: (r) => !r.location.trim() && !r.extNo.trim(),
    // 위치별로 묶어 보이도록 정렬 — 저장소는 순서를 보장하지 않아 매번 정렬해야 안정적이다
    sort: (a, b) => a.location.localeCompare(b.location, 'ko') || a.extNo.localeCompare(b.extNo, 'ko', { numeric: true }),
  });

  const checkSeed = useMemo(() => hqExtinguisherCheckSeed(rosterSeed), [rosterSeed]);
  const { entries: checks, mode: checkMode, add: addCheck } = useSyncedLog<HqExtinguisherCheck>(
    'extinguisher-hq-check',
    EXT_HQ_CHECK_KEY,
  );

  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState<string | null>(null);

  // 저장 이력이 전혀 없을 때만 2026년 초기 점검 이력을 등록한다 (roster 시드 등록과 별개 이력)
  const checkSeeded = useRef(false);
  useEffect(() => {
    if (checkMode === 'loading' || checkSeeded.current) return;
    if (!checkSeed.length) return;
    checkSeeded.current = true;
    if (checks.length > 0) return;
    void (async () => {
      const BATCH = 20;
      for (let i = 0; i < checkSeed.length; i += BATCH) {
        await Promise.all(checkSeed.slice(i, i + BATCH).map((c) => addCheck(c)));
      }
    })();
  }, [checkMode, checks.length, checkSeed, addCheck]);

  const isChecked = (extId: string, month: number) =>
    checks.find((c) => c.id === hqCheckId(year, month, extId))?.done ?? false;

  const toggle = async (extId: string, month: number) => {
    const id = hqCheckId(year, month, extId);
    if (busy) return;
    const cur = isChecked(extId, month);
    setBusy(id);
    try {
      await addCheck({ id, year, month, extId, done: !cur, doneAt: !cur ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() });
    } finally {
      setBusy(null);
    }
  };

  const add = () => {
    roster.addRow({
      id: `EXT-hq-${Date.now()}`,
      location: '',
      spec: '',
      extNo: '',
      madeAt: '',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: HqExtinguisher) => {
    if (r.extNo.trim() && !confirm(`[${r.extNo}] 소화기 기록을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void roster.removeRow(r.id);
  };

  const badge = modeBadge(roster.mode);
  const save = saveBadge(roster.status, roster.mode);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          🧯 본사 소화기 관리대장
          <span className="ml-1.5 font-normal text-slate-400">{roster.rows.length}대</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5">
          <button onClick={() => setYear(year - 1)} aria-label="이전 연도" className="rounded px-2 py-0.5 text-slate-400 hover:bg-white">
            ◀
          </button>
          <span className="px-1 font-mono text-sm font-bold text-slate-700">{year}년</span>
          <button onClick={() => setYear(year + 1)} aria-label="다음 연도" className="rounded px-2 py-0.5 text-slate-400 hover:bg-white">
            ▶
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[980px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className={`${TH} ${TH_STICKY} w-20`}>소화기번호</th>
              <th className={`${TH} w-32`}>위치</th>
              <th className={`${TH} w-36`}>품명 및 용량</th>
              <th className={`${TH} w-20`}>제조년월</th>
              {MONTH_LABEL.map((m) => (
                <th key={m} className={`${TH} w-7 px-0 text-center`}>{m.replace('월', '')}</th>
              ))}
              <th className={`${TH} w-36`}>비고</th>
              <th className="w-8 px-1 py-2" aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roster.rows.length === 0 && (
              <tr>
                <td colSpan={18} className="px-3 py-4 text-center text-slate-300">
                  아래 ＋ 버튼으로 소화기를 추가해 주세요
                </td>
              </tr>
            )}
            {roster.rows.map((r) => (
              <tr key={r.id}>
                <td className={`${TD_STICKY} px-1 py-1.5`}>
                  <input aria-label="소화기번호" placeholder="예: 63688" value={r.extNo} onChange={(e) => roster.setRow(r.id, { extNo: e.target.value })} className={`${CELL} px-1.5 font-mono`} />
                </td>
                <td className="px-1 py-1.5">
                  <input aria-label="위치" placeholder="예: 2층 사무실 내부" value={r.location} onChange={(e) => roster.setRow(r.id, { location: e.target.value })} className={`${CELL} px-1.5`} />
                </td>
                <td className="px-1 py-1.5">
                  <input aria-label="품명 및 용량" placeholder="예: 분말소화기 3.3kg (ABC)" value={r.spec} onChange={(e) => roster.setRow(r.id, { spec: e.target.value })} className={`${CELL} px-1.5`} />
                </td>
                <td className="px-1 py-1.5">
                  <input aria-label="제조년월" placeholder="YYYY-MM" value={r.madeAt} onChange={(e) => roster.setRow(r.id, { madeAt: e.target.value })} className={`${CELL} px-1.5 font-mono`} />
                </td>
                {MONTH_LABEL.map((_, i) => {
                  const m = i + 1;
                  const checked = isChecked(r.id, m);
                  const id = hqCheckId(year, m, r.id);
                  return (
                    <td key={m} className="px-0 py-1.5 text-center">
                      <button
                        onClick={() => void toggle(r.id, m)}
                        disabled={busy === id}
                        aria-label={`${r.extNo || r.location} ${m} 점검`}
                        className={`mx-auto flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold ${
                          checked ? 'border-cyan-600 bg-cyan-500/20 text-cyan-700' : 'border-slate-300 text-transparent hover:border-slate-400'
                        }`}
                      >
                        O
                      </button>
                    </td>
                  );
                })}
                <td className="px-1 py-1.5">
                  <input aria-label="비고" value={r.note ?? ''} onChange={(e) => roster.setRow(r.id, { note: e.target.value })} className={`${CELL} px-1.5`} />
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

      <SheetToolbar addLabel="＋ 소화기 추가" onAdd={add} onUndo={() => void roster.undo()} canUndo={roster.canUndo} save={save} />

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        칸을 누르면 그 달 점검 완료로 표시됩니다. 점검 이력은 연도별로 저장되어 연도를 바꾸면 새로 시작됩니다 —
        위 ◀▶로 지난 연도 기록도 확인할 수 있습니다.
      </p>
    </div>
  );
}
