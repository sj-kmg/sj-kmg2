'use client';

import { useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { highRiskMin } from '@/lib/risk';
import { useOps } from '@/lib/useOps';
import { todayLocal } from '@/lib/workforce';
import OpsCalendar from './OpsCalendar';
import SiteBoard from './SiteBoard';
import CrewPanel from './CrewPanel';
import OpsTrend from './OpsTrend';
import WeatherPanel from './WeatherPanel';
import NoticesPanel from './NoticesPanel';
import AccidentsPanel from './AccidentsPanel';
import EducationStatusPanel from './EducationStatusPanel';
import GeneralAffairsPanel from './GeneralAffairsPanel';

/**
 * 메인 화면 — "오늘 어느 현장에서 · 누가 지휘하고 · 누가 몇 명 일하는가"를 축으로 구성한다.
 * 상단 KPI → 캘린더/현장 보드 → 인원 배치·추세 → 교육·공무 → (작게) 공지·알림·중대재해.
 */
export default function MainHome({
  onOpenEducation,
  onOpenWorkforce,
  onOpenTbm,
  data,
}: {
  data: SafetyData | null;
  onOpenEducation?: () => void;
  onOpenWorkforce?: () => void;
  onOpenTbm?: () => void;
}) {
  const ops = useOps();
  const [date, setDate] = useState(todayLocal());
  const day = ops.dayOf(date);
  const isToday = date === todayLocal();

  const siteCount = day.sites.length;
  const tbmDone = day.sites.filter((s) => day.tbmSites.has(s)).length;
  const noManager = day.entries.filter((e) => !e.manager.trim()).length;

  const hi = data ? highRiskMin(data.gradeSystem) : 0;
  const highRisk = data ? data.risks.filter((r) => r.r !== null && (r.r as number) >= hi).length : 0;

  return (
    <div className="space-y-4">
      {/* ── KPI ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label={isToday ? '오늘 가동 현장' : '가동 현장'}
          value={siteCount}
          unit="곳"
          sub={siteCount > 0 ? day.sites.join(' · ') : '등록된 현장 없음'}
          tone="blue"
          icon="🏗️"
        />
        <Kpi
          label="투입 인원"
          value={day.headcount}
          unit="명"
          sub={`직원 ${day.staff} · 인력 ${day.labor}`}
          tone="cyan"
          icon="👷"
        />
        <Kpi
          label="TBM 실시"
          value={siteCount === 0 ? '-' : `${tbmDone}/${siteCount}`}
          unit=""
          sub={siteCount === 0 ? '해당 없음' : tbmDone === siteCount ? '전 현장 실시 완료' : `미실시 ${siteCount - tbmDone}곳`}
          tone={siteCount > 0 && tbmDone < siteCount ? 'red' : 'emerald'}
          icon="📋"
        />
        <Kpi
          label="현장소장 배치"
          value={siteCount === 0 ? '-' : `${day.entries.length - noManager}/${day.entries.length}`}
          unit=""
          sub={noManager > 0 ? `미지정 ${noManager}건 — 확인 필요` : '전 현장 지정 완료'}
          tone={noManager > 0 ? 'red' : 'emerald'}
          icon="🎖️"
        />
        <Kpi
          label={`고위험 요인 (R≥${hi || '-'})`}
          value={data ? highRisk : '-'}
          unit={data ? '건' : ''}
          sub={data ? `전체 위험요인 ${data.risks.length}건` : '데이터 미연결'}
          tone={highRisk > 0 ? 'amber' : 'slate'}
          icon="⚠️"
        />
      </div>

      {/* ── 현장·인원 관리 ───────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        <Panel
          title="현장·인원 캘린더"
          icon="📅"
          hint="날짜 선택"
          className="col-span-12 xl:col-span-4"
        >
          <OpsCalendar ops={ops} schedule={data?.schedule ?? []} selected={date} onSelect={setDate} />
        </Panel>

        <Panel
          title="현장 운영 보드"
          icon="🏗️"
          hint={isToday ? 'LIVE' : '조회'}
          live={isToday}
          className="col-span-12 xl:col-span-8"
        >
          <SiteBoard
            ops={ops}
            date={date}
            onDateChange={setDate}
            onOpenWorkforce={onOpenWorkforce}
            onOpenTbm={onOpenTbm}
          />
        </Panel>

        <Panel title="인원 배치 현황" icon="👷" className="col-span-12 md:col-span-6 xl:col-span-4">
          <CrewPanel ops={ops} date={date} />
        </Panel>

        <Panel title="투입 인원 추세" icon="📈" className="col-span-12 md:col-span-6 xl:col-span-4">
          <OpsTrend ops={ops} date={date} onSelect={setDate} />
        </Panel>

        <Panel title="오늘의 날씨" icon="⛅" className="col-span-12 xl:col-span-4">
          <WeatherPanel />
        </Panel>

        {/* ── 교육·공무 ─────────────────────────────────────── */}
        <Panel
          title="안전교육 현황"
          icon="🎓"
          className="col-span-12 md:col-span-6"
          action={
            onOpenEducation && (
              <button onClick={onOpenEducation} className="text-[11px] font-semibold text-blue-700 hover:underline">
                명부 보기 →
              </button>
            )
          }
        >
          <EducationStatusPanel />
        </Panel>
        <Panel title="공무관리 현황" icon="🗂️" className="col-span-12 md:col-span-6">
          <GeneralAffairsPanel />
        </Panel>

        {/* ── 참고 정보 (비중 축소) ─────────────────────────── */}
        <Panel title="공지사항" icon="📢" muted className="col-span-12 md:col-span-6 xl:col-span-4">
          <div className="flex h-full min-h-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-4 text-center">
            <p className="text-xs text-slate-400">
              공지사항이 표시될 영역입니다
              <span className="mt-0.5 block text-[10px] text-slate-300">구성 예정</span>
            </p>
          </div>
        </Panel>
        <Panel title="알림메세지" icon="🔔" muted className="col-span-12 md:col-span-6 xl:col-span-4">
          <NoticesPanel compact />
        </Panel>
        <Panel title="중대재해 발생현황" icon="🚨" muted className="col-span-12 xl:col-span-4">
          <AccidentsPanel compact />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- KPI 타일 ---------------- */

const TONE: Record<string, { text: string; glow: string; bar: string }> = {
  blue: { text: '#82a6ff', glow: 'rgba(75,123,255,0.5)', bar: 'linear-gradient(90deg,#4b7bff,#7c5cff)' },
  cyan: { text: '#67e8f9', glow: 'rgba(34,211,238,0.45)', bar: 'linear-gradient(90deg,#22d3ee,#4b7bff)' },
  emerald: { text: '#6ee7b7', glow: 'rgba(52,211,153,0.4)', bar: 'linear-gradient(90deg,#34d399,#22d3ee)' },
  red: { text: '#ffa8a8', glow: 'rgba(242,85,95,0.45)', bar: 'linear-gradient(90deg,#f2555f,#ff8f3c)' },
  amber: { text: '#ffd97a', glow: 'rgba(251,191,36,0.4)', bar: 'linear-gradient(90deg,#fbbf24,#ff8f3c)' },
  slate: { text: '#bcc6de', glow: 'rgba(150,178,255,0.25)', bar: 'linear-gradient(90deg,#55627f,#8b98b8)' },
};

function Kpi({
  label,
  value,
  unit,
  sub,
  tone = 'blue',
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  tone?: keyof typeof TONE | string;
  icon?: string;
}) {
  const t = TONE[tone] ?? TONE.blue;
  return (
    <section className="panel-lit relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: t.bar }} />
      <div className="flex items-center gap-1.5">
        {icon && <span aria-hidden className="text-xs opacity-80">{icon}</span>}
        <p className="truncate text-[11px] font-semibold text-slate-400">{label}</p>
      </div>
      <p
        className="mt-1.5 font-mono text-[28px] font-bold leading-none"
        style={{ color: t.text, textShadow: `0 0 24px ${t.glow}` }}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </p>
      {sub && <p className="mt-1.5 truncate text-[11px] text-slate-400" title={sub}>{sub}</p>}
    </section>
  );
}

/* ---------------- 공통 패널 ---------------- */

function Panel({
  title,
  icon,
  hint,
  live,
  muted,
  className = '',
  action,
  children,
}: {
  title: string;
  icon?: string;
  hint?: string;
  live?: boolean;
  muted?: boolean;
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`panel-lit flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        {icon && (
          <span aria-hidden className="text-sm opacity-90">
            {icon}
          </span>
        )}
        <h3 className={`shrink-0 text-[13px] font-bold tracking-tight ${muted ? 'text-slate-500' : 'text-slate-800'}`}>
          {title}
        </h3>
        {hint && (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
              live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {live && <span aria-hidden className="mr-1 inline-block h-1 w-1 animate-pulse rounded-full bg-emerald-400 align-middle" />}
            {hint}
          </span>
        )}
        <span aria-hidden className="mx-1 h-px min-w-4 flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
        {action && <span className="shrink-0">{action}</span>}
      </header>
      <div className="flex-1 px-4 pb-4">{children}</div>
    </section>
  );
}
