'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { useSyncedLog, modeBadge } from '@/lib/useSyncedLog';
import {
  LABOR_CATEGORIES,
  MAX_WORK_DAYS,
  WORKFORCE_KEY,
  dateLabelOf,
  datesOf,
  endDateOf,
  hasOverrides,
  isMeaningfulOverride,
  laborCountOf,
  laborSummary,
  offDayCount,
  todayLocal,
  workDaysOf,
  workingDatesOf,
  type DayOverride,
  type LaborRow,
  type WorkforceEntry,
} from '@/lib/workforce';
import { TD_STICKY, TH_STICKY } from './SheetUI';

const EMPTY_ROW: LaborRow = { category: '', name: '', workType: '', hours: '' };

const ROW_INPUT =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** "04-08 (수)" 의 요일 부분 */
function dowOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : DOW[d.getDay()];
}

/** 그날 무엇을 바꿨는지 짧게 — "인력·시간" 같은 배지 문구 */
function overrideSummary(o: DayOverride | undefined): string {
  if (!o) return '';
  const parts = [
    o.laborRows && '인력',
    (o.staff ?? '').trim() && '직원',
    (o.workHours ?? '').trim() && '시간',
    (o.work ?? '').trim() && '내용',
    (o.equipment ?? '').trim() && '장비',
  ].filter(Boolean);
  return parts.length ? `${parts.join('·')} 변경` : '변경';
}
const GRID = 'grid grid-cols-[2rem_5.5rem_1fr_1fr_5.5rem_1.5rem] items-center gap-1.5';

