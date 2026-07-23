'use client';

import type { SafetyData } from '@/lib/types';
import GradeDistChart from './charts/GradeDistChart';
import CalendarPanel from './CalendarPanel';

/**
 * 메인 화면 — 플랫폼형 카드 그리드.
 * 각 패널의 세부 내용은 추후 확정되는 대로 채운다. (현재는 자리 표시)
 */
export default function MainHome({ data }: { data: SafetyData | null }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* 1행: 공지 · 알림 */}
      <Panel title="공지사항" icon="📢" className="col-span-12 lg:col-span-6">
        <EmptyBox label="공지사항이 표시될 영역입니다" />
      </Panel>
      <Panel title="알림메세지" icon="🔔" className="col-span-12 lg:col-span-6">
        <EmptyBox label="알림메세지가 표시될 영역입니다" />
      </Panel>

      {/* 2행: 날씨 · 프로젝트 · 공종 */}
      <Panel title="오늘의 날씨" icon="⛅" className="col-span-12 md:col-span-6 xl:col-span-4">
        <EmptyBox label="현장 날씨·기온·풍속 (연동 예정)" />
      </Panel>
      <Panel title="프로젝트" icon="🏗️" className="col-span-12 md:col-span-6 xl:col-span-4">
        <EmptyBox label="프로젝트 현황이 표시될 영역입니다" />
      </Panel>
      <Panel title="공종" icon="🔧" className="col-span-12 md:col-span-6 xl:col-span-4">
        <EmptyBox label="공종 현황이 표시될 영역입니다" />
      </Panel>

      {/* 3행: 캘린더 · 작업허가 · 출력인원 · 출력장비 */}
      <Panel title="캘린더" icon="📅" className="col-span-12 md:col-span-6 xl:col-span-3">
        <CalendarPanel schedule={data?.schedule ?? []} />
      </Panel>
      <Panel title="작업허가 현황" icon="✅" className="col-span-12 md:col-span-6 xl:col-span-3">
        <EmptyBox label="작업허가 현황이 표시될 영역입니다" />
      </Panel>
      <Panel title="현장출력인원" icon="👷" className="col-span-12 md:col-span-6 xl:col-span-3">
        <EmptyBox label="출력인원 현황이 표시될 영역입니다" />
      </Panel>
      <Panel title="현장출력장비" icon="🚜" className="col-span-12 md:col-span-6 xl:col-span-3">
        <EmptyBox label="출력장비 현황이 표시될 영역입니다" />
      </Panel>

      {/* 4행: 중장비 · 위험등급 · 안전교육 */}
      <Panel title="중장비 현황" icon="🏋️" className="col-span-12 md:col-span-6 xl:col-span-4">
        <EmptyBox label="중장비 현황이 표시될 영역입니다" />
      </Panel>
      <Panel title="위험등급 현황" icon="🚦" className="col-span-12 xl:col-span-5 md:col-span-6">
        {data ? (
          <GradeDistChart risks={data.risks} system={data.gradeSystem} />
        ) : (
          <EmptyBox label="데이터를 불러오면 위험등급 분포가 표시됩니다" />
        )}
      </Panel>
      <Panel title="안전교육 현황" icon="🎓" className="col-span-12 md:col-span-6 xl:col-span-3">
        <EmptyBox label="안전교육 현황이 표시될 영역입니다" />
      </Panel>
    </div>
  );
}

function Panel({
  title,
  icon,
  className = '',
  children,
}: {
  title: string;
  icon?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        {icon && <span aria-hidden className="text-sm">{icon}</span>}
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </header>
      <div className="flex-1 p-4">{children}</div>
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
