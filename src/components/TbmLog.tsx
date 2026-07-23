'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SafetyData } from '@/lib/types';

interface TbmEntry {
  id: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  site: string; // 현장(발주처·공장)
  place: string; // 작업 위치
  work: string; // 작업 내용
  attendees: string; // 참석 인원
  leader: string; // 진행자(작성자)
  content: string; // TBM 내용 (위험요인·안전대책 공유)
  createdAt: string;
}

const KEY = 'sj-tbm:v1';

function loadEntries(): TbmEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as TbmEntry[];
  } catch {
    return [];
  }
}

function saveEntries(list: TbmEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 저장 실패 무시
  }
}

function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const EMPTY = { datetime: '', site: '', place: '', work: '', attendees: '', leader: '', content: '' };

export default function TbmLog({ data }: { data: SafetyData | null }) {
  const [entries, setEntries] = useState<TbmEntry[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [filterSite, setFilterSite] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEntries(loadEntries());
    setForm((f) => ({ ...f, datetime: nowLocal() }));
  }, []);

  // 현장 자동완성: 불러온 데이터의 발주처 + 기존 일지의 현장명
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
        .sort((a, b) => b.datetime.localeCompare(a.datetime)),
    [entries, filterSite],
  );

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.datetime || !form.site.trim() || !form.content.trim()) return;
    const entry: TbmEntry = {
      id: `TBM-${Date.now()}`,
      ...form,
      site: form.site.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    saveEntries(next);
    setForm({ ...EMPTY, datetime: nowLocal(), site: form.site });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const remove = (id: string) => {
    if (!confirm('이 TBM 일지를 삭제할까요?')) return;
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    saveEntries(next);
  };

  const exportCsv = () => {
    const head = ['일시', '현장', '위치', '작업내용', '참석인원', '진행자', 'TBM내용'];
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const rows = [...entries]
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .map((e) =>
        [e.datetime.replace('T', ' '), e.site, e.place, e.work, e.attendees, e.leader, e.content].map(esc).join(','),
      );
    const csv = '﻿' + [head.join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `TBM일지_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';
  const label = 'mb-1 block text-xs font-semibold text-slate-500';

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* 작성 폼 */}
      <form onSubmit={submit} className="xl:col-span-2 h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-700">TBM 일지 작성</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="tbm-dt">일시 *</label>
            <input id="tbm-dt" type="datetime-local" required value={form.datetime} onChange={set('datetime')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="tbm-site">현장(발주처) *</label>
            <input id="tbm-site" required list="tbm-sites" placeholder="예: 여천NCC" value={form.site} onChange={set('site')} className={input} />
            <datalist id="tbm-sites">
              {siteOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label} htmlFor="tbm-place">위치</label>
            <input id="tbm-place" placeholder="예: NCC 2공장 R-301 앞" value={form.place} onChange={set('place')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="tbm-att">참석인원</label>
            <input id="tbm-att" placeholder="예: 8명" value={form.attendees} onChange={set('attendees')} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="tbm-work">작업내용</label>
            <input id="tbm-work" placeholder="예: 촉매 교체 작업" value={form.work} onChange={set('work')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="tbm-leader">진행자</label>
            <input id="tbm-leader" placeholder="예: 김민규" value={form.leader} onChange={set('leader')} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="tbm-content">TBM 내용 (위험요인·안전대책 공유) *</label>
            <textarea
              id="tbm-content"
              required
              rows={5}
              placeholder={'예:\n- 밀폐공간 산소농도 측정 확인 (18% 이상)\n- 2인 1조 작업, 감시자 배치\n- 개인보호구 착용 상태 점검'}
              value={form.content}
              onChange={set('content')}
              className={input}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-[#1f3864] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a80]">
            일지 저장
          </button>
          {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          일지는 이 브라우저에만 저장됩니다. 기록 보존이 필요하면 주기적으로 [CSV 내보내기]로 백업하세요.
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
          <span className="text-sm text-slate-500">{shown.length}건</span>
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
            작성된 TBM 일지가 없습니다. 왼쪽 양식으로 첫 일지를 작성해 보세요.
          </div>
        ) : (
          shown.map((e) => (
            <article key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded bg-[#1f3864] px-2 py-0.5 text-xs font-bold text-white">{e.site}</span>
                <span className="font-mono text-xs text-slate-500">{e.datetime.replace('T', ' ')}</span>
                {e.place && <span className="text-xs text-slate-500">📍 {e.place}</span>}
                {e.attendees && <span className="text-xs text-slate-500">👷 {e.attendees}</span>}
                {e.leader && <span className="text-xs text-slate-500">진행 {e.leader}</span>}
                <button onClick={() => remove(e.id)} className="ml-auto text-xs text-slate-300 hover:text-red-500">
                  삭제
                </button>
              </div>
              {e.work && <p className="mt-2 text-sm font-semibold text-slate-800">{e.work}</p>}
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{e.content}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
