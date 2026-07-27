'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  // 드롭다운 밖 클릭 시 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const onLoaded = (d: SafetyData) => {
    saveData(d);
    setData(d);
    setView('main');
  };

  const hasLedgers =
    !!data && data.edu.length + data.insp.length + data.incidents.length + data.schedule.length > 0;
  const menu = MENU.filter((m) => m.key !== 'ledgers' || hasLedgers);
  const navMenu = menu.filter((m) => m.key !== 'data'); // 데이터 관리는 우측 버튼으로

  const go = (key: ViewKey) => {
    setView(key);
    setOpenMenu(null);
  };

  /** 상단 메뉴 단일 항목 */
  const TopItem = ({ itemKey, label, icon, wip }: { itemKey: ViewKey; label: string; icon?: string; wip?: boolean }) => {
    const active = view === itemKey;
    return (
      <button
        onClick={() => go(itemKey)}
        className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-cyan-400/10 text-cyan-300 shadow-[inset_0_-2px_0_0_rgba(34,211,238,0.9),0_0_16px_rgba(34,211,238,0.12)]'
            : 'text-[#8fa3c8] hover:bg-white/5 hover:text-white'
        }`}
      >
        {icon && (
          <span aria-hidden className="mr-1 text-xs">
            {icon}
          </span>
        )}
        {label}
        {wip && <span className="ml-1 align-middle text-[9px] text-cyan-500/70">예정</span>}
      </button>
    );
  };

  /** 상단 메뉴 그룹(드롭다운) */
  const TopGroup = ({ item }: { item: MenuItem }) => {
    const open = openMenu === item.label;
    const activeChild = (item.children ?? []).some((c) => c.key === view);
    return (
      <div className="relative shrink-0">
        <button
          onClick={() => setOpenMenu(open ? null : item.label)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeChild
              ? 'bg-cyan-400/10 text-cyan-300 shadow-[inset_0_-2px_0_0_rgba(34,211,238,0.9),0_0_16px_rgba(34,211,238,0.12)]'
              : open
                ? 'bg-white/5 text-white'
                : 'text-[#8fa3c8] hover:bg-white/5 hover:text-white'
          }`}
        >
          <span aria-hidden className="mr-1 text-xs">
            {item.icon}
          </span>
          {item.label}
          <span aria-hidden className="ml-1 text-[9px] text-cyan-400/70">
            {open ? '▲' : '▼'}
          </span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1.5 min-w-44 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#0c1730]/95 p-1 shadow-[0_16px_44px_rgba(0,0,0,0.65),0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-md">
            {(item.children ?? []).map((c) => (
              <button
                key={c.key}
                onClick={() => go(c.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  view === c.key ? 'bg-cyan-400/10 text-cyan-300' : 'text-[#9db0d4] hover:bg-white/5 hover:text-white'
                }`}
              >
                {c.label}
                {c.wip && <span className="ml-auto text-[9px] text-cyan-500/60">예정</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /** 모바일 메뉴 칩 */
  const MobileChip = ({ itemKey, label }: { itemKey: ViewKey; label: string }) => {
    const active = view === itemKey;
    return (
      <button
        onClick={() => go(itemKey)}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
          active
            ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_14px_rgba(34,211,238,0.35)]'
            : 'border border-cyan-400/15 bg-white/5 text-[#9db0d4]'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* 상단 내비게이션 */}
      <header className="sticky top-0 z-40 border-b border-cyan-400/15 bg-[#0a1226]/85 backdrop-blur-md">
        <div className="flex items-center gap-5 px-4 py-2.5 lg:px-6">
          {/* 로고 */}
          <button onClick={() => go('main')} className="shrink-0 text-left" aria-label="메인으로">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-base shadow-[0_0_14px_rgba(34,211,238,0.45)]"
              >
                🛡️
              </span>
              <span>
                <span className="block text-base font-black leading-tight tracking-tight text-white">㈜신정개발</span>
                <span className="block text-[9px] font-bold tracking-[0.28em] text-cyan-400/90">
                  SMART SAFETY PLATFORM
                </span>
              </span>
            </span>
          </button>

          {/* 데스크톱 메뉴 */}
          <nav ref={navRef} className="hidden min-w-0 flex-1 flex-wrap items-center gap-0.5 md:flex">
            {navMenu.map((m) =>
              m.children ? (
                <TopGroup key={m.label} item={m} />
              ) : (
                <TopItem key={m.key} itemKey={m.key!} label={m.label} icon={m.icon} wip={m.wip} />
              ),
            )}
          </nav>

          <button
            onClick={() => go('data')}
            className="ml-auto shrink-0 rounded-lg bg-[#1f3864] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a4a80] md:ml-0"
          >
            💾 데이터 관리
          </button>
        </div>

        {/* 모바일 메뉴 */}
        <nav className="flex gap-2 overflow-x-auto px-4 pb-2.5 md:hidden">
          {navMenu.map((m) =>
            m.children ? (
              m.children.map((c) => <MobileChip key={c.key} itemKey={c.key} label={`${m.icon} ${c.label}`} />)
            ) : (
              <MobileChip key={m.key} itemKey={m.key!} label={`${m.icon} ${m.label}`} />
            ),
          )}
        </nav>
      </header>

      {/* 본문 */}
      <main className="flex-1 p-4 lg:p-6">
        {/* 페이지 타이틀 */}
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-lg font-bold tracking-tight text-white md:text-xl">{viewLabel(view)}</h1>
          {data ? (
            <span className="text-xs text-slate-400">
              {data.meta['평가연도'] && `${data.meta['평가연도']}년 · `}
              {data.fileName} · {new Date(data.loadedAt).toLocaleString('ko-KR')} 불러옴
            </span>
          ) : (
            ready && (
              <span className="text-xs text-orange-500">데이터 미연결 — [데이터 관리]에서 파일을 불러와 주세요</span>
            )
          )}
        </div>

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
                  데이터 파일을 선택하면 위험성평가 현황을 한눈에 보여드립니다. 파일을 다시 선택하면 최신 내용으로
                  교체됩니다.
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
