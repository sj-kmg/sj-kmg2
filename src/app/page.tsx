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
import SupervisorSheet from '@/components/SupervisorSheet';
import RiskAssessment from '@/components/RiskAssessment';
import ChemicalAccess from '@/components/ChemicalAccess';
import YnccWorkers from '@/components/YnccWorkers';
import YnccVehicles from '@/components/YnccVehicles';
import AccessPass from '@/components/AccessPass';
import AnnualPlan from '@/components/AnnualPlan';
import HealthCheckSheet from '@/components/HealthCheckSheet';
import GasDetectorSheet from '@/components/GasDetectorSheet';
import VehicleCheckSheet from '@/components/VehicleCheckSheet';
import InventorySheet from '@/components/InventorySheet';
import SafetyStockSheet from '@/components/SafetyStockSheet';
import EquipmentCheck from '@/components/EquipmentCheck';
import SearchResults from '@/components/SearchResults';
import AccessAdmin from '@/components/AccessAdmin';
import GoogleAuthBox from '@/components/GoogleAuthBox';
import { FIELD_VIEWS, useRole } from '@/lib/useRole';

type ViewKey =
  | 'main'
  | 'ledgers'
  | 'tbm'
  | 'nearmiss'
  | 'health-general'
  | 'health-special'
  | 'health-followup'
  | 'edu-supervisor'
  | 'edu-chemical'
  | 'edu-yncc'
  | 'annual-plan'
  | 'card'
  | 'yncc-vehicle'
  | 'gas-meter'
  | 'vehicle-service'
  | 'inventory'
  | 'safety-stock'
  | 'equipment-check'
  | 'risk-assess'
  | 'people'
  | 'notice'
  | 'access'
  | 'data'
  | 'search';

/** 다단계 메뉴 노드 — 대분류(중분류(소분류…)) */
interface MenuNode {
  key?: ViewKey;
  label: string;
  icon?: string;
  wip?: boolean;
  /** 오른쪽에 표시할 알림 숫자 (권한허용의 대기 건수) */
  badge?: number;
  children?: MenuNode[];
}

const MENU: MenuNode[] = [
  { key: 'main', label: '메인', icon: '🏠' },
  {
    label: '안전관리',
    icon: '🛡️',
    children: [
      { key: 'tbm', label: 'TBM일지' },
      { key: 'nearmiss', label: '아차사고' },
    ],
  },
  {
    label: '공무관리',
    icon: '🗂️',
    children: [
      { key: 'annual-plan', label: '공무연간계획' },
      {
        label: '건강검진',
        children: [
          { key: 'health-general', label: '일반검진' },
          { key: 'health-special', label: '특수검진' },
          { key: 'health-followup', label: '유소견자 관리', wip: true },
        ],
      },
      {
        label: '안전교육',
        children: [
          { key: 'edu-supervisor', label: '관리감독자' },
          { key: 'edu-chemical', label: '유해화학물질' },
          { key: 'edu-yncc', label: 'YNCC출입' },
        ],
      },
      {
        label: '신청현황',
        children: [
          { key: 'card', label: '상시카드&차량' },
          { key: 'yncc-vehicle', label: 'YNCC차량' },
        ],
      },
      { key: 'gas-meter', label: '산소&가스측정기' },
      { key: 'vehicle-service', label: '차량점검내역' },
      { key: 'inventory', label: '통합재고관리' },
      { key: 'safety-stock', label: '안전용품관리' },
      { key: 'equipment-check', label: '장비점검' },
    ],
  },
  { key: 'people', label: '작업인원관리', icon: '👷' },
  { key: 'risk-assess', label: '위험성평가', icon: '📝' },
  { key: 'notice', label: '공지사항', icon: '📢', wip: true },
];

/** 허용된 화면만 남긴다 — 현장 계정·열람 전용 계정 공용 */
function limitMenu(nodes: MenuNode[], allowed: string[]): MenuNode[] {
  const out: MenuNode[] = [];
  for (const n of nodes) {
    if (n.children) {
      const kids = limitMenu(n.children, allowed);
      if (kids.length) out.push({ ...n, children: kids });
    } else if (n.key && allowed.includes(n.key)) {
      out.push(n);
    }
  }
  return out;
}

