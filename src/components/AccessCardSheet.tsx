'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS_KEY, CARD_NOTICE_DAYS, accessCardSeed, cardEndDate, type AccessCard } from '@/lib/cards';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { useSortable } from '@/lib/useSortable';
import SheetExport from './SheetExport';
import type { ExportSpec } from '@/lib/sheetExport';
import { CELL, SheetToolbar, SortButton, TD_STICKY, TH, TH_STICKY } from './SheetUI';

const APPLY_TYPES: AccessCard['applyType'][] = ['신규', '연장'];

/**
 * 출입신청 › LG 상시카드&차량 — 상시카드 시트.
 * 신규·연장을 위아래 별도 표로 구분해 관리하며,
 * 출입시작일을 입력하면 종료일(시작일 + 1년 - 1일)이 자동 입력된다.
 */
export default function AccessCardSheet() {
  const seed = useMemo(() => accessCardSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<AccessCard>('cards', CARDS_KEY, {
    seed,
    isBlank: (r) => !r.name.trim(),
    sort: (a, b) => a.name.localeCompare(b.name, 'ko'),
  });

  const sortCtl = useSortable<AccessCard>();
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  const add = (applyType: AccessCard['applyType']) => {
    seq.current += 1;
    addRow({
      id: `AC-${Date.now()}-${seq.current}`,
      name: '',
      applyType,
      issueDate: '',
      endDate: '',
      loginId: '',
      password: '',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: AccessCard) => {
    if (r.name.trim() && !confirm(`[${r.name}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  const dday = (r: AccessCard) => {
    if (!r.endDate || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.endDate, today);
    const level = noticeLevel(days, CARD_NOTICE_DAYS);
    if (!level) return <span className="font-mono text-[11px] text-slate-400">D-{days}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>
        {days < 0 ? `D+${-days}` : `D-${days}`}
      </span>
    );
  };


  /** 엑셀·인쇄에 넘길 표 */
  const exportSpec = (): ExportSpec<AccessCard> => ({
    title: 'LG 상시카드 신청현황',
    columns: [
      { label: '구분', value: (r) => r.applyType, width: 8 },
      { label: '성명', value: (r) => r.name, width: 12 },
      { label: '출입시작일', value: (r) => r.issueDate, width: 12 },
      { label: '출입종료일', value: (r) => r.endDate, width: 12 },
      { label: '아이디', value: (r) => r.loginId, width: 16 },
      { label: '비고', value: (r) => r.note ?? '', align: 'left', width: 24 },
    ],
    rows: [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          💳 상시카드 신청현황
          <span className="ml-1.5 font-normal text-slate-400">{rows.length}명</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          <SheetExport spec={exportSpec} className="ml-auto" />
      </div>

      {/* 신규 · 연장 구분 표 */}
      {APPLY_TYPES.map((type) => {
        const list = sortCtl.apply(
          rows.filter((r) => r.applyType === type),
          { name: (r) => r.name, due: (r) => r.endDate },
        );
        return (
          <section key={type} className="mb-5">
            <p className="mb-1.5 flex items-center gap-1.5">
              <span aria-hidden className={`h-3 w-1 rounded-full ${type === '신규' ? 'bg-cyan-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-bold text-slate-600">{type}</span>
              <span className="text-[11px] font-normal text-slate-400">{list.length}명</span>
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[1240px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                    <th className={`${TH} ${TH_STICKY} w-36`}>성명<SortButton ctl={sortCtl} col="name" label="성명" /></th>
                    <th className={`${TH} w-40`}>출입시작일</th>
                    <th className={`${TH} w-40`}>출입종료일 (자동)</th>
                    <th className={`${TH} w-24 text-center`}>D-day<SortButton ctl={sortCtl} col="due" label="D-day" /></th>
                    <th className={`${TH} w-40`}>아이디</th>
                    <th className={`${TH} w-56`}>비밀번호</th>
                    <th className={`${TH} w-52`}>비고</th>
                    <th className={`${TH} w-24 text-center`}>구분</th>
                    <th className="w-10 px-1 py-2" aria-label="행 삭제" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-slate-300">
                        아래 ＋ 버튼으로 {type} 대상자를 추가해 주세요
                      </td>
                    </tr>
                  )}
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td className={`${TD_STICKY} px-1.5 py-1.5`}>
                        <input aria-label="성명" placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label="출입시작일"
                          type="date"
                          value={r.issueDate}
                          onChange={(e) => setRow(r.id, { issueDate: e.target.value, endDate: cardEndDate(e.target.value) })}
                          className={CELL}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="출입종료일" type="date" value={r.endDate} onChange={(e) => setRow(r.id, { endDate: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="아이디" placeholder="ID" value={r.loginId} onChange={(e) => setRow(r.id, { loginId: e.target.value })} className={CELL} autoComplete="off" />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            aria-label="비밀번호"
                            type={showPw[r.id] ? 'text' : 'password'}
                            placeholder="PW"
                            value={r.password}
                            onChange={(e) => setRow(r.id, { password: e.target.value })}
                            className={CELL}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            aria-label={showPw[r.id] ? '비밀번호 숨기기' : '비밀번호 보기'}
                            onClick={() => setShowPw((m) => ({ ...m, [r.id]: !m[r.id] }))}
                            className="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:text-[#1f3864]"
                          >
                            {showPw[r.id] ? '🙈' : '👁'}
                          </button>
                        </div>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={CELL} />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          aria-label="신청구분"
                          value={r.applyType}
                          onChange={(e) => setRow(r.id, { applyType: e.target.value as AccessCard['applyType'] })}
                          className={CELL}
                          title="변경하면 해당 구분 표로 이동합니다"
                        >
                          {APPLY_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button aria-label="행 삭제" onClick={() => del(r)} className="text-slate-300 hover:text-red-500">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => add(type)}
              className="mt-2 rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
            >
              ＋ {type} 추가
            </button>
          </section>
        );
      })}

      <div className="border-t border-slate-100 pt-3">
        <SheetToolbar addLabel="" onUndo={() => void undo()} canUndo={canUndo} save={save} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        출입시작일을 입력하면 종료일이 자동 계산됩니다 (예: 2025-09-24 → 2026-09-23). 필요하면 종료일을 직접 수정할 수
        있고, 오른쪽 [구분]을 바꾸면 해당 표로 이동합니다. 종료 {CARD_NOTICE_DAYS}일 전부터 메인 [공무관리 현황]에 D-day가
        표시됩니다.
      </p>
    </div>
  );
}
