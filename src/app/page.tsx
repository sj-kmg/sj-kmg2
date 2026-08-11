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
  | 'data'
  | 'search';

/** 다단계 메뉴 노드 — 대분류(중분류(소분류…)) */
interface MenuNode {
  key?: ViewKey;
  label: string;
  icon?: string;
  wip?: boolean;
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
  { key: 'risk-assess', label: '위험성평가', icon: '📝' },
  { key: 'people', label: '작업인원관리', icon: '👷' },
  { key: 'notice', label: '공지사항', icon: '📢', wip: true },
];

/** 현장 계정용 메뉴 — TBM일지·아차사고만 남긴다 */
function fieldMenu(nodes: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = [];
  for (const n of nodes) {
    if (n.children) {
      const kids = fieldMenu(n.children);
      if (kids.length) out.push({ ...n, children: kids });
    } else if (n.key && FIELD_VIEWS.includes(n.key)) {
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

/** 뷰의 전체 경로 라벨 (예: 공무관리 — 안전교육 — 유해화학물질 — 직원) */
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

/** 모든 말단(leaf) 노드 — 모바일 칩 메뉴용 */
function leaves(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((n) => (n.children ? leaves(n.children) : [n]));
}

/* 메뉴 컴포넌트는 모듈 레벨로 정의 — Page 리렌더(시계 등)에도 펼침 상태가 유지된다 */

/** 드롭다운 내부 노드 (중분류/소분류 아코디언) */
function DropNode({
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
  const active = node.key ? view === node.key : false;
  if (!node.children) {
    return (
      <button
        onClick={() => node.key && go(node.key)}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        className={`flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm ${
          active ? 'bg-cyan-500/10 font-semibold text-cyan-700' : 'text-slate-600 hover:bg-cyan-500/8 hover:text-cyan-700'
        }`}
      >
        {node.label}
        {node.wip && <span className="ml-auto text-[9px] text-slate-400">예정</span>}
      </button>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        className={`flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm font-bold ${
          containsActive ? 'text-cyan-700' : 'text-slate-700 hover:bg-cyan-500/8 hover:text-cyan-700'
        }`}
      >
        {node.label}
        <span aria-hidden className="ml-auto text-[9px] text-cyan-600/70">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open &&
        node.children.map((c) => <DropNode key={c.key ?? c.label} node={c} depth={depth + 1} view={view} go={go} />)}
    </div>
  );
}

/** 상단 메뉴 항목 (단일) */
function TopItem({ node, view, go }: { node: MenuNode; view: ViewKey; go: (k: ViewKey) => void }) {
  const active = node.key ? view === node.key : false;
  return (
    <button onClick={() => node.key && go(node.key)} className={`nav-item ${active ? 'nav-item--on' : ''}`}>
      {node.icon && (
        <span aria-hidden className="mr-1 text-xs">
          {node.icon}
        </span>
      )}
      {node.label}
      {node.wip && <span className="ml-1 align-middle text-[9px] text-slate-400">예정</span>}
    </button>
  );
}

/** 상단 메뉴 그룹(대분류 드롭다운) */
function TopGroup({
  node,
  view,
  openMenu,
  setOpenMenu,
  go,
}: {
  node: MenuNode;
  view: ViewKey;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  go: (k: ViewKey) => void;
}) {
  const open = openMenu === node.label;
  const activeChild = hasView(node, view);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpenMenu(open ? null : node.label)}
        className={`nav-item ${activeChild ? 'nav-item--on' : open ? 'bg-cyan-500/10 text-cyan-700' : ''}`}
      >
        <span aria-hidden className="mr-1 text-xs">
          {node.icon}
        </span>
        {node.label}
        <span aria-hidden className="ml-1 text-[9px] text-cyan-400/70">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-[70vh] min-w-52 overflow-y-auto rounded-xl border border-cyan-500/25 bg-white/97 p-1 shadow-[0_16px_40px_rgba(15,30,58,0.16),0_0_22px_rgba(34,211,238,0.12)] backdrop-blur-md">
          {(node.children ?? []).map((c) => (
            <DropNode key={c.key ?? c.label} node={c} depth={0} view={view} go={go} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 모바일 메뉴 칩 */
function MobileChip({ node, view, go }: { node: MenuNode; view: ViewKey; go: (k: ViewKey) => void }) {
  const active = node.key ? view === node.key : false;
  return (
    <button
      onClick={() => node.key && go(node.key)}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
        active
          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_14px_rgba(34,211,238,0.35)]'
          : 'border border-cyan-500/20 bg-white/80 text-slate-600'
      }`}
    >
      {node.label}
    </button>
  );
}

export default function Page() {
  const [data, setData] = useState<SafetyData | null>(null);
  const [view, setView] = useState<ViewKey>('main');
  const { role } = useRole();
  /** 현장 계정이면 쓸 수 있는 화면만 보여 준다 */
  const isField = role === 'field';
  const [ready, setReady] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setData(loadData());
    setReady(true);
    // 앱 아이콘 바로가기(?view=tbm 등)로 열었을 때 해당 화면부터 보여 준다
    const wanted = new URLSearchParams(window.location.search).get('view');
    if (wanted && leaves(MENU).some((n) => n.key === wanted)) {
      setView(wanted as ViewKey);
    }
  }, []);

  // 현장 계정이 쓸 수 없는 화면에 있으면 TBM일지로 돌려보낸다
  useEffect(() => {
    if (isField && !FIELD_VIEWS.includes(view)) setView('tbm');
  }, [isField, view]);

  // 드롭다운 밖 클릭 시 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // 헤더 라이브 시계 (HUD)
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
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
  // 현장 계정은 TBM일지·아차사고만
  const menu: MenuNode[] = isField ? fieldMenu(fullMenu) : fullMenu;

  const go = (key: ViewKey) => {
    setView(key);
    setOpenMenu(null);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setQuery(q);
    setView('search');
    setOpenMenu(null);
  };

  const viewLabel = (v: ViewKey): string => {
    if (v === 'data') return '데이터 관리';
    if (v === 'ledgers') return '안전관리 — 관리대장';
    if (v === 'search') return `검색`;
    return findPath(menu, v)?.join(' — ') ?? '메인';
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* 상단 내비게이션 */}
      <header className="topbar sticky top-0 z-40 border-b border-cyan-500/20 bg-white/85 backdrop-blur-md">
        <div className="flex items-center gap-4 px-4 py-2.5 lg:px-6">
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
                <span className="block bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-base font-black leading-tight tracking-tight text-transparent">
                  ㈜신정개발
                </span>
                <span className="block text-[9px] font-bold tracking-[0.28em] text-cyan-600/90">
                  SMART SAFETY PLATFORM
                </span>
              </span>
            </span>
          </button>

          {/* 데스크톱 메뉴 */}
          <nav ref={navRef} className="hidden min-w-0 flex-1 flex-wrap items-center gap-0.5 md:flex">
            {menu.map((m) =>
              m.children ? (
                <TopGroup key={m.label} node={m} view={view} openMenu={openMenu} setOpenMenu={setOpenMenu} go={go} />
              ) : (
                <TopItem key={m.key} node={m} view={view} go={go} />
              ),
            )}
          </nav>

          {clock && (
            <span
              aria-hidden
              className="ml-auto hidden shrink-0 font-mono text-sm font-bold tracking-[0.12em] text-cyan-700 xl:block"
            >
              {clock}
            </span>
          )}
          <button
            onClick={() => go('data')}
            className="ml-auto shrink-0 rounded-lg bg-[#1f3864] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a4a80] xl:ml-0"
          >
            💾 <span className="hidden lg:inline">데이터 관리</span>
          </button>

          {/* 전역 검색 — 상단 제일 오른쪽 */}
          <form onSubmit={submitSearch} className="relative hidden shrink-0 md:block">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="전체 검색"
              aria-label="전체 검색"
              className="w-32 rounded-lg border border-cyan-500/25 bg-white/90 py-1.5 pl-3 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500/70 focus:outline-none focus:shadow-[0_0_14px_rgba(34,211,238,0.2)] lg:w-44"
            />
            <button type="submit" aria-label="검색" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600">
              🔍
            </button>
          </form>
        </div>

        {/* 모바일: 검색 + 메뉴 칩 */}
        <div className="px-4 pb-2.5 md:hidden">
          <form onSubmit={submitSearch} className="relative mb-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="이름·차량번호·키워드 전체 검색"
              aria-label="전체 검색"
              className="w-full rounded-lg border border-cyan-500/25 bg-white/90 py-1.5 pl-3 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500/70 focus:outline-none"
            />
            <button type="submit" aria-label="검색" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </button>
          </form>
          <nav className="flex gap-2 overflow-x-auto">
            {leaves(menu).map((n) => (
              <MobileChip key={n.key} node={n} view={view} go={go} />
            ))}
          </nav>
        </div>
      </header>

      {/* 본문 — 메뉴 전환 시 view-enter 애니메이션 */}
      <main key={view === 'search' ? `search-${query}` : view} className="view-enter flex-1 p-4 lg:p-6">
        {/* 페이지 타이틀 */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h1 className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 md:text-xl">
            <span
              aria-hidden
              className="h-5 w-1.5 rounded-full bg-gradient-to-b from-cyan-300 to-blue-600 shadow-[0_0_12px_rgba(34,211,238,0.9)]"
            />
            {view === 'search' ? (
              <>
                검색 <span className="text-base font-medium text-cyan-300">&ldquo;{query}&rdquo;</span>
              </>
            ) : (
              viewLabel(view)
            )}
          </h1>
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
            {view === 'main' && (
              <MainHome data={data} onOpenEducation={() => setView('edu-supervisor')} />
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
            {(view === 'health-followup' || view === 'notice') && <ComingSoon label={viewLabel(view)} />}
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
