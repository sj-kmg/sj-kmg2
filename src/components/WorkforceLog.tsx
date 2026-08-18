'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { useSyncedLog, modeBadge } from '@/lib/useSyncedLog';
import {
  LABOR_CATEGORIES,
  WORKFORCE_KEY,
  laborCountOf,
  laborSummary,
  todayLocal,
  type LaborRow,
  type WorkforceEntry,
} from '@/lib/workforce';
import { TD_STICKY, TH_STICKY } from './SheetUI';

const EMPTY_ROW: LaborRow = { category: '', name: '', workType: '', hours: '' };

const EMPTY = {
  site: '',
  date: '',
  manager: '',
  staff: '',
  workHours: '',
  work: '',
  equipment: '',
};

export default function WorkforceLog({ data }: { data: SafetyData | null }) {
  const { entries, mode, add, remove } = useSyncedLog<WorkforceEntry>('workforce', WORKFORCE_KEY);
  const [form, setForm] = useState({ ...EMPTY });
  const [laborRows, setLaborRows] = useState<LaborRow[]>([{ ...EMPTY_ROW }]);
  const [filterSite, setFilterSite] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm((f) => ({ ...f, date: todayLocal() }));
  }, []);

  const siteOptions = useMemo(() => {
    const s = new Set<string>();
    data?.risks.forEach((r) => r.company && s.add(r.company));
    entries.forEach((e) => e.site && s.add(e.site));
    return [...s];
  }, [data, entries]);

  const sites = useMemo(() => [...new Set(entries.map((e) => e.site).filter(Boolean))], [entries]);
  const shown = useMemo(
    () =>
      [...entries]
        .filter((e) => !filterSite || e.site === filterSite)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [entries, filterSite],
  );

  const totalWorkers = useMemo(() => shown.reduce((sum, e) => sum + laborCountOf(e), 0), [shown]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setRow = (i: number, k: keyof LaborRow, v: string) =>
    setLaborRows((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site.trim() || !form.date) return;
    const rows = laborRows.filter((r) => r.category || r.name.trim() || r.workType.trim() || r.hours.trim());
    const entry: WorkforceEntry = {
      id: `WF-${Date.now()}`,
      ...form,
      site: form.site.trim(),
      laborRows: rows,
      createdAt: new Date().toISOString(),
    };
    if (!(await add(entry))) return;
    setForm({ ...EMPTY, date: form.date, site: form.site });
    setLaborRows([{ ...EMPTY_ROW }]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const removeEntry = (id: string) => {
    if (!confirm('이 작업인원 기록을 삭제할까요?')) return;
    void remove(id);
  };

  const exportCsv = () => {
    const head = ['작업일시', '현장명', '현장소장', '직원', '작업시간', '작업내용', '장비현황', '인력인원', '인력내역'];
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const rows = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) =>
        [e.date, e.site, e.manager, e.staff, e.workHours, e.work, e.equipment, String(laborCountOf(e)), laborSummary(e)]
          .map(esc)
          .join(','),
      );
    const csv = '﻿' + [head.join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `작업인원관리_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const badge = modeBadge(mode);
  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';
  const rowInput =
    'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';
  const label = 'mb-1 block text-xs font-semibold text-slate-500';

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* 작성 폼 */}
      <form onSubmit={submit} className="xl:col-span-2 h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-700">작업인원 기록</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="wf-site">현장명 *</label>
            <input id="wf-site" required list="wf-sites" placeholder="예: 여천NCC" value={form.site} onChange={set('site')} className={input} />
            <datalist id="wf-sites">
              {siteOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label} htmlFor="wf-date">작업일시 *</label>
            <input id="wf-date" type="date" required value={form.date} onChange={set('date')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="wf-manager">현장소장</label>
            <input id="wf-manager" placeholder="예: 조준호" value={form.manager} onChange={set('manager')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="wf-hours">작업시간</label>
            <input id="wf-hours" placeholder="예: 08:00~17:00" value={form.workHours} onChange={set('workHours')} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="wf-staff">직원</label>
            <input id="wf-staff" placeholder="예: 김민규, 박OO (2명)" value={form.staff} onChange={set('staff')} className={input} />
          </div>

          {/* 인력 — 행 추가 방식 */}
          <div className="col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">인력 ({laborRows.length}명)</span>
              <button
                type="button"
                onClick={() => setLaborRows((rows) => [...rows, { ...EMPTY_ROW }])}
                className="rounded-lg border border-[#1f3864] px-2.5 py-1 text-xs font-bold text-[#1f3864] hover:bg-[#1f3864] hover:text-white"
              >
                ＋ 인력 추가
              </button>
            </div>
            <div className="space-y-1.5">
              {/* 열 제목 */}
              <div className="grid grid-cols-[2rem_5.5rem_1fr_1fr_5.5rem_1.5rem] items-center gap-1.5 px-0.5 text-[10px] font-semibold text-slate-400">
                <span className="text-center">번호</span>
                <span>구분</span>
                <span>인력이름</span>
                <span>작업구분</span>
                <span>작업시간</span>
                <span />
              </div>
              {laborRows.map((r, i) => (
                <div key={i} className="grid grid-cols-[2rem_5.5rem_1fr_1fr_5.5rem_1.5rem] items-center gap-1.5">
                  <span className="text-center text-sm font-semibold text-slate-500">{i + 1}</span>
                  <select
                    value={r.category}
                    onChange={(e) => setRow(i, 'category', e.target.value)}
                    className={rowInput}
                    aria-label={`인력 ${i + 1} 구분`}
                  >
                    <option value="">선택</option>
                    {LABOR_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    value={r.name}
                    onChange={(e) => setRow(i, 'name', e.target.value)}
                    placeholder="이름"
                    className={rowInput}
                    aria-label={`인력 ${i + 1} 이름`}
                  />
                  <input
                    value={r.workType}
                    onChange={(e) => setRow(i, 'workType', e.target.value)}
                    placeholder="예: 밀폐감시"
                    className={rowInput}
                    aria-label={`인력 ${i + 1} 작업구분`}
                  />
                  <input
                    value={r.hours}
                    onChange={(e) => setRow(i, 'hours', e.target.value)}
                    placeholder="8h"
                    className={rowInput}
                    aria-label={`인력 ${i + 1} 작업시간`}
                  />
                  <button
                    type="button"
                    onClick={() => setLaborRows((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ ...EMPTY_ROW }]))}
                    className="text-center text-slate-300 hover:text-red-500"
                    aria-label={`인력 ${i + 1} 행 삭제`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <label className={label} htmlFor="wf-work">작업내용</label>
            <textarea id="wf-work" rows={3} placeholder="예: R-301A 촉매 교체 — M/H Open, 질소 치환 확인 후 입조" value={form.work} onChange={set('work')} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="wf-equip">장비현황</label>
            <input id="wf-equip" placeholder="예: Vacuum Car 2대, 크레인 1대, 지게차 1대" value={form.equipment} onChange={set('equipment')} className={input} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-[#1f3864] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a80]">
            기록 저장
          </button>
          {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          {mode === 'server'
            ? '기록은 서버에 저장되어 휴대폰·PC 어디서든 함께 보입니다.'
            : '기록이 이 브라우저에만 저장됩니다. 보존이 필요하면 주기적으로 [CSV 내보내기]로 백업하세요.'}
        </p>
      </form>

      {/* 목록 */}
      <div className="xl:col-span-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            aria-label="현장 필터"
          >
            <option value="">전체 현장</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500">
            {shown.length}건{totalWorkers > 0 && ` · 인력 연인원 ${totalWorkers}명`}
          </span>
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            CSV 내보내기
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
            {mode === 'loading' ? '기록을 불러오는 중…' : '작성된 작업인원 기록이 없습니다. 왼쪽 양식으로 오늘 현장 인원을 기록해 보세요.'}
          </div>
        ) : (
          shown.map((e) => (
            <article key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded bg-[#1f3864] px-2 py-0.5 text-xs font-bold text-white">{e.site}</span>
                <span className="font-mono text-xs text-slate-500">{e.date}</span>
                {e.workHours && <span className="text-xs text-slate-500">🕐 {e.workHours}</span>}
                {e.manager && <span className="text-xs text-slate-500">소장 {e.manager}</span>}
                {laborCountOf(e) > 0 && (
                  <span className="text-xs font-semibold text-[#1f3864]">👷 인력 {laborCountOf(e)}명</span>
                )}
                <button onClick={() => removeEntry(e.id)} className="ml-auto text-xs text-slate-300 hover:text-red-500">
                  삭제
                </button>
              </div>
              {e.work && <p className="mt-2 whitespace-pre-line text-sm font-medium text-slate-800">{e.work}</p>}

              {e.laborRows && e.laborRows.length > 0 && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-slate-500">
                        <th className="px-2 py-1.5 text-center font-semibold">번호</th>
                        <th className="px-2 py-1.5 font-semibold">구분</th>
                        <th className={`px-2 py-1.5 font-semibold ${TH_STICKY}`}>이름</th>
                        <th className="px-2 py-1.5 font-semibold">작업구분</th>
                        <th className="px-2 py-1.5 font-semibold">작업시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.laborRows.map((r, i) => (
                        <tr key={i} className="border-t border-slate-100 text-slate-700">
                          <td className="px-2 py-1.5 text-center text-slate-400">{i + 1}</td>
                          <td className="px-2 py-1.5">{r.category || '-'}</td>
                          <td className={`px-2 py-1.5 font-medium ${TD_STICKY}`}>{r.name || '-'}</td>
                          <td className="px-2 py-1.5">{r.workType || '-'}</td>
                          <td className="px-2 py-1.5">{r.hours || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <dl className="mt-2 space-y-0.5 text-xs text-slate-600">
                {e.staff && (
                  <div>
                    <dt className="inline text-slate-400">직원: </dt>
                    <dd className="inline">{e.staff}</dd>
                  </div>
                )}
                {!e.laborRows?.length && (e.laborNames || e.laborCount) && (
                  <div>
                    <dt className="inline text-slate-400">인력: </dt>
                    <dd className="inline">{laborSummary(e)}</dd>
                  </div>
                )}
                {e.equipment && (
                  <div>
                    <dt className="inline text-slate-400">장비: </dt>
                    <dd className="inline">{e.equipment}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
