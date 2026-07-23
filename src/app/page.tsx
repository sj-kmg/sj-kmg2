'use client';

import { useEffect, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { loadData, saveData, clearData } from '@/lib/store';
import FileDrop from '@/components/FileDrop';
import MainHome from '@/components/MainHome';
import DashboardHome from '@/components/DashboardHome';
import RiskTable from '@/components/RiskTable';
import TaskCards from '@/components/TaskCards';
import Ledgers from '@/components/Ledgers';
import TbmLog from '@/components/TbmLog';

type ViewKey =
  | 'main'
  | 'summary'
  | 'risk'
  | 'tasks'
  | 'ledgers'
  | 'tbm'
  | 'notice'
  | 'board'
  | 'people'
  | 'data';

interface MenuItem {
  key: ViewKey;
  label: string;
  icon: string;
  /** 데이터가 있어야 내용이 표시되는 메뉴 */
  needsData?: boolean;
  /** 추후 구성 예정 메뉴 */
  wip?: boolean;
}

const MENU: MenuItem[] = [
  { key: 'main', label: '메인', icon: '🏠' },
  { key: 'summary', label: '위험성 현황', icon: '📊', needsData: true },
  { key: 'risk', label: '위험성평가', icon: '🛡️', needsData: true },
  { key: 'tasks', label: '작업목록', icon: '📋', needsData: true },
  { key: 'ledgers', label: '관리대장', icon: '📚', needsData: true },
  { key: 'tbm', label: 'TBM일지', icon: '📣' },
  { key: 'notice', label: '공지사항', icon: '📢', wip: true },
  { key: 'board', label: '작업게시판', icon: '📝', wip: true },
  { key: 'people', label: '작업인원관리', icon: '👷', wip: true },
  { key: 'data', label: '데이터 관리', icon: '💾' },
];

export default function Page() {
  const [data, setData] = useState<SafetyData | null>(null);
  const [view, setView] = useState<ViewKey>('main');
  const [ready, setReady] = useState(false);

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

  const MenuButton = ({ m, mobile = false }: { m: MenuItem; mobile?: boolean }) => {
    const active = view === m.key;
    return (
      <button
        onClick={() => setView(m.key)}
        className={
          mobile
            ? `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? 'bg-[#1f3864] text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`
            : `flex w-full items-center gap-3 border-l-4 px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                active
                  ? 'border-sky-300 bg-white/15 text-white'
                  : 'border-transparent text-blue-100 hover:bg-white/10 hover:text-white'
              }`
        }
      >
        <span aria-hidden>{m.icon}</span>
        <span>{m.label}</span>
        {m.wip && <span className={`ml-auto text-[10px] ${mobile ? 'text-slate-400' : 'text-blue-300'}`}>예정</span>}
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
        <nav className="flex-1 py-3">
          {menu.map((m) => (
            <MenuButton key={m.key} m={m} />
          ))}
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
            <h1 className="text-base font-bold text-[#1f3864] md:text-lg">
              {menu.find((m) => m.key === view)?.label ?? '메인'}
            </h1>
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
            {menu.map((m) => (
              <MenuButton key={m.key} m={m} mobile />
            ))}
          </nav>
        </header>

        {/* 본문 */}
        <main className="flex-1 p-4 lg:p-6">
          {!ready ? null : (
            <>
              {view === 'main' && <MainHome data={data} />}
              {view === 'summary' && (data ? <DashboardHome data={data} /> : <NeedData onGo={() => setView('data')} />)}
              {view === 'risk' && (data ? <RiskTable data={data} /> : <NeedData onGo={() => setView('data')} />)}
              {view === 'tasks' && (data ? <TaskCards data={data} /> : <NeedData onGo={() => setView('data')} />)}
              {view === 'ledgers' && (data ? <Ledgers data={data} /> : <NeedData onGo={() => setView('data')} />)}
              {view === 'tbm' && <TbmLog data={data} />}
              {(view === 'notice' || view === 'board' || view === 'people') && (
                <ComingSoon label={menu.find((m) => m.key === view)?.label ?? ''} />
              )}
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
