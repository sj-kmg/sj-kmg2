'use client';

import { useEffect, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { collectEducationStatus } from '@/lib/eduLive';
import { listEntriesSilently } from '@/lib/sync';
import CalendarPanel from './CalendarPanel';
import WeatherPanel from './WeatherPanel';
import NoticesPanel from './NoticesPanel';
import AccidentsPanel from './AccidentsPanel';
import WorkPlanPanel from './WorkPlanPanel';
import EducationStatusPanel from './EducationStatusPanel';

/**
 * 메인 화면 — HUD 스탯 보드 + 플랫폼형 카드 그리드.
 */
export default function MainHome({
  data,
  onOpenEducation,
}: {
  data: SafetyData | null;
  onOpenEducation?: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* 0행: HUD 스탯 보드 */}
      <div className="col-span-12">
        <StatStrip data={data} />
      </div>

      {/* 1행: 공지 · 알림 */}
      <Panel title="공지사항" icon="📢" code="SYS-01" className="col-span-12 lg:col-span-6">
        <EmptyBox label="공지사항이 표시될 영역입니다" />
      </Panel>
      <Panel title="알림메세지" icon="🔔" code="SYS-02" className="col-span-12 lg:col-span-6">
        <NoticesPanel />
      </Panel>

      {/* 2행: 날씨 · 중대재해 · 작업계획 */}
      <Panel title="오늘의 날씨" icon="⛅" code="ENV-03" className="col-span-12 md:col-span-6 xl:col-span-4">
        <WeatherPanel />
      </Panel>
      <Panel title="중대재해 발생현황" icon="🚨" code="ALT-04" className="col-span-12 md:col-span-6 xl:col-span-4">
        <AccidentsPanel />
      </Panel>
      <Panel title="작업계획" icon="🗓️" code="OPS-05" className="col-span-12 md:col-span-6 xl:col-span-4">
        <WorkPlanPanel />
      </Panel>

      {/* 3행: 캘린더 · 안전교육 */}
      <Panel title="캘린더" icon="📅" code="OPS-06" className="col-span-12 md:col-span-6 xl:col-span-6">
        <CalendarPanel schedule={data?.schedule ?? []} />
      </Panel>
      <Panel
        title="안전교육 현황"
        icon="🎓"
        code="EDU-07"
        className="col-span-12 md:col-span-6 xl:col-span-6"
        action={
          onOpenEducation && (
            <button
              onClick={onOpenEducation}
              className="text-[11px] font-medium text-sky-600 hover:underline"
            >
              명부 보기 →
            </button>
          )
        }
      >
        <EducationStatusPanel />
      </Panel>
    </div>
  );
}

/* ---------------- HUD 스탯 보드 ---------------- */

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 숫자 카운트업 애니메이션 */
function useCountUp(target: number | null, duration = 900): number | null {
  const [val, setVal] = useState<number | null>(null);
  useEffect(() => {
    if (target === null) {
      setVal(null);
      return;
    }
    // 백그라운드 탭에서는 rAF가 멈추므로 애니메이션 없이 최종값 표시
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // 어떤 경우에도 최종값은 보장한다
    const failsafe = setTimeout(() => setVal(target), duration + 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
    };
  }, [target, duration]);
  return val;
}

function StatStrip({ data }: { data: SafetyData | null }) {
  const [planToday, setPlanToday] = useState<number | null>(null);
  const [eduDue, setEduDue] = useState<number | null>(null);
  const [nearmiss, setNearmiss] = useState<number | null>(null);

  useEffect(() => {
    fetch('/workplan.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { days?: { date: string; items: unknown[] }[] }) => {
        const day = (d.days ?? []).find((x) => x.date === todayStr());
        setPlanToday(day ? day.items.length : 0);
      })
      .catch(() => setPlanToday(null));
    void collectEducationStatus(new Date()).then(({ due }) => setEduDue(due.length));
    void listEntriesSilently<{ id: string }>('nearmiss', 'sj-nearmiss:v1').then((l) => setNearmiss(l.length));
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatBox label="금일 작업계획" value={planToday} unit="건" icon="🗓️" />
      <StatBox label="등록 위험요인" value={data ? data.risks.length : null} unit="건" icon="⚠️" />
      <StatBox label="교육 갱신 도래" value={eduDue} unit="명" icon="🎓" warn={(eduDue ?? 0) > 0} />
      <StatBox label="아차사고 신고" value={nearmiss} unit="건" icon="📢" />
    </div>
  );
}

function StatBox({
  label,
  value,
  unit,
  icon,
  warn = false,
}: {
  label: string;
  value: number | null;
  unit: string;
  icon: string;
  warn?: boolean;
}) {
  const n = useCountUp(value);
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="text-xs">{icon}</span>
        <span className="text-[10px] font-bold tracking-[0.18em] text-slate-400">{label}</span>
        <span
          aria-hidden
          className={`ml-auto h-1.5 w-1.5 animate-pulse rounded-full ${
            warn ? 'bg-orange-400 shadow-[0_0_8px_#fb923c]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
          }`}
        />
      </div>
      <p className="hud-num mt-1 font-mono text-3xl leading-none">
        {n === null ? '—' : n.toLocaleString()}
        <span className="ml-1 text-sm text-slate-500">{unit}</span>
      </p>
      <div
        className={`mt-2.5 h-0.5 rounded-full bg-gradient-to-r ${
          warn ? 'from-orange-400 via-amber-500/60 to-transparent' : 'from-cyan-400 via-blue-500/60 to-transparent'
        }`}
      />
    </div>
  );
}

/* ---------------- 공통 패널 ---------------- */

function Panel({
  title,
  icon,
  code,
  className = '',
  action,
  children,
}: {
  title: string;
  icon?: string;
  code?: string;
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center gap-2 px-4 py-2.5">
        <span
          aria-hidden
          className="h-3.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-cyan-300 to-blue-600 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
        />
        {icon && <span aria-hidden className="text-sm">{icon}</span>}
        <h3 className="shrink-0 text-sm font-bold tracking-wide text-slate-700">{title}</h3>
        <span aria-hidden className="mx-1 h-px min-w-4 flex-1 bg-gradient-to-r from-cyan-400/35 via-cyan-400/10 to-transparent" />
        {code && <span className="shrink-0 font-mono text-[9px] tracking-widest text-cyan-500/50">{code}</span>}
        {action && <span className="shrink-0">{action}</span>}
      </header>
      <div className="flex-1 border-t border-slate-100 p-4">{children}</div>
    </section>
  );
}

function EmptyBox({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center">
      <p className="text-sm text-slate-400">
        {label}
        <span className="mt-1 block text-xs text-slate-300">구성 예정</span>
      </p>
    </div>
  );
}
