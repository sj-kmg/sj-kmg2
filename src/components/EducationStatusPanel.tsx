'use client';

import { useEffect, useState } from 'react';
import { NOTICE_STYLE, allRenewals, upcomingRenewals, type RenewalItem } from '@/lib/education';

/**
 * 메인 [안전교육 현황] 패널 — 사이드바 안전교육 데이터와 연동.
 * 과정별 갱신기간 도래자(관리감독자 D-90 · 유해화학물질 D-30)와 기한 초과자만
 * D-day 카운트와 함께 표시하고, 이름을 클릭하면 수료증 PDF가 열린다.
 */
export default function EducationStatusPanel() {
  // 날짜 계산은 클라이언트에서만 수행해 SSR 하이드레이션 불일치를 피한다
  const [due, setDue] = useState<RenewalItem[] | null>(null);
  const [next, setNext] = useState<{ item: RenewalItem; others: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    setDue(upcomingRenewals(now));
    const upcoming = allRenewals(now).filter((r) => r.days >= 0);
    if (upcoming.length > 0) {
      const first = upcoming[0];
      const others = upcoming.filter(
        (r) => r.course.key === first.course.key && r.renewAt === first.renewAt,
      ).length - 1;
      setNext({ item: first, others });
    }
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
              다음 갱신: <b>{next.item.record.name}</b>
              {next.others > 0 && ` 외 ${next.others}명`} · {next.item.course.label} {next.item.renewAt} (D-{next.item.days})
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
          <li key={`${r.course.key}-${r.record.name}`} className="py-1.5">
            <RenewalRow item={r} />
          </li>
        ))}
      </ul>
      <Footnote />
    </div>
  );
}

function RenewalRow({ item: r }: { item: RenewalItem }) {
  const style = NOTICE_STYLE[r.level!];
  const inner = (
    <>
      <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${style.badge}`}>
        {r.days < 0 ? `D+${-r.days}` : `D-${r.days}`}
      </span>
      <span className="shrink-0 text-xs font-semibold text-slate-700 underline-offset-2 group-hover:underline">
        {r.record.name}
      </span>
      <span className="min-w-0 truncate text-[11px] text-slate-500">{r.course.label}</span>
      <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">{r.renewAt}</span>
    </>
  );
  if (!r.record.certFile) {
    return <div className="flex items-center gap-2" title="수료증 추가 예정">{inner}</div>;
  }
  return (
    <a
      href={encodeURI(r.record.certFile)}
      target="_blank"
      rel="noreferrer"
      title={`${r.record.name} 수료증 열기`}
      className="group flex items-center gap-2"
    >
      {inner}
    </a>
  );
}

function Footnote() {
  return (
    <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
      관리감독자 D-90 · 유해화학물질 D-30부터 표시 · 이름 클릭 시 수료증 열람
    </p>
  );
}
