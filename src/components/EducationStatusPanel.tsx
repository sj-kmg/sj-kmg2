'use client';

import { useEffect, useState } from 'react';
import { NOTICE_STYLE } from '@/lib/education';
import { collectEducationStatus, type LiveDueItem, type LiveUpcoming } from '@/lib/eduLive';

/**
 * 메인 [안전교육 현황] 패널 — 정적 명부 + YNCC·유해화학물질 입력 시트를 합쳐 표시.
 * 관리감독자 D-90 · 유해화학물질 D-30 · YNCC출입 D-30 도래자와 기한 초과자만 D-day와 함께 보여준다.
 */
export default function EducationStatusPanel() {
  // 날짜 계산·데이터 조회는 클라이언트에서만 수행해 SSR 하이드레이션 불일치를 피한다
  const [due, setDue] = useState<LiveDueItem[] | null>(null);
  const [next, setNext] = useState<(LiveUpcoming & { others: number }) | null>(null);

  useEffect(() => {
    void collectEducationStatus(new Date()).then(({ due, upcoming }) => {
      setDue(due);
      if (upcoming.length > 0) {
        const first = upcoming[0];
        const others = upcoming.filter((u) => u.course === first.course && u.renewAt === first.renewAt).length - 1;
        setNext({ ...first, others });
      }
    });
  }, []);

  if (!due) return null;

  if (due.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center">
          <p className="text-2xl" aria-hidden>✅</p>
          <p className="mt-1.5 text-sm font-medium text-slate-500">갱신기간 도래 대상자가 없습니다</p>
          {next && (
            <p className="mt-1 text-xs text-slate-400">
              다음 갱신: <b>{next.name}</b>
              {next.others > 0 && ` 외 ${next.others}명`} · {next.course} {next.renewAt} (D-{next.days})
            </p>
          )}
        </div>
        <Footnote />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="max-h-44 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
        {due.map((r) => (
          <li key={r.id} className="py-1.5">
            <DueRow item={r} />
          </li>
        ))}
      </ul>
      <Footnote />
    </div>
  );
}

function DueRow({ item: r }: { item: LiveDueItem }) {
  const style = NOTICE_STYLE[r.level];
  const inner = (
    <>
      <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${style.badge}`}>
        {r.days < 0 ? `D+${-r.days}` : `D-${r.days}`}
      </span>
      <span className="shrink-0 text-xs font-semibold text-slate-700 underline-offset-2 group-hover:underline">
        {r.name}
      </span>
      <span className="min-w-0 truncate text-[11px] text-slate-500">{r.course}</span>
      <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">{r.renewAt}</span>
    </>
  );
  if (!r.certFile) {
    return <div className="flex items-center gap-2">{inner}</div>;
  }
  return (
    <a
      href={encodeURI(r.certFile)}
      target="_blank"
      rel="noreferrer"
      title={`${r.name} 수료증 열기`}
      className="group flex items-center gap-2"
    >
      {inner}
    </a>
  );
}

function Footnote() {
  return (
    <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
      관리감독자 D-90 · 유해화학물질 D-30 · YNCC출입 D-30부터 표시
    </p>
  );
}