/** 인력 목록 편집 — 기본 인력과 "그날만 다른 인력" 양쪽에서 같이 쓴다 */
function LaborRowsEditor({
  rows,
  onChange,
  idPrefix,
}: {
  rows: LaborRow[];
  onChange: (next: LaborRow[]) => void;
  idPrefix: string;
}) {
  const setRow = (i: number, k: keyof LaborRow, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <div className="space-y-1.5">
      <div className={`${GRID} px-0.5 text-[10px] font-semibold text-slate-400`}>
        <span className="text-center">번호</span>
        <span>구분</span>
        <span>인력이름</span>
        <span>작업구분</span>
        <span>작업시간</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={`${idPrefix}-${i}`} className={GRID}>
          <span className="text-center text-sm font-semibold text-slate-500">{i + 1}</span>
          <select
            value={r.category}
            onChange={(e) => setRow(i, 'category', e.target.value)}
            className={ROW_INPUT}
            aria-label={`인력 ${i + 1} 구분`}
          >
            <option value="">선택</option>
            {LABOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="이름" className={ROW_INPUT} aria-label={`인력 ${i + 1} 이름`} />
          <input value={r.workType} onChange={(e) => setRow(i, 'workType', e.target.value)} placeholder="예: 밀폐감시" className={ROW_INPUT} aria-label={`인력 ${i + 1} 작업구분`} />
          <input value={r.hours} onChange={(e) => setRow(i, 'hours', e.target.value)} placeholder="8h" className={ROW_INPUT} aria-label={`인력 ${i + 1} 작업시간`} />
          <button
            type="button"
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ ...EMPTY_ROW }])}
            className="text-center text-slate-300 hover:text-red-500"
            aria-label={`인력 ${i + 1} 행 삭제`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const EMPTY = {
  site: '',
  date: '',
  endDate: '',
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
  /** 기간 중 따로 지정한 날 (YYYY-MM-DD → 그날 내용) */
  const [overrides, setOverrides] = useState<Record<string, DayOverride>>({});
  /** 지금 펼쳐 놓은 날짜 */
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [filterSite, setFilterSite] = useState('');
  const [saved, setSaved] = useState(false);
  /** 수정 중인 기록의 id — null이면 새 기록 작성 */
  const [editingId, setEditingId] = useState<string | null>(null);

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

  /** 기간에 들어가는 날짜들 — 날짜별 조정 목록을 그린다 */
  const rangeDates = useMemo(() => {
    if (!form.date) return [];
    const end = form.endDate.trim();
    if (end && end < form.date) return [];
    const list = datesOf(form);
    return list.length > MAX_WORK_DAYS ? [] : list;
  }, [form]);

  /** 그날만 다르게 지정한 내용 — 값이 빈 문자열이면 "지정 안 함"으로 되돌린다 */
  const setOverride = (date: string, patch: Partial<DayOverride>) =>
    setOverrides((cur) => {
      const next: DayOverride = { ...cur[date] };
      for (const [k, v] of Object.entries(patch) as [keyof DayOverride, unknown][]) {
        if (v === undefined || v === '') delete next[k];
        else Object.assign(next, { [k]: v });
      }
      const out = { ...cur };
      if (isMeaningfulOverride(next)) out[date] = next;
      else delete out[date];
      return out;
    });

  const toggleOff = (date: string) =>
    setOverrides((cur) => {
      const out = { ...cur };
      if (cur[date]?.off) {
        const rest = { ...cur[date] };
        delete rest.off;
        if (isMeaningfulOverride(rest)) out[date] = rest;
        else delete out[date];
      } else {
        out[date] = { ...cur[date], off: true };
      }
      return out;
    });

  const clearOverride = (date: string) =>
    setOverrides((cur) => {
      const out = { ...cur };
      delete out[date];
      return out;
    });

  /** 지정한 기간 안내 — 잘못 넣은 경우도 여기서 바로 알려 준다 */
  const rangeHint = useMemo(() => {
    const end = form.endDate.trim();
    if (!end || !form.date) return '여러 날 이어지는 작업이면 종료일까지 지정하세요 (비워 두면 하루).';
    if (end < form.date) return '⚠ 종료일이 시작일보다 앞섭니다.';
    const days = workDaysOf(form);
    if (days === 1) return '시작일과 종료일이 같아 하루 작업으로 기록됩니다.';
    if (days > MAX_WORK_DAYS) return `⚠ 기간이 너무 깁니다 (${days}일). ${MAX_WORK_DAYS}일 이내로 지정해 주세요.`;
    return `${days}일간 작업 — 기본은 모든 날 같은 인원이고, 다른 날은 아래에서 따로 지정합니다.`;
  }, [form]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site.trim() || !form.date) return;
    const end = form.endDate.trim();
    if (end && end < form.date) {
      alert('작업 종료일이 시작일보다 앞섭니다.\n기간을 다시 지정해 주세요.');
      return;
    }
    if (workDaysOf(form) > MAX_WORK_DAYS) {
      alert(`작업기간이 너무 깁니다 (${workDaysOf(form)}일).\n${MAX_WORK_DAYS}일 이내로 지정해 주세요.`);
      return;
    }
    const rows = laborRows.filter((r) => r.category || r.name.trim() || r.workType.trim() || r.hours.trim());
    const editing = entries.find((x) => x.id === editingId);
    // 기간 안에 있고 실제로 내용이 있는 조정만 남긴다 (기간을 줄이면 밖으로 나간 날은 버린다)
    const inRange = new Set(datesOf({ date: form.date, endDate: end }));
    const keptOverrides: Record<string, DayOverride> = {};
    for (const [d, o] of Object.entries(overrides)) {
      if (!inRange.has(d) || !isMeaningfulOverride(o)) continue;
      keptOverrides[d] = o.laborRows
        ? { ...o, laborRows: o.laborRows.filter((r) => r.category || r.name.trim() || r.workType.trim() || r.hours.trim()) }
        : o;
    }
    const entry: WorkforceEntry = {
      id: editing?.id ?? `WF-${Date.now()}`,
      ...form,
      // 하루짜리는 종료일을 남기지 않는다 (예전 기록과 같은 모양으로 둔다)
      endDate: end && end > form.date ? end : '',
      overrides: keptOverrides,
      site: form.site.trim(),
      laborRows: rows,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      ...(editing ? { updatedAt: new Date().toISOString() } : {}),
    };
    if (!(await add(entry))) return;
    setForm({ ...EMPTY, date: form.date, endDate: form.endDate, site: form.site });
    setLaborRows([{ ...EMPTY_ROW }]);
    setOverrides({});
    setOpenDay(null);
    setEditingId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const startEdit = (e: WorkforceEntry) => {
    setEditingId(e.id);
    setForm({
      site: e.site,
      date: e.date,
      endDate: e.endDate ?? '',
      manager: e.manager,
      staff: e.staff,
      workHours: e.workHours,
      work: e.work,
      equipment: e.equipment,
    });
    setLaborRows(e.laborRows && e.laborRows.length > 0 ? e.laborRows.map((r) => ({ ...r })) : [{ ...EMPTY_ROW }]);
    setOverrides(structuredClone(e.overrides ?? {}));
    setOpenDay(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY, date: todayLocal() });
    setOverrides({});
    setOpenDay(null);
    setLaborRows([{ ...EMPTY_ROW }]);
  };

  const removeEntry = (id: string) => {
    if (!confirm('이 작업인원 기록을 삭제할까요?')) return;
    if (editingId === id) cancelEdit();
    void remove(id);
  };

  const exportCsv = () => {
    const head = ['작업시작일', '작업종료일', '작업일수', '현장명', '현장소장', '직원', '작업시간', '작업내용', '장비현황', '인력인원', '인력내역'];
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const rows = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) =>
        [e.date, endDateOf(e), String(workDaysOf(e)), e.site, e.manager, e.staff, e.workHours, e.work, e.equipment, String(laborCountOf(e)), laborSummary(e)]
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
      <form
        onSubmit={submit}
        className={`xl:col-span-2 h-fit rounded-xl border bg-white p-4 shadow-sm ${
          editingId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            {editingId ? '작업인원 기록 수정' : '작업인원 기록'}
          </h3>
          {editingId ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">수정 중</span>
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label} htmlFor="wf-site">현장명 *</label>
            <input id="wf-site" required list="wf-sites" placeholder="예: 여천NCC" value={form.site} onChange={set('site')} className={input} />
            <datalist id="wf-sites">
              {siteOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          {/* 작업기간 — 날짜칸 두 개가 나란히 들어가야 해서 한 줄을 다 쓴다 */}
          <div className="col-span-2">
            <label className={label} htmlFor="wf-date">작업기간 *</label>
            <div className="flex items-center gap-1.5">
              <input
                id="wf-date"
                type="date"
                required
                value={form.date}
                onChange={set('date')}
                aria-label="작업 시작일"
                className={input}
              />
              <span className="shrink-0 text-xs text-slate-400">~</span>
              <input
                id="wf-end-date"
                type="date"
                value={form.endDate}
                min={form.date || undefined}
                onChange={set('endDate')}
                aria-label="작업 종료일 (하루면 비워 둡니다)"
                className={input}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {rangeHint}
            </p>
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
            <LaborRowsEditor rows={laborRows} onChange={setLaborRows} idPrefix="base" />
          </div>

          {/* 기간 중 특정 날짜만 다르게 — 하루짜리 작업에는 나오지 않는다 */}
          {rangeDates.length > 1 && (
            <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-slate-600">날짜별 조정</span>
                <span className="text-[10px] text-slate-400">
                  기본값과 다른 날만 지정하세요 · 지정 안 한 날은 위 내용 그대로
                </span>
              </div>
              <div className="space-y-1">
                {rangeDates.map((d) => {
                  const o = overrides[d];
                  const off = o?.off === true;
                  const changed = !off && isMeaningfulOverride(o);
                  const isOpen = openDay === d;
                  return (
                    <div key={d} className="rounded-lg border border-slate-200 bg-white">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5">
                        <span className={`font-mono text-xs font-bold ${off ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                          {d.slice(5)} ({dowOf(d)})
                        </span>
                        {off ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">휴무</span>
                        ) : changed ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            {overrideSummary(o)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">기본</span>
                        )}
                        <span className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleOff(d)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              off ? 'bg-slate-600 text-white' : 'border border-slate-300 text-slate-500 hover:border-slate-500'
                            }`}
                          >
                            휴무
                          </button>
                          <button
                            type="button"
                            disabled={off}
                            onClick={() => setOpenDay(isOpen ? null : d)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 hover:underline disabled:opacity-30"
                          >
                            {isOpen ? '접기' : '이 날만 수정'}
                          </button>
                        </span>
                      </div>

                      {isOpen && !off && (
                        <div className="space-y-2 border-t border-slate-100 px-2.5 py-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold text-slate-500" htmlFor={`ov-hours-${d}`}>작업시간</label>
                              <input
                                id={`ov-hours-${d}`}
                                value={o?.workHours ?? ''}
                                placeholder={form.workHours || '기본값 그대로'}
                                onChange={(ev) => setOverride(d, { workHours: ev.target.value })}
                                className={ROW_INPUT}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold text-slate-500" htmlFor={`ov-staff-${d}`}>직원</label>
                              <input
                                id={`ov-staff-${d}`}
                                value={o?.staff ?? ''}
                                placeholder={form.staff || '기본값 그대로'}
                                onChange={(ev) => setOverride(d, { staff: ev.target.value })}
                                className={ROW_INPUT}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold text-slate-500" htmlFor={`ov-work-${d}`}>작업내용</label>
                            <input
                              id={`ov-work-${d}`}
                              value={o?.work ?? ''}
                              placeholder={form.work ? form.work.split('\n')[0] : '기본값 그대로'}
                              onChange={(ev) => setOverride(d, { work: ev.target.value })}
                              className={ROW_INPUT}
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-slate-500">
                                인력 {o?.laborRows ? `(${o.laborRows.length}명 — 이 날만)` : '(기본값 그대로)'}
                              </span>
                              <span className="flex items-center gap-1.5">
                                {o?.laborRows ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setOverride(d, { laborRows: [...(o.laborRows ?? []), { ...EMPTY_ROW }] })}
                                      className="rounded border border-[#1f3864] px-1.5 py-0.5 text-[10px] font-bold text-[#1f3864]"
                                    >
                                      ＋ 인력
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setOverride(d, { laborRows: undefined })}
                                      className="text-[10px] text-slate-400 hover:text-slate-700 hover:underline"
                                    >
                                      기본값으로
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setOverride(d, { laborRows: laborRows.map((r) => ({ ...r })) })}
                                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
                                  >
                                    이 날만 인력 바꾸기
                                  </button>
                                )}
                              </span>
                            </div>
                            {o?.laborRows && (
                              <LaborRowsEditor
                                rows={o.laborRows}
                                onChange={(next) => setOverride(d, { laborRows: next })}
                                idPrefix={`ov-${d}`}
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => clearOverride(d)}
                            className="text-[10px] font-semibold text-slate-400 hover:text-red-500 hover:underline"
                          >
                            이 날 조정 전부 지우기
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
            {editingId ? '수정 저장' : '기록 저장'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              취소
            </button>
          )}
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
            <article
              key={e.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                editingId === e.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded bg-[#1f3864] px-2 py-0.5 text-xs font-bold text-white">{e.site}</span>
                <span className="font-mono text-xs text-slate-500">{dateLabelOf(e)}</span>
                {hasOverrides(e) && (
                  <span
                    className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                    title={`실작업 ${workingDatesOf(e).length}일${offDayCount(e) > 0 ? ` · 휴무 ${offDayCount(e)}일` : ''}`}
                  >
                    날짜별 조정 {Object.keys(e.overrides ?? {}).length}일
                  </span>
                )}
                {e.workHours && <span className="text-xs text-slate-500">🕐 {e.workHours}</span>}
                {e.manager && <span className="text-xs text-slate-500">소장 {e.manager}</span>}
                {laborCountOf(e) > 0 && (
                  <span className="text-xs font-semibold text-[#1f3864]">👷 인력 {laborCountOf(e)}명</span>
                )}
                {e.updatedAt && <span className="text-[10px] text-slate-400">수정됨</span>}
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  <button onClick={() => startEdit(e)} className="text-xs font-semibold text-sky-600 hover:underline">
                    수정
                  </button>
                  <button onClick={() => removeEntry(e.id)} className="text-xs text-slate-300 hover:text-red-500">
                    삭제
                  </button>
                </span>
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
