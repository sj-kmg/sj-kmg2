'use client';

import { useEffect, useState } from 'react';
import {
  CARDS_KEY,
  CARD_NOTICE_DAYS,
  PASS_VEHICLES_KEY,
  VEHICLE_NOTICE_DAYS,
  accessCardSeed,
  passVehicleSeed,
  type AccessCard,
  type PassVehicle,
} from '@/lib/cards';
import { NOTICE_STYLE, daysUntil, noticeLevel, type NoticeLevel } from '@/lib/education';
import { HEALTH_KEY, HEALTH_LABEL, HEALTH_NOTICE_DAYS, healthGeneralSeed, type HealthCheck } from '@/lib/health';
import { listEntriesSilently } from '@/lib/sync';

interface DueItem {
  id: string;
  name: string;
  kind: string;
  date: string;
  days: number;
  level: NoticeLevel;
}

interface NextItem {
  name: string;
  kind: string;
  date: string;
  days: number;
}

/**
 * 메인 [공무관리 현황] 패널 — 공무관리(신청현황 등)에서 D-day 관리가 필요한 항목을 모아 표시.
 * 현재: 상시카드 종료일 D-100. (검진 등은 메뉴 구성 후 추가 예정)
 */
export default function GeneralAffairsPanel() {
  const [due, setDue] = useState<DueItem[] | null>(null);
  const [next, setNext] = useState<NextItem | null>(null);

  useEffect(() => {
    void (async () => {
      const now = new Date();
      const [savedCards, savedVehicles, savedHealth] = await Promise.all([
        listEntriesSilently<AccessCard>('cards', CARDS_KEY),
        listEntriesSilently<PassVehicle>('pass-vehicles', PASS_VEHICLES_KEY),
        listEntriesSilently<HealthCheck>('health', HEALTH_KEY),
      ]);
      const healthNames = new Set(savedHealth.filter((h) => h.kind === 'general').map((h) => h.name.trim()));
      const health = [...savedHealth, ...healthGeneralSeed().filter((s) => !healthNames.has(s.name.trim()))];
      // 아직 저장 전이면 기존 신청현황(초기 데이터)을 기준으로 표시
      const cardIds = new Set(savedCards.map((c) => c.id));
      const cards = [...savedCards, ...accessCardSeed().filter((s) => !cardIds.has(s.id))];
      const plates = new Set(savedVehicles.map((v) => v.plate.trim()));
      const vehicles = [...savedVehicles, ...passVehicleSeed().filter((s) => !plates.has(s.plate.trim()))];

      const items = [
        ...cards
          .filter((c) => c.name && c.endDate)
          .map((c) => ({
            id: `card-${c.id}`,
            name: c.name,
            kind: '상시카드',
            date: c.endDate,
            days: daysUntil(c.endDate, now),
            notice: CARD_NOTICE_DAYS,
          })),
        ...vehicles
          .filter((v) => v.plate && v.endDate)
          .map((v) => ({
            id: `veh-${v.id}`,
            name: `${v.plate}${v.driver ? ` (${v.driver})` : ''}`,
            kind: '상시차량',
            date: v.endDate,
            days: daysUntil(v.endDate, now),
            notice: VEHICLE_NOTICE_DAYS,
          })),
        ...health
          .filter((h) => h.name && h.renewDate)
          .map((h) => ({
            id: `health-${h.id}`,
            name: h.name,
            kind: HEALTH_LABEL[h.kind],
            date: h.renewDate,
            days: daysUntil(h.renewDate, now),
            notice: HEALTH_NOTICE_DAYS,
          })),
      ].map((i) => ({ ...i, level: noticeLevel(i.days, i.notice) }));

      setDue(
        items
          .filter((i) => i.level !== null)
          .map((i) => ({ id: i.id, name: i.name, kind: i.kind, date: i.date, days: i.days, level: i.level! }))
          .sort((a, b) => a.days - b.days),
      );
      const upcoming = items.filter((i) => i.level === null && i.days >= 0).sort((a, b) => a.days - b.days);
      if (upcoming.length > 0) {
        const f = upcoming[0];
        setNext({ name: f.name, kind: f.kind, date: f.date, days: f.days });
      }
    })();
  }, []);

  if (!due) return null;

  if (due.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center">
          <p className="text-2xl" aria-hidden>✅</p>
          <p className="mt-1.5 text-sm font-medium text-slate-500">만료 도래 대상이 없습니다</p>
          {next && (
            <p className="mt-1 text-xs text-slate-400">
              다음 만료: <b>{next.name}</b> · {next.kind} {next.date} (D-{next.days})
            </p>
          )}
        </div>
        <Footnote />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="max-h-44 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
        {due.map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-1.5">
            <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${NOTICE_STYLE[r.level].badge}`}>
              {r.days < 0 ? `D+${-r.days}` : `D-${r.days}`}
            </span>
            <span className="shrink-0 text-xs font-semibold text-slate-700">{r.name}</span>
            <span className="min-w-0 truncate text-[11px] text-slate-500">{r.kind}</span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">{r.date}</span>
          </li>
        ))}
      </ul>
      <Footnote />
    </div>
  );
}

function Footnote() {
  return (
    <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
      상시카드 D-{CARD_NOTICE_DAYS} · 상시차량/건강검진 D-{VEHICLE_NOTICE_DAYS}부터 표시 · 공무관리 메뉴와 연동
    </p>
  );
}
