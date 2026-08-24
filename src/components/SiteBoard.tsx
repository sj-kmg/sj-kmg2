'use client';

import { useState } from 'react';
import type { OpsData } from '@/lib/useOps';
import {
  dateLabelOf,
  datesOf,
  laborColor,
  laborCountOf,
  siteColor,
  staffNames,
  workDaysOf,
  type WorkforceEntry,
} from '@/lib/workforce';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function labelOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}

function shift(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 현장 운영 보드 — 선택한 날짜에 "어느 현장에서 / 누가 지휘하고 / 누가 몇 명 투입됐는지"를 보여 준다.
 * 메인 화면만 보고도 당일 안전관리 판단이 되도록 TBM 실시 여부까지 함께 표시한다.
 */
export default function SiteBoard({
  ops,
  date,
  onDateChange,
  onOpenWorkforce,
  onOpenTbm,
}: {
  ops: OpsData;
  date: string;
  onDateChange: (d: string) => void;
  onOpenWorkforce?: () => void;
  onOpenTbm?: () => void;
}) {
  const day = ops.dayOf(date);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      {/* 날짜 이동 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button onClick={() => onDateChange(shift(date, -1))} className="rounded px-2 py-0.5 text-slate-400 hover:text-slate-800" aria-label="이전 날">
            ‹
          </button>
          <span className="px-1 text-xs font-bold text-slate-800">{labelOf(date)}</span>
          <button onClick={() => onDateChange(shift(date, 1))} className="rounded px-2 py-0.5 text-slate-400 hover:text-slate-800" aria-label="다음 날">
            ›
          </button>
        </div>
        <span className="font-mono text-[11px] text-slate-400">{date}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Chip tone="site">현장 {day.sites.length}</Chip>
          <Chip tone="head">인원 {day.headcount}</Chip>
          <Chip tone="staff">직원 {day.staff}</Chip>
          <Chip tone="labor">인력 {day.labor}</Chip>
          {onOpenWorkforce && (
            <button onClick={onOpenWorkforce} className="ml-1 text-[11px] font-semibold text-blue-700 hover:underline">
              기록 관리 →
            </button>
          )}
        </div>
      </div>

      {day.entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="text-3xl" aria-hidden>
            🗓️
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500">이 날짜에 등록된 현장 작업이 없습니다</p>
          <p className="mt-1 text-xs text-slate-400">
            [작업인원관리]에서 현장·소장·투입 인력을 기록하면 여기에 바로 표시됩니다.
          </p>
          {onOpenWorkforce && (
            <button
              onClick={onOpenWorkforce}
              className="mt-3 rounded-lg bg-[#1f3864] px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              작업인원 기록하기
            </button>
          )}
        </div>
      ) : (
        <ul className="max-h-[26rem] flex-1 space-y-2.5 overflow-y-auto pr-1">
          {day.entries.map((e) => (
            <SiteCard
              key={e.id}
              entry={e}
              onDate={date}
              tbmDone={day.tbmSites.has(e.site)}
              open={openId === e.id}
              onToggle={() => setOpenId(openId === e.id ? null : e.id)}
              onOpenTbm={onOpenTbm}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SiteCard({
  entry: e,
  onDate,
  tbmDone,
  open,
  onToggle,
  onOpenTbm,
}: {
  entry: WorkforceEntry;
  /** 지금 보고 있는 날짜 — 여러 날짜에 걸친 기록이면 몇 일차인지 보여 준다 */
  onDate: string;
  tbmDone: boolean;
  open: boolean;
  onToggle: () => void;
  onOpenTbm?: () => void;
}) {
  const staff = staffNames(e.staff);
  const labor = e.laborRows ?? [];
  const laborN = laborCountOf(e);
  const total = staff.length + laborN;
  const color = siteColor(e.site);
  /** 여러 날에 걸친 작업이면 "3/5일차"로 표시 — 매일 따로 적은 기록이 아님을 알 수 있게 한다 */
  const spanDays = workDaysOf(e);
  const dayNo = spanDays > 1 ? datesOf(e).indexOf(onDate) + 1 : 0;
  /** 장비현황은 자유 입력이라 쉼표로 나눠 항목별로 보여 준다 */
  const equipment = (e.equipment ?? '')
    .split(/[,·/]/)
    .map((q) => q.trim())
    .filter(Boolean);

  /** 인력 구분별 인원 */
  const byCategory = labor.reduce<Record<string, number>>((acc, r) => {
    const k = r.category || '기타';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <li
      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="p-3">
        {/* 1줄: 현장 · 시간 · TBM · 총원 */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-sm font-bold text-slate-800">{e.site}</span>
          {dayNo > 0 && (
            <span
              className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500"
              title={`${dateLabelOf(e)} 연속 작업`}
            >
              {dayNo}/{spanDays}일차
            </span>
          )}
          {e.workHours && <span className="font-mono text-[11px] text-slate-400">🕐 {e.workHours}</span>}
          {tbmDone ? (
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              TBM 완료
            </span>
          ) : (
            <button
              onClick={onOpenTbm}
              className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 hover:brightness-125"
              title="TBM일지 작성으로 이동"
            >
              TBM 미실시
            </button>
          )}
          <span className="ml-auto font-mono text-sm font-bold text-slate-800">
            {total}
            <span className="ml-0.5 text-[10px] font-normal text-slate-400">명</span>
          </span>
        </div>

        {/* 2줄: 현장소장 · 직원 — 안전관리 책임 라인 */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400">현장소장</span>
            {e.manager ? (
              <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                {e.manager}
              </span>
            ) : (
              <span className="text-xs text-red-600">미지정</span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[10px] font-semibold text-slate-400">직원 {staff.length}</span>
            <span className="flex flex-wrap gap-1">
              {staff.length > 0 ? (
                staff.map((n) => (
                  <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {n}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-slate-400">-</span>
              )}
            </span>
          </span>
        </div>

        {/* 3줄: 작업내용 */}
        {e.work && (
          <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">{e.work}</p>
        )}

        {/* 4줄: 인력 구성 */}
        {laborN > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400">인력 {laborN}</span>
            {Object.entries(byCategory).map(([cat, n]) => (
              <span
                key={cat}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: `${laborColor(cat)}22`, color: laborColor(cat) }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: laborColor(cat) }} />
                {cat.replace('인력', '')} {n}
              </span>
            ))}
            <button onClick={onToggle} className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-slate-700">
              명단 {open ? '접기 ▲' : '보기 ▼'}
            </button>
          </div>
        )}

        {/* 인력 명단 */}
        {open && labor.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-400">
                  <th className="px-2 py-1 text-center font-semibold">No</th>
                  <th className="px-2 py-1 font-semibold">구분</th>
                  <th className="px-2 py-1 font-semibold">이름</th>
                  <th className="px-2 py-1 font-semibold">작업구분</th>
                  <th className="px-2 py-1 font-semibold">시간</th>
                </tr>
              </thead>
              <tbody>
                {labor.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 text-slate-600">
                    <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: laborColor(r.category) }} />
                        {r.category || '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1 font-semibold text-slate-700">{r.name || '-'}</td>
                    <td className="px-2 py-1">{r.workType || '-'}</td>
                    <td className="px-2 py-1 font-mono">{r.hours || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 장비 — 현장별 투입 장비를 인원과 같은 비중으로 보여 준다 */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          <span className="text-[10px] font-semibold text-slate-400">장비</span>
          {equipment.length > 0 ? (
            equipment.map((q, i) => (
              <span
                key={`${q}-${i}`}
                className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
              >
                <span aria-hidden>🚜</span>
                {q}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-400">투입 장비 없음</span>
          )}
        </div>
      </div>
    </li>
  );
}

const CHIP_TONE = {
  site: 'bg-blue-500/15 text-blue-700',
  head: 'bg-cyan-500/15 text-cyan-700',
  staff: 'bg-slate-100 text-slate-600',
  labor: 'bg-violet-500/15 text-violet-700',
} as const;

function Chip({ tone, children }: { tone: keyof typeof CHIP_TONE; children: React.ReactNode }) {
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${CHIP_TONE[tone]}`}>{children}</span>;
}
