'use client';

import { useMemo, useRef, useState } from 'react';
import {
  FITNESS_CODES,
  FITNESS_LABEL,
  HEALTH_FOLLOWUP_KEY,
  HEALTH_GRADE_CODES,
  HEALTH_GRADE_LABEL,
  healthFollowupSeed,
  lastCounselDate,
  type CounselEntry,
  type FollowupWorker,
} from '@/lib/healthFollowup';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { CELL } from './SheetUI';

const EMPTY: Omit<FollowupWorker, 'id' | 'updatedAt'> = {
  name: '',
  dept: '',
  birth: '',
  findings: '',
  grade: '',
  action: '',
  fitness: '나',
  drinking: false,
  smoking: false,
  meds: '',
  retestDate: '',
  note: '',
  counsels: [],
};

/**
 * 공무관리 › 건강검진 › 유소견자 관리 — 검진소견·사후관리·상담이력을 사람별 카드로 관리한다.
 * 매월 초 유소견자 상담일지 작성(공무연간계획 연동)에 맞춰, 상담일자를 새로 추가하면
 * 최근 상담일자가 자동으로 갱신된다.
 */
export default function HealthFollowup() {
  const seed = useMemo(() => healthFollowupSeed(), []);
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<FollowupWorker>(
    'health-followup',
    HEALTH_FOLLOWUP_KEY,
    {
      seed,
      isBlank: (r) => !r.name.trim(),
      sort: (a, b) => a.name.localeCompare(b.name, 'ko'),
    },
  );

  const [open, setOpen] = useState<string | null>(null);
  const seq = useRef(0);

  const add = () => {
    seq.current += 1;
    const id = `HF-${Date.now()}-${seq.current}`;
    addRow({ id, ...EMPTY, updatedAt: '' });
    setOpen(id);
  };

  const del = (r: FollowupWorker) => {
    if (r.name.trim() && !confirm(`[${r.name}] 유소견자 기록을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  const addCounsel = (r: FollowupWorker) => {
    const today = new Date();
    const p = (n: number) => (n < 10 ? `0${n}` : String(n));
    const entry: CounselEntry = {
      date: `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`,
      status: '',
      note: '',
    };
    setRow(r.id, { counsels: [...r.counsels, entry] });
  };

  const setCounsel = (r: FollowupWorker, i: number, patch: Partial<CounselEntry>) => {
    setRow(r.id, { counsels: r.counsels.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  };

  const removeCounsel = (r: FollowupWorker, i: number) => {
    setRow(r.id, { counsels: r.counsels.filter((_, j) => j !== i) });
  };

  const badge = saveBadge(status, mode);
  const label = 'mb-1 block text-[11px] font-semibold text-slate-500';

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          🩺 유소견자·요관찰자 사후관리
          <span className="ml-1.5 font-normal text-slate-400">{rows.length}명</span>
        </h3>
        {badge && <span className={`text-xs ${badge.className}`}>{badge.text}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void undo()}
            disabled={!canUndo}
            title="직전 변경을 취소합니다 (삭제한 사람도 되살아납니다)"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864] disabled:opacity-40"
          >
            ↩ 되돌리기
          </button>
          <button
            onClick={add}
            className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            ＋ 유소견자 추가
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
          {mode === 'loading' ? '기록을 불러오는 중…' : '등록된 유소견자·요관찰자가 없습니다. [＋ 유소견자 추가]로 등록해 주세요.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOpen = open === r.id;
            const last = lastCounselDate(r);
            return (
              <article key={r.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {/* 요약 헤더 — 누르면 펼침 */}
                <button
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-bold text-slate-800">{r.name || '(이름 없음)'}</span>
                  {r.dept && <span className="text-xs text-slate-400">{r.dept}</span>}
                  {r.birth && <span className="font-mono text-[11px] text-slate-400">{r.birth}</span>}
                  {r.grade && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      {r.grade}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{r.findings}</span>
                  {last && <span className="shrink-0 text-[11px] text-slate-400">최근 상담 {last}</span>}
                  <span aria-hidden className="shrink-0 text-[10px] text-slate-400">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className={label} htmlFor={`hf-name-${r.id}`}>성명</label>
                        <input id={`hf-name-${r.id}`} placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                      </div>
                      <div>
                        <label className={label} htmlFor={`hf-dept-${r.id}`}>부서명</label>
                        <input id={`hf-dept-${r.id}`} placeholder="예: SAP팀" value={r.dept ?? ''} onChange={(e) => setRow(r.id, { dept: e.target.value })} className={CELL} />
                      </div>
                      <div>
                        <label className={label} htmlFor={`hf-birth-${r.id}`}>생년월일</label>
                        <input id={`hf-birth-${r.id}`} type="date" value={r.birth ?? ''} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={CELL} />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className={label} htmlFor={`hf-findings-${r.id}`}>검진소견 (Check Point)</label>
                        <input
                          id={`hf-findings-${r.id}`}
                          placeholder="예: 고혈압"
                          value={r.findings}
                          onChange={(e) => setRow(r.id, { findings: e.target.value })}
                          className={CELL}
                        />
                      </div>

                      <div>
                        <label className={label} htmlFor={`hf-grade-${r.id}`}>건강구분</label>
                        <input
                          id={`hf-grade-${r.id}`}
                          list={`hf-grade-list-${r.id}`}
                          placeholder="예: C2, D2"
                          value={r.grade}
                          onChange={(e) => setRow(r.id, { grade: e.target.value })}
                          className={`${CELL} font-mono font-semibold`}
                          title={HEALTH_GRADE_CODES.map((c) => HEALTH_GRADE_LABEL[c]).join('\n')}
                        />
                        <datalist id={`hf-grade-list-${r.id}`}>
                          {HEALTH_GRADE_CODES.map((c) => (
                            <option key={c} value={c}>{HEALTH_GRADE_LABEL[c]}</option>
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className={label} htmlFor={`hf-fitness-${r.id}`}>업무수행적합여부</label>
                        <select
                          id={`hf-fitness-${r.id}`}
                          value={r.fitness}
                          onChange={(e) => setRow(r.id, { fitness: e.target.value })}
                          className={CELL}
                        >
                          {FITNESS_CODES.map((c) => (
                            <option key={c} value={c}>{FITNESS_LABEL[c]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={label} htmlFor={`hf-retest-${r.id}`}>재검일자</label>
                        <input id={`hf-retest-${r.id}`} type="date" value={r.retestDate ?? ''} onChange={(e) => setRow(r.id, { retestDate: e.target.value })} className={CELL} />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className={label} htmlFor={`hf-action-${r.id}`}>사후관리 및 상담내용</label>
                        <input
                          id={`hf-action-${r.id}`}
                          placeholder="예: 근무중 치료, 건강상담"
                          value={r.action}
                          onChange={(e) => setRow(r.id, { action: e.target.value })}
                          className={CELL}
                        />
                      </div>

                      <div className="flex items-end gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={!!r.drinking} onChange={(e) => setRow(r.id, { drinking: e.target.checked })} className="h-3.5 w-3.5 accent-[#1f3864]" />
                          음주
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={!!r.smoking} onChange={(e) => setRow(r.id, { smoking: e.target.checked })} className="h-3.5 w-3.5 accent-[#1f3864]" />
                          흡연
                        </label>
                      </div>
                      <div>
                        <label className={label} htmlFor={`hf-meds-${r.id}`}>복용중인 약</label>
                        <input id={`hf-meds-${r.id}`} placeholder="예: 혈압, 당뇨" value={r.meds ?? ''} onChange={(e) => setRow(r.id, { meds: e.target.value })} className={CELL} />
                      </div>
                      <div>
                        <label className={label} htmlFor={`hf-note-${r.id}`}>비고</label>
                        <input id={`hf-note-${r.id}`} value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={CELL} />
                      </div>
                    </div>

                    {/* 상담이력 */}
                    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-600">상담이력</p>
                        <button
                          onClick={() => addCounsel(r)}
                          className="ml-auto rounded-md border border-[#1f3864] px-2 py-1 text-[11px] font-bold text-[#1f3864] hover:bg-[#1f3864] hover:text-white"
                        >
                          ＋ 상담 기록 추가
                        </button>
                      </div>
                      {r.counsels.length === 0 ? (
                        <p className="py-3 text-center text-xs text-slate-400">등록된 상담 기록이 없습니다.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {[...r.counsels]
                            .map((c, i) => ({ c, i }))
                            .sort((a, b) => b.c.date.localeCompare(a.c.date))
                            .map(({ c, i }) => (
                              <div key={i} className="grid grid-cols-[8rem_1fr_1fr_1.5rem] items-center gap-1.5">
                                <input
                                  aria-label="상담일자"
                                  type="date"
                                  value={c.date}
                                  onChange={(e) => setCounsel(r, i, { date: e.target.value })}
                                  className={`${CELL} font-mono`}
                                />
                                <input
                                  aria-label="건강상태"
                                  placeholder="예: 현재 건강상태 : 양호"
                                  value={c.status}
                                  onChange={(e) => setCounsel(r, i, { status: e.target.value })}
                                  className={CELL}
                                />
                                <input
                                  aria-label="비고"
                                  placeholder="비고 (예: 운동 권유)"
                                  value={c.note ?? ''}
                                  onChange={(e) => setCounsel(r, i, { note: e.target.value })}
                                  className={CELL}
                                />
                                <button
                                  onClick={() => removeCounsel(r, i)}
                                  aria-label="상담 기록 삭제"
                                  className="text-center text-slate-300 hover:text-red-500"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button onClick={() => del(r)} className="text-xs text-slate-300 hover:text-red-500">
                        이 유소견자 기록 삭제
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        건강구분(A·C1·C2·D1·D2·R)·업무수행적합여부(가·나·다·라) 코드는 칸에 마우스를 올리면 전체 설명이 보입니다.
        매월 초 상담이력을 갱신하면 최근 상담일자가 자동으로 표시됩니다.
      </p>
    </div>
  );
}
