'use client';

import { useEffect, useState } from 'react';

interface AccidentItem {
  date: string;
  region: string;
  workType: string;
  casualties: string;
  summary: string;
  url?: string;
}

interface Accidents {
  updatedAt: string;
  note: string;
  items: AccidentItem[];
}

/**
 * 전국 중대재해·온열질환 사망사고 현황 — /accidents.json (일일 확인·갱신)
 * compact: 메인 화면용 축약 표시 (참고 정보이므로 비중을 낮춘다)
 */
export default function AccidentsPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Accidents | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    fetch('/accidents.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Accidents) => setData(d))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-400">현황을 불러오지 못했습니다.</p>;
  }
  if (!data) {
    return <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-300">현황 불러오는 중…</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <ul
        className={`flex-1 divide-y divide-slate-100 overflow-y-auto pr-1 ${compact ? 'max-h-32' : 'max-h-44'}`}
      >
        {data.items.map((a, i) => (
          <li key={i} className={compact ? 'py-1' : 'py-1.5'}>
            <button className="w-full text-left" onClick={() => setOpen(open === i ? null : i)}>
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-[10px] text-slate-400">{a.date.slice(5)}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {a.region}
                </span>
                <span className="truncate text-xs text-slate-700">{a.workType}</span>
                <span className="ml-auto shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                  {a.casualties}
                </span>
              </div>
            </button>
            {open === i && (
              <div className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-600">
                {a.summary}
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer" className="ml-1 text-sky-600 hover:underline">
                    원문 ↗
                  </a>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
        최근 확인 {data.updatedAt} ·{' '}
        <a href="https://labor.moel.go.kr/sasttc/main/main.do" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
          고용부 중대재해 알림e ↗
        </a>
      </p>
    </div>
  );
}
