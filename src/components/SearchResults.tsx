'use client';

import { useEffect, useState } from 'react';
import { CARDS_KEY, PASS_VEHICLES_KEY, type AccessCard, type PassVehicle } from '@/lib/cards';
import { EDU_COURSES } from '@/lib/education';
import { listEntriesSilently } from '@/lib/sync';
import {
  CHEM_WORKERS_KEY,
  YNCC_VEHICLES_KEY,
  YNCC_WORKERS_KEY,
  type EduSheetWorker,
  type YnccVehicle,
} from '@/lib/yncc';

interface SearchItem {
  title: string;
  sub?: string;
  view: string;
}

interface SearchGroup {
  menu: string;
  view: string;
  items: SearchItem[];
}

interface RiskEntryLite {
  id: string;
  company?: string;
  workName?: string;
  assessor?: string;
  rows?: { step?: string; hazard?: string; action?: string }[];
}

interface NearMissLite {
  id: string;
  datetime?: string;
  place?: string;
  finder?: string;
  content?: string;
  action?: string;
}

/** 검색 대상 메뉴 바로가기 정의 */
const MENU_INDEX: { label: string; path: string; view: string; keywords: string }[] = [
  { label: '메인', path: '메인', view: 'main', keywords: '대시보드 홈' },
  { label: 'TBM일지', path: '안전관리 › TBM일지', view: 'tbm', keywords: 'tbm 회의' },
  { label: '아차사고', path: '안전관리 › 아차사고', view: 'nearmiss', keywords: '사고 신고' },
  { label: '일반검진', path: '공무관리 › 건강검진 › 일반검진', view: 'health-general-staff', keywords: '건강검진' },
  { label: '특수검진', path: '공무관리 › 건강검진 › 특수검진', view: 'health-special-staff', keywords: '건강검진' },
  { label: '유소견자 관리', path: '공무관리 › 건강검진 › 유소견자 관리', view: 'health-followup', keywords: '건강검진' },
  { label: '관리감독자', path: '공무관리 › 안전교육 › 관리감독자', view: 'edu-supervisor', keywords: '교육 수료증' },
  { label: '유해화학물질', path: '공무관리 › 안전교육 › 유해화학물질', view: 'edu-chemical', keywords: '교육 화학' },
  { label: 'YNCC출입', path: '공무관리 › 안전교육 › YNCC출입', view: 'edu-yncc', keywords: '교육 출입' },
  { label: '상시카드&차량', path: '공무관리 › 신청현황 › 상시카드&차량', view: 'card', keywords: '카드 출입증 상시차량' },
  { label: 'YNCC차량', path: '공무관리 › 신청현황 › YNCC차량', view: 'yncc-vehicle', keywords: '차량 등록' },
  { label: '산소&가스측정기', path: '공무관리 › 신청현황 › 산소&가스측정기', view: 'gas-meter', keywords: '측정기 가스' },
  { label: '위험성평가', path: '위험성평가', view: 'risk-assess', keywords: '위험 평가 빈도 강도' },
  { label: '작업인원관리', path: '작업인원관리', view: 'people', keywords: '인원 출력' },
  { label: '공지사항', path: '공지사항', view: 'notice', keywords: '공지' },
];

