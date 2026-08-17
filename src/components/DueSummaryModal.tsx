'use client';

import { NOTICE_STYLE, type NoticeLevel } from '@/lib/education';

/** 안전교육·공무관리 등 서로 다른 현황을 같은 모양으로 맞춘 항목 */
export interface DueSummaryItem {
  id: string;
  name: string;
  /** 과정명(교육) 또는 종류(공무) */
  category: string;
  date: string;
  days: number;
  level: NoticeLevel;
}

/**
 * D-day 임박 항목 상세 — 메인 KPI 타일을 누르면 뜬다.
 * "어느 현황에서 어떤 항목인지"를 한 화면에서 바로 보여 준다.
 */
export default function DueSummaryModal({
  title,
  icon,
  items,
  onClose,
}: {
  title: string;
  icon: string;
  items: DueSummaryItem[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span aria-hidden className="text-base">{icon}</span>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-mono text-[10px] font-bold text-red-700">
            D-10 이내 {items.length}건
          </span>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">D-10 이내 도래 항목이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((r) => (
                <li key={r.id} className="flex items-center gap-2.5 py-2">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${NOTICE_STYLE[r.level].badge}`}
                  >
                    {r.days < 0 ? `D+${-r.days}` : `D-${r.days}`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-700">{r.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">{r.category}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">{r.date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
