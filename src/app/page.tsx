'use client';

import { useEffect, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { loadData, saveData, clearData } from '@/lib/store';
import FileDrop from '@/components/FileDrop';
import DashboardHome from '@/components/DashboardHome';
import RiskTable from '@/components/RiskTable';
import TaskCards from '@/components/TaskCards';
import Ledgers from '@/components/Ledgers';

const ALL_TABS = ['대시보드', '위험성평가', '작업목록', '관리대장'] as const;
type Tab = (typeof ALL_TABS)[number];

export default function Page() {
  const [data, setData] = useState<SafetyData | null>(null);
  const [tab, setTab] = useState<Tab>('대시보드');
  const [ready, setReady] = useState(false);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  const onLoaded = (d: SafetyData) => {
    saveData(d);
    setData(d);
    setReplacing(false);
    setTab('대시보드');
  };

  // 관리대장(교육·점검·아차사고·일정) 데이터가 없는 양식이면 해당 탭을 숨긴다
  const tabs = ALL_TABS.filter(
    (t) =>
      t !== '관리대장' ||
      !data ||
      data.edu.length + data.insp.length + data.incidents.length + data.schedule.length > 0,
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* 헤더 */}
      <header className="bg-[#1f3864] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <h1 className="text-lg font-bold">
            {data?.meta['회사명'] || '㈜신정개발'} 안전관리 대시보드
          </h1>
          {data && (
            <span className="text-xs text-blue-200">
              {data.meta['평가연도'] && `${data.meta['평가연도']}년 · `}
              {data.fileName} · {new Date(data.loadedAt).toLocaleString('ko-KR')} 불러옴
            </span>
          )}
          {data && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setReplacing(true)}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
              >
                데이터 다시 불러오기
              </button>
              <button
                onClick={() => {
                  if (confirm('이 브라우저에 저장된 대시보드 데이터를 삭제할까요?\n(엑셀 원본 파일은 영향을 받지 않습니다)')) {
                    clearData();
                    setData(null);
                  }
                }}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
              >
                데이터 삭제
              </button>
            </div>
          )}
        </div>
        {/* 탭 */}
        {data && !replacing && (
          <nav className="mx-auto max-w-7xl px-4">
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t ? 'bg-slate-100 text-[#1f3864]' : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* 본문 */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {!ready ? null : !data || replacing ? (
          <div className="mx-auto max-w-2xl py-10">
            {replacing && (
              <button onClick={() => setReplacing(false)} className="mb-4 text-sm text-slate-500 hover:text-slate-800">
                ← 돌아가기
              </button>
            )}
            <h2 className="mb-2 text-xl font-bold text-slate-800">안전관리 데이터 불러오기</h2>
            <p className="mb-6 text-sm text-slate-500">
              안전관리 데이터 엑셀 파일(safety-data.xlsx)을 선택하면 위험성평가·교육·점검·아차사고·일정
              현황을 한눈에 보여드립니다.
            </p>
            <FileDrop onLoaded={onLoaded} />
          </div>
        ) : (
          <>
            {tab === '대시보드' && <DashboardHome data={data} />}
            {tab === '위험성평가' && <RiskTable data={data} />}
            {tab === '작업목록' && <TaskCards data={data} />}
            {tab === '관리대장' && <Ledgers data={data} />}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        데이터는 이 브라우저에서만 처리·보관되며 서버로 전송되지 않습니다.
      </footer>
    </div>
  );
}