/** 노드(트리)에 해당 뷰가 포함되는가 */
function hasView(node: MenuNode, view: ViewKey): boolean {
  if (node.key === view) return true;
  return (node.children ?? []).some((c) => hasView(c, view));
}

/** 뷰의 전체 경로 라벨 (예: 공무관리 — 안전교육 — 유해화학물질) */
function findPath(nodes: MenuNode[], view: ViewKey): string[] | null {
  for (const n of nodes) {
    if (n.key === view) return [n.label];
    if (n.children) {
      const sub = findPath(n.children, view);
      if (sub) return [n.label, ...sub];
    }
  }
  return null;
}

/** 모든 말단(leaf) 노드 */
function leaves(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((n) => (n.children ? leaves(n.children) : [n]));
}

/* 메뉴 컴포넌트는 모듈 레벨로 정의 — Page 리렌더(시계 등)에도 펼침 상태가 유지된다 */

/** 사이드바 메뉴 노드 (대·중·소분류 아코디언) */
function SideNode({
  node,
  depth,
  view,
  go,
}: {
  node: MenuNode;
  depth: number;
  view: ViewKey;
  go: (k: ViewKey) => void;
}) {
  const containsActive = hasView(node, view);
  const [open, setOpen] = useState(containsActive);

  if (!node.children) {
    const active = node.key ? view === node.key : false;
    return (
      <button
        onClick={() => node.key && go(node.key)}
        className={`side-link ${active ? 'side-link--on' : ''}`}
        style={{ paddingLeft: `${0.7 + depth * 0.75}rem` }}
      >
        {node.icon && (
          <span aria-hidden className="text-[13px]">
            {node.icon}
          </span>
        )}
        <span className="truncate">{node.label}</span>
        {node.badge != null && node.badge > 0 && (
          <span
            aria-label={`처리할 신청 ${node.badge}건`}
            className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-[0_0_10px_rgba(242,85,95,0.8)]"
          >
            {node.badge}
          </span>
        )}
        {node.wip && <span className="ml-auto shrink-0 text-[9px] font-normal text-slate-400">예정</span>}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`side-link ${containsActive && !open ? 'text-slate-800' : ''}`}
        style={{ paddingLeft: `${0.7 + depth * 0.75}rem` }}
        aria-expanded={open}
      >
        {node.icon && (
          <span aria-hidden className="text-[13px]">
            {node.icon}
          </span>
        )}
        <span className="truncate">{node.label}</span>
        <span aria-hidden className={`ml-auto shrink-0 text-[8px] transition-transform ${open ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-1">
          {node.children.map((c) => (
            <SideNode key={c.key ?? c.label} node={c} depth={depth} view={view} go={go} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<SafetyData | null>(null);
  const [view, setView] = useState<ViewKey>('main');
  const session = useRole();
  const { role } = session;
  /** 현장 계정이면 쓸 수 있는 화면만 보여 준다 */
  const isField = role === 'field';
  /** 승인된 열람 전용 계정 — 지정된 메뉴만 보이고, 저장·삭제는 서버가 막는다 */
  const isViewer = role === 'viewer';
  const viewerMenus = session.menus ?? [];
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [clock, setClock] = useState('');
  const [today, setToday] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setData(loadData());
    setReady(true);
    // 앱 아이콘 바로가기(?view=tbm 등)로 열었을 때 해당 화면부터 보여 준다
    const wanted = new URLSearchParams(window.location.search).get('view');
    if (wanted && leaves(MENU).some((n) => n.key === wanted)) {
      setView(wanted as ViewKey);
    }
  }, []);

  // 쓸 수 없는 화면에 있으면 허용된 첫 화면으로 돌려보낸다
  useEffect(() => {
    if (isField && !FIELD_VIEWS.includes(view)) setView('tbm');
  }, [isField, view]);
  useEffect(() => {
    if (isViewer && view !== 'search' && !viewerMenus.includes(view)) {
      setView((viewerMenus[0] as ViewKey) ?? 'main');
    }
  }, [isViewer, viewerMenus, view]);

  // 헤더 라이브 시계
  useEffect(() => {
    const DOW = ['일', '월', '화', '수', '목', '금', '토'];
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
      setToday(`${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} (${DOW[d.getDay()]})`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const onLoaded = (d: SafetyData) => {
    saveData(d);
    setData(d);
    setView('main');
  };

  const hasLedgers =
    !!data && data.edu.length + data.insp.length + data.incidents.length + data.schedule.length > 0;
  // 관리대장은 데이터가 있을 때만 안전관리 하위에 노출
  const fullMenu: MenuNode[] = MENU.map((m) =>
    m.label === '안전관리' && hasLedgers
      ? { ...m, children: [...(m.children ?? []), { key: 'ledgers' as ViewKey, label: '관리대장' }] }
      : m,
  );
  // 권한허용은 관리자에게만 — 대기 건수를 배지로 알린다
  if (role === 'admin') {
    fullMenu.push({ key: 'access', label: '권한허용', icon: '🔑', badge: session.pendingCount });
  }
  // 현장 계정은 TBM일지·아차사고만, 열람 계정은 승인된 메뉴만
  const menu: MenuNode[] = isField
    ? limitMenu(fullMenu, FIELD_VIEWS)
    : isViewer
      ? limitMenu(fullMenu, viewerMenus)
      : fullMenu;

  const go = (key: ViewKey) => {
    setView(key);
    setNavOpen(false);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setQuery(q);
    setView('search');
    setNavOpen(false);
  };

  const viewPath = (v: ViewKey): string[] => {
    if (v === 'data') return ['데이터 관리'];
    if (v === 'ledgers') return ['안전관리', '관리대장'];
    if (v === 'search') return ['검색'];
    if (v === 'access') return ['권한허용'];
    return findPath(menu, v) ?? ['메인'];
  };
  const path = viewPath(view);

  /* ── 사이드바 본문 (데스크톱·모바일 공용) ─────────────────── */
  const sidebar = (
    <div className="flex h-full flex-col">
      {/* 로고 */}
      <button onClick={() => go('main')} className="flex shrink-0 items-center gap-2.5 px-4 pb-4 pt-5 text-left">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-[0_6px_20px_-6px_rgba(75,123,255,0.6)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-symbol.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-black leading-tight tracking-tight text-slate-900">
            ㈜신정개발
          </span>
          <span className="block truncate text-[8.5px] font-bold tracking-[0.22em] text-blue-700">
            SMART SAFETY PLATFORM
          </span>
        </span>
      </button>

      {/* 검색 */}
      <form onSubmit={submitSearch} className="relative shrink-0 px-3 pb-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="이름·차량번호·키워드 검색"
          aria-label="전체 검색"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-2.5 text-xs text-slate-700 placeholder:text-slate-300"
        />
        <span aria-hidden className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-[11px] opacity-60">
          🔍
        </span>
      </form>

      {/* 메뉴 */}
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        <p className="px-2 pb-1 pt-1.5 text-[9px] font-bold tracking-[0.18em] text-slate-400">MENU</p>
        {menu.map((m) => (
          <SideNode key={m.key ?? m.label} node={m} depth={0} view={view} go={go} />
        ))}
      </nav>

      {/* 계정 · 데이터 */}
      <div className="shrink-0 space-y-2 border-t border-slate-200 p-3">
        {session.user ? (
          <GoogleAuthBox session={session} />
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#22d3ee] to-[#4b7bff] text-[11px] font-bold text-white"
              >
                {isField ? '현' : '관'}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-slate-700">
                  {isField ? '현장 계정' : '관리자'}
                </span>
                <span className="block truncate text-[9px] text-slate-400">
                  {isField ? 'TBM·아차사고 작성' : '전체 메뉴 사용'}
                </span>
              </span>
            </div>
            <GoogleAuthBox session={session} />
          </>
        )}
        {!isField && !isViewer && (
          <button
            onClick={() => go('data')}
            className={`w-full rounded-xl px-3 py-2 text-xs font-semibold ${
              view === 'data'
                ? 'bg-[#1f3864] text-white'
                : 'border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            💾 데이터 관리
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* ── 사이드바 (데스크톱 고정) ───────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200 bg-[color:var(--bg-soft)]/80 backdrop-blur-xl lg:block xl:w-64">
        {sidebar}
      </aside>

      {/* ── 사이드바 (모바일 드로어) ───────────────────────── */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="메뉴 닫기"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 h-full w-64 border-r border-slate-200 bg-[color:var(--bg-soft)] shadow-2xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* ── 본문 ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="topbar sticky top-0 z-40 border-b border-slate-200 bg-[color:var(--bg)]/75 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
            <button
              onClick={() => setNavOpen(true)}
              aria-label="메뉴 열기"
              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 lg:hidden"
            >
              ☰
            </button>

            {/* 경로 + 제목 */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold tracking-wider text-slate-400">
                {path.slice(0, -1).length > 0 ? path.slice(0, -1).join(' / ') : '대시보드'}
              </p>
              <h1 className="flex items-center gap-2 truncate text-base font-bold tracking-tight text-slate-900 md:text-lg">
                {view === 'search' ? (
                  <>
                    검색 <span className="truncate text-sm font-medium text-blue-700">&ldquo;{query}&rdquo;</span>
                  </>
                ) : (
                  path[path.length - 1]
                )}
              </h1>
            </div>

            {/* 데이터 연결 상태 — 파일이 연결돼 있을 때만 조용히 표시, 미연결 경고는 띄우지 않는다 */}
            {ready && data && (
              <span
                className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-400 xl:flex"
                title={`${data.fileName} · ${new Date(data.loadedAt).toLocaleString('ko-KR')} 불러옴`}
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="max-w-40 truncate font-semibold text-slate-500">{data.fileName}</span>
              </span>
            )}

            {/* 날짜·시계 */}
            <div className="hidden shrink-0 text-right md:block">
              <p className="font-mono text-[10px] leading-tight text-slate-400">{today}</p>
              <p className="font-mono text-sm font-bold leading-tight text-slate-800">{clock}</p>
            </div>
          </div>

          {/* 모바일 검색 */}
          <form onSubmit={submitSearch} className="relative px-4 pb-2.5 lg:hidden">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="이름·차량번호·키워드 전체 검색"
              aria-label="전체 검색"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 placeholder:text-slate-300"
            />
            <button type="submit" aria-label="검색" className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </button>
          </form>
        </header>

        <main key={view === 'search' ? `search-${query}` : view} className="view-enter flex-1 p-4 lg:p-6">
          {!ready ? null : (
            <>
              {view === 'main' && (
                <MainHome
                  data={data}
                  onOpenEducation={() => setView('edu-supervisor')}
                  onOpenWorkforce={() => setView('people')}
                  onOpenTbm={() => setView('tbm')}
                  onOpenNearMiss={() => setView('nearmiss')}
                />
              )}
              {view === 'ledgers' && (data ? <Ledgers data={data} /> : <NeedData onGo={() => setView('data')} />)}
              {view === 'tbm' && <TbmLog data={data} />}
              {view === 'nearmiss' && <NearMissReport />}
              {view === 'people' && <WorkforceLog data={data} />}
              {view === 'edu-supervisor' && <SupervisorSheet />}
              {view === 'edu-chemical' && <ChemicalAccess />}
              {view === 'edu-yncc' && <YnccWorkers />}
              {view === 'annual-plan' && <AnnualPlan />}
              {view === 'card' && <AccessPass />}
              {view === 'yncc-vehicle' && <YnccVehicles />}
              {view === 'risk-assess' && <RiskAssessment />}
              {view === 'search' && <SearchResults query={query} onNavigate={(v) => go(v as ViewKey)} />}
              {view === 'health-general' && <HealthCheckSheet kind="general" />}
              {view === 'health-special' && <HealthCheckSheet kind="special" />}
              {view === 'gas-meter' && <GasDetectorSheet />}
              {view === 'vehicle-service' && <VehicleCheckSheet />}
              {view === 'inventory' && <InventorySheet />}
              {view === 'safety-stock' && <SafetyStockSheet />}
              {view === 'equipment-check' && <EquipmentCheck />}
              {view === 'access' && <AccessAdmin onChanged={session.refresh} />}
              {(view === 'health-followup' || view === 'notice') && <ComingSoon label={path[path.length - 1]} />}
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

        <footer className="border-t border-slate-200 px-6 py-3 text-center text-[11px] text-slate-400">
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
