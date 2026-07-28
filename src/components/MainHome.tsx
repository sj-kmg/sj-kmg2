'use client';

import type { SafetyData } from '@/lib/types';
import CalendarPanel from './CalendarPanel';
import WeatherPanel from './WeatherPanel';
import NoticesPanel from './NoticesPanel';
import AccidentsPanel from './AccidentsPanel';
import MemoPanel from './MemoPanel';
import EducationStatusPanel from './EducationStatusPanel';
import GeneralAffairsPanel from './GeneralAffairsPanel';

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
      <Panel title="메모장" icon="📝" code="MEM-05" className="col-span-12 md:col-span-6 xl:col-span-4">
        <MemoPanel />
      </Panel>

      {/* 3행: 캘린더 · 안전교육 · 공무관리 */}
      <Panel title="캘린더" icon="📅" code="OPS-06" className="col-span-12 md:col-span-6 xl:col-span-4">
        <CalendarPanel schedule={data?.schedule ?? []} />
      </Panel>
      <Panel
        title="안전교육 현황"
        icon="🎓"
        code="EDU-07"
        className="col-span-12 md:col-span-6 xl:col-span-4"
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
      <Panel title="공무관리 현황" icon="🗂️" code="GAF-08" className="col-span-12 md:col-span-6 xl:col-span-4">
        <GeneralAffairsPanel />
      </Panel>
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