/** 전역 검색 — 이름·키워드를 메뉴별로 구분해 보여준다 */
export default function SearchResults({
  query,
  onNavigate,
}: {
  query: string;
  onNavigate: (view: string) => void;
}) {
  const [groups, setGroups] = useState<SearchGroup[] | null>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setGroups([]);
      return;
    }
    const hit = (s?: string) => !!s && s.toLowerCase().includes(q);

    void (async () => {
      const out: SearchGroup[] = [];
      const push = (menu: string, view: string, item: SearchItem) => {
        let g = out.find((x) => x.menu === menu);
        if (!g) {
          g = { menu, view, items: [] };
          out.push(g);
        }
        g.items.push(item);
      };

      // 1) 메뉴 바로가기
      for (const m of MENU_INDEX) {
        if (hit(m.label) || hit(m.keywords)) {
          push('메뉴 바로가기', m.view, { title: m.label, sub: m.path, view: m.view });
        }
      }

      // 2) 안전교육 정적 명부 (관리감독자·유해화학물질 수료증)
      for (const course of EDU_COURSES) {
        for (const r of course.records) {
          if (hit(r.name) || hit(r.certNo) || hit(r.offline?.certNo) || hit(r.online?.certNo)) {
            const view = course.key === 'supervisor' ? 'edu-supervisor' : 'edu-chemical';
            push(`공무관리 › 안전교육 › ${course.label}`, view, {
              title: r.name,
              sub: `이수 ${r.completedAt}${r.position ? ` · ${r.position}` : ''}`,
              view,
            });
          }
        }
      }

      // 3) 입력 시트 (유해화학물질·YNCC 직원/인력)
      const [chemWs, ynccWs, cards, vehicles, risks, nearmiss] = await Promise.all([
        listEntriesSilently<EduSheetWorker>('chem-workers', CHEM_WORKERS_KEY),
        listEntriesSilently<EduSheetWorker>('yncc-workers', YNCC_WORKERS_KEY),
        listEntriesSilently<AccessCard>('cards', CARDS_KEY),
        listEntriesSilently<YnccVehicle>('yncc-vehicles', YNCC_VEHICLES_KEY),
        listEntriesSilently<RiskEntryLite>('risk', 'sj-risk:v1'),
        listEntriesSilently<NearMissLite>('nearmiss', 'sj-nearmiss:v1'),
      ]);

      for (const w of chemWs) {
        if (hit(w.name) || hit(w.birth)) {
          const view = w.group === '직원' ? 'edu-chemical' : 'edu-chemical';
          push('공무관리 › 안전교육 › 유해화학물질', view, {
            title: w.name,
            sub: `${w.group}${w.offlineDate ? ` · 집체 ${w.offlineDate}` : ''}${w.onlineDate ? ` · 온라인 ${w.onlineDate}` : ''}`,
            view,
          });
        }
      }
      for (const w of ynccWs) {
        if (hit(w.name) || hit(w.birth)) {
          const view = w.group === '직원' ? 'edu-yncc' : 'edu-yncc';
          push('공무관리 › 안전교육 › YNCC출입', view, {
            title: w.name,
            sub: `${w.group}${w.eduExpire ? ` · 유효종료 ${w.eduExpire}` : ''}`,
            view,
          });
        }
      }
      for (const v of await listEntriesSilently<PassVehicle>('pass-vehicles', PASS_VEHICLES_KEY)) {
        if (hit(v.plate) || hit(v.driver)) {
          push('공무관리 › 신청현황 › 상시차량', 'card', {
            title: v.plate,
            sub: `${v.kind} · ${v.driver}${v.endDate ? ` · 종료 ${v.endDate}` : ''}`,
            view: 'card',
          });
        }
      }
      for (const c of cards) {
        if (hit(c.name) || hit(c.loginId)) {
          push('공무관리 › 신청현황 › 상시카드', 'card', {
            title: c.name,
            sub: `${c.applyType}${c.endDate ? ` · 종료 ${c.endDate}` : ''}`,
            view: 'card',
          });
        }
      }
      for (const v of vehicles) {
        if (hit(v.plate) || hit(v.registrant)) {
          push('공무관리 › 신청현황 › YNCC차량', 'yncc-vehicle', {
            title: v.plate,
            sub: `등록자 ${v.registrant} · ${v.regDate}`,
            view: 'yncc-vehicle',
          });
        }
      }
      for (const r of risks) {
        const rowHit = (r.rows ?? []).some((x) => hit(x.step) || hit(x.hazard) || hit(x.action));
        if (hit(r.company) || hit(r.workName) || hit(r.assessor) || rowHit) {
          push('위험성평가', 'risk-assess', {
            title: `${r.company || '업체 미기재'} — ${r.workName || '공사명 미기재'}`,
            sub: r.assessor ? `평가자 ${r.assessor}` : undefined,
            view: 'risk-assess',
          });
        }
      }
      for (const n of nearmiss) {
        if (hit(n.place) || hit(n.finder) || hit(n.content) || hit(n.action)) {
          push('안전관리 › 아차사고', 'nearmiss', {
            title: n.content ? n.content.slice(0, 40) : '아차사고 기록',
            sub: `${n.datetime?.replace('T', ' ') ?? ''}${n.place ? ` · ${n.place}` : ''}`,
            view: 'nearmiss',
          });
        }
      }

      setGroups(out);
    })();
  }, [query]);

  if (!query.trim()) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-4xl">🔍</p>
        <p className="mt-3 font-semibold text-slate-700">검색어를 입력해 주세요</p>
        <p className="mt-1 text-sm text-slate-500">이름·차량번호·업체명·키워드로 전체 메뉴를 검색합니다.</p>
      </div>
    );
  }

  if (!groups) {
    return <p className="py-16 text-center text-sm text-slate-400">검색 중…</p>;
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  if (total === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-4xl">🛰️</p>
        <p className="mt-3 font-semibold text-slate-700">&ldquo;{query}&rdquo; 검색 결과가 없습니다</p>
        <p className="mt-1 text-sm text-slate-500">이름·차량번호·업체명·메뉴명 등으로 다시 검색해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <p className="text-sm text-slate-500">
        &ldquo;<b className="text-slate-700">{query}</b>&rdquo; 검색 결과 <b className="text-sky-600">{total}</b>건 ·{' '}
        {groups.length}개 메뉴
      </p>
      {groups.map((g) => (
        <section key={g.menu} className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 px-4 py-2.5">
            <span
              aria-hidden
              className="h-3.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-cyan-300 to-blue-600 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            />
            <h3 className="text-sm font-bold text-slate-700">{g.menu}</h3>
            <span className="font-mono text-[10px] text-cyan-500/60">{g.items.length}</span>
            <button
              onClick={() => onNavigate(g.view)}
              className="ml-auto text-[11px] font-medium text-sky-600 hover:underline"
            >
              메뉴 열기 →
            </button>
          </header>
          <ul className="divide-y divide-slate-100 border-t border-slate-100 px-4">
            {g.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{it.title}</p>
                  {it.sub && <p className="truncate text-[11px] text-slate-500">{it.sub}</p>}
                </div>
                <button
                  onClick={() => onNavigate(it.view)}
                  className="ml-auto shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
                >
                  이동
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
