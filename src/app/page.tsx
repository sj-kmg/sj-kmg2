'use client';

import { useEffect, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { loadData, saveData, clearData } from '@/lib/store';
import FileDrop from '@/components/FileDrop';
import MainHome from '@/components/MainHome';
import Ledgers from '@/components/Ledgers';
import TbmLog from '@/components/TbmLog';
import NearMissReport from '@/components/NearMissReport';
import WorkforceLog from '@/components/WorkforceLog';
import EducationRoster from '@/components/EducationRoster';
import RiskAssessment from '@/components/RiskAssessment';
import YnccAccess from '@/components/YnccAccess';

type ViewKey =
  | 'main'
  | 'ledgers'
  | 'tbm'
  | 'nearmiss'
  | 'people'
  | 'health-general'
  | 'health-special'
  | 'health-followup'
  | 'edu-supervisor'
  | 'edu-chemical'
  | 'edu-yncc'
  | 'risk-assess'
  | 'notice'
  | 'data';

interface MenuChild {
  key: ViewKey;
  label: string;
  /** 추후 구성 예정 메뉴 */
  wip?: boolean;
}

interface MenuItem {
  key?: ViewKey;
  label: string;
  icon: string;
  needsData?: boolean;
  wip?: boolean;
  children?: MenuChild[];
}

const MENU: MenuItem[] = [
  { key: 'main', label: '메인', icon: '🏠' },
  { key: 'ledgers', label: '관리대장', icon: '📚', needsData: true },
  { key: 'tbm', label: 'TBM일지', icon: '📣' },
  { key: 'nearmiss', label: '아차사고', icon: '⚠️' },
  { key: 'people', label: '작업인원관리', icon: '👷' },
  {
    label: '건강검진',
    icon: '🩺',
    children: [
      { key: 'health-general', label: '일반검진', wip: true },
      { key: 'health-special', label: '특수검진', wip: true },
      { key: 'health-followup', label: '유소견자관리', wip: true },
    ],
  },
  {
    label: '안전교육',
    icon: '🎓',
    children: [
      { key: 'edu-supervisor', label: '관리감독자' },
      { key: 'edu-chemical', label: '유해화학물질' },
      { key: 'edu-yncc', label: 'YNCC출입' },
    ],
  },
  { key: 'risk-assess', label: '위험성평가', icon: '📝' },
  { key: 'notice', label: '공지사항', icon: '📢', wip: true },
  { key: 'data', label: '데이터 관리', icon: '💾' },
];

function viewLabel(view: ViewKey): string {
  for (const m of MENU) {
    if (m.key === view) return m.label;
    for (const c of m.children ?? []) {
      if (c.key === view) return `${m.label} — ${c.label}`;
    }
  }
  return '메인';
}

export default function Page() {
  const [data, setData] = useState<SafetyData | null>(null);
  const [view, setView] = useState<ViewKey>('main');
  const [ready, setReady] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    건강검진: true,
    안전교육: true,
  });

  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  const onLoaded = (d: SafetyData) => {
    saveData(d);
    setData(d);
    setView('main');
  };

  const hasLedgers =
    !!data && data.edu.length + data.insp.length + data.incidents.length + data.schedule.length > 0;
  const menu = MENU.filter((m) => m.key !== 'ledgers' || hasLedgers);

  const ItemButton = ({
    itemKey,
    label,
    icon,
    wip,
    child = false,
    mobile = false,
  }: {
    itemKey: ViewKey;
    label: string;
    icon?: string;
    wip?: boolean;
    child?: boolean;
    mobile?: boolean;
  }) => {
    const active = view === itemKey;
    if (mobile) {
      return (
        <button
          onClick={() => setView(itemKey)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
            active ? 'bg-[#1f3864] text-white' : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          {icon && <span aria-hidden>{icon} </span>}
          {label}
        </button>
      );
    }
    return (
      <button
        onClick={() => setView(itemKey)}
        className={`flex w-full items-center gap-3 border-l-4 py-2.5 text-left text-sm font-medium transition-colors ${
          child ? 'pl-11 pr-4' : 'px-4'
        } ${
          active
            ? 'border-sky-300 bg-white/15 text-white'
            : 'border-transparent text-blue-100 hover:bg-white/10 hover:text-white'
        }`}
      >
        {icon && <span aria-hidden>{icon}</span>}
        <span>{label}</span>
        {wip && <span className="ml-auto text-[10px] text-blue-300">예정</span>}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* 사이드바 (데스크톱) */}
      <aside className="hidden w-56 shrink-0 flex-col bg-[#1f3864] md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <p className="text-lg font-black leading-tight text-white">㈜신정개발</p>
          <p className="text-xs font-medium tracking-wide text-sky-300">Smart Safety Platform</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {menu.map((m) =>
            m.children ? (
              <div key={m.label}>
                <button
                  onClick={() => setOpenGroups((g) => ({ ...g, [m.label]: !g[m.label] }))}
                  className="flex w-full items-center gap-3 border-l-4 border-transparent px-4 py-2.5 text-left text-sm font-semibold text-blue-100 hover:bg-white/10 hover:text-white"
                >
                  <span aria-hidden>{m.icon}</span>
                  <span>{m.label}</span>
                  <span className="ml-auto text-xs text-blue-300">{openGroups[m.label] ? '▾' : '▸'}</span>
                </button>
                {openGroups[m.label] &&
                  m.children.map((c) => (
                    <ItemButton key={c.key} itemKey={c.key} label={c.label} wip={c.wip} child />
                  ))}
              </div>
            ) : (
              <ItemButton key={m.key} itemKey={m.key!} label={m.label} icon={m.icon} wip={m.wip} />
            ),
          )}
        </nav>
        <p className="px-4 py-4 text-[10px] leading-relaxed text-blue-300/70">
          데이터는 브라우저에서만 처리되며
          <br />
          서버로 전송되지 않습니다.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상단 헤더 */}
        <header className="border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <h1 className="text-base font-bold text-[#1f3864] md:text-lg">{viewLabel(view)}</h1>
            {data ? (
              <span className="text-xs text-slate-400">
                {data.meta['평가연도'] && `${data.meta['평가연도']}년 · `}
                {data.fileName} · {new Date(data.loadedAt).toLocaleString('ko-KR')} 불러옴
              </span>
            ) : (
              ready && <span className="text-xs text-orange-500">데이터 미연결 — [데이터 관리]에서 파일을 불러와 주세요</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setView('data')}
                className="rounded-lg bg-[#1f3864] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a4a80]"
              >
                데이터 관리
              </button>
            </div>
          </div>
          {/* 모바일 메뉴 */}
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
            {menu.map((m) =>
              m.children ? (
                m.children.map((c) => (
                  <ItemButton key={c.key} itemKey={c.key} label={`${m.icon} ${c.label}`} mobile />
                ))
              ) : (
                <ItemButton key={m.key} itemKey={m.key!} label={m.label} icon={m.icon} mobile />
              ),
            )}
          </nav>
        </header>

        {/* 본문 */}
        <main className="flex-1 p-4 lg:p-6">
          {!ready ? null : (
            <>
              {view === 'main' && <MainHome data={data} onOpenEducation={() => setView('edu-supervisor')} />}
              {view === 'ledgers' && (data ? <Ledgers data={data} /> : <NeedData onGo={() => setView('data')} />)}
              {view === 'tbm' && <TbmLog data={data} />}
              {view === 'nearmiss' && <NearMissReport />}
              {view === 'people' && <WorkforceLog data={data} />}
              {view === 'edu-supervisor' && <EducationRoster courseKey="supervisor" />}
              {view === 'edu-chemical' && <EducationRoster courseKey="chemical" />}
              {view === 'edu-yncc' && <YnccAccess />}
              {view === 'risk-assess' && <RiskAssessment />}
              {(view === 'health-general' ||
                view === 'health-special' ||
                view === 'health-followup' ||
                view === 'notice') && <ComingSoon label={viewLabel(view)} />}
              {view === 'data' && (
                <div className="mx-auto max-w-2xl py-6">
                  <h2 className="mb-2 text-xl font-bold text-slate-800">안전관리 데이터 불러오기</h2>
                  <p className="mb-6 text-sm text-slate-500">
                    데이터 파일을 선택하면 위험성평가 현황을 한눈에 보여드립니다. 파일을 다시 선택하면 최신
                    내용으로 교체됩니다.
                  </p>
                  <FileDrop onLoaded={onLoaded} />
                  {data && (
                    <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-sm text-slate-600">
                        현재 데이터: <b>{data.fileName}</b>
                        <span className="ml-2 text-xs text-slate-400">
                          {new Date(data.loadedAt).toLocaleString('ko-KR')} 불러옴 · 위험요인 {data.risks.length}건
                        </span>
                      </p>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              '이 브라우저에 저장된 대시보드 데이터를 삭제할까요?\n(원본 파일은 영향을 받지 않습니다)',
                            )
                          ) {
                            clearData();
                            setData(null);
                          }
                        }}
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        데이터 삭제
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        <footer className="border-t border-slate-200 py-3 text-center text-xs text-slate-400">
          데이터는 이 브라우저에서만 처리·보관되며 서버로 전송되지 않습니다.
        </footer>
      </div>
    </div>
  );
}

function NeedData({ onGo }: { onGo: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-4xl">📂</p>
      <p className="mt-3 font-semibold text-slate-700">불러온 데이터가 없습니다</p>
      <p className="mt-1 text-sm text-slate-500">데이터 파일을 먼저 불러와 주세요.</p>
      <button
        onClick={onGo}
        className="mt-4 rounded-lg bg-[#1f3864] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a80]"
      >
        데이터 관리로 이동
      </button>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-4xl">🚧</p>
      <p className="mt-3 font-semibold text-slate-700">{label} — 구성 예정</p>
      <p className="mt-1 text-sm text-slate-500">이 메뉴의 세부 내용은 확정되는 대로 채워집니다.</p>
    </div>
  );
}
