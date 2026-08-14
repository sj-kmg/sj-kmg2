'use client';

import { useEffect, useState } from 'react';

interface NoticeItem {
  date: string;
  category: string;
  law: string;
  title: string;
  summary: string;
  relevance: string;
  url?: string;
}

interface Notices {
  updatedAt: string;
  criteria: string;
  items: NoticeItem[];
}

/**
 * 법령 개정·안전보건 뉴스 알림 — /notices.json (일일 확인·갱신)
 * compact: 메인 화면용 축약 표시 (참고 정보이므로 비중을 낮춘다)
 */
export default function NoticesPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Notices | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<number | null>(compact ? null : 0);

  useEffect(() => {
    fetch('/notices.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Notices) => setData(d))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-400">알림을 불러오지 못했습니다.</p>;
  }
  if (!data) {
    return <p className="flex h-full min-h-24 items-center justify-center text-sm text-slate-300">알림 불러오는 중…</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <ul
        className={`flex-1 divide-y divide-slate-100 overflow-y-auto pr-1 ${compact ? 'max-h-32' : 'max-h-56'}`}
      >
        {data.items.map((n, i) => (
          <li key={i} className={compact ? 'py-1' : 'py-2'}>
            <button className="w-full text-left" onClick={() => setOpen(open === i ? null : i)}>
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    n.category === '법령개정' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {n.category}
                </span>
                {n.law && !compact && <span className="shrink-0 text-[11px] text-slate-400">{n.law}</span>}
                <span className={`truncate font-medium text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {n.title}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">
                  {compact ? n.date.slice(5) : n.date}
                </span>
              </div>
            </button>
            {open === i && (
              <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                <p>{n.summary}</p>
                {n.relevance && <p className="mt-1.5 font-semibold text-[#1f3864]">▸ {n.relevance}</p>}
                {n.url && (
                  <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sky-600 hover:underline">
                    원문 보기 ↗
                  </a>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
        {compact ? `최근 확인 ${data.updatedAt}` : `${data.criteria} · 최근 확인 ${data.updatedAt}`}
      </p>
    </div>
  );
}
