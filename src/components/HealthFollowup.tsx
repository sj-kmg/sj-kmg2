'use client';

import { useMemo, useRef, useState } from 'react';
import {
  FITNESS_CODES,
  FITNESS_LABEL,
  HEALTH_FOLLOWUP_KEY,
  HEALTH_GRADE_CODES,
  HEALTH_GRADE_LABEL,
  HEALTH_GRADE_TONE,
  healthFollowupSeed,
  lastCounselDate,
  primaryGrade,
  type CounselEntry,
  type FollowupWorker,
} from '@/lib/healthFollowup';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import BodyDiagram from './BodyDiagram';
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
            const gradeCodes = r.grade.split(',').map((s) => s.trim()).filter(Boolean);
            const accent = HEALTH_GRADE_TONE[primaryGrade(r.grade) ?? '']?.bar ?? '#cbd5e1';
            return (
              <article
                key={r.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                style={{ borderLeftWidth: 4, borderLeftColor: accent }}
              >
                {/* 요약 헤더 — 누르면 펼침 */}
                <button
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500"
                  >
                    {r.name.trim() ? r.name.trim()[0] : '?'}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{r.name || '(이름 없음)'}</span>
                  {r.dept && <span className="text-xs text-slate-400">{r.dept}</span>}
                  {r.birth && <span className="font-mono text-[11px] text-slate-400">{r.birth}</span>}
                  <span className="flex flex-wrap items-center gap-1">
                    {gradeCodes.map((c) => (
                      <span
                        key={c}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${HEALTH_GRADE_TONE[c]?.badge ?? 'bg-slate-100 text-slate-500'}`}
                      >
                        {c}
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{r.findings}</span>
                  {last && <span className="shrink-0 text-[11px] text-slate-400">최근 상담 {last}</span>}
                  <span aria-hidden className="shrink-0 text-[10px] text-slate-400">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                    <div className="flex flex-col gap-2.5 lg:flex-row">
                      {/* 신체도 — 검진소견을 부위별로 표시 */}
                      <div className="flex shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white p-3 lg:w-[360px]">
                        <BodyDiagram findings={r.findings} accent={accent} />
                      </div>

                      <div className="min-w-0 flex-1 space-y-2.5">
                        {/* 압축 정보 */}
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-white p-3 sm:grid-cols-3">
                          <Field label="성명">
                            <input id={`hf-name-${r.id}`} placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                          </Field>
                          <Field label="부서명">
                            <input id={`hf-dept-${r.id}`} placeholder="예: SAP팀" value={r.dept ?? ''} onChange={(e) => setRow(r.id, { dept: e.target.value })} className={CELL} />
                          </Field>
                          <Field label="생년월일">
                            <input id={`hf-birth-${r.id}`} type="date" value={r.birth ?? ''} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={`${CELL} font-mono`} />
                          </Field>
                          <Field label="건강구분">
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
                          </Field>
                          <Field label="업무수행적합">
                            <select
                              id={`hf-fitness-${r.id}`}
                              value={r.fitness}
                              onChange={(e) => setRow(r.id, { fitness: e.target.value })}
                              className={CELL}
                              title={FITNESS_CODES.map((c) => FITNESS_LABEL[c]).join('\n')}
                            >
                              {FITNESS_CODES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="재검일자">
                            <input id={`hf-retest-${r.id}`} type="date" value={r.retestDate ?? ''} onChange={(e) => setRow(r.id, { retestDate: e.target.value })} className={`${CELL} font-mono`} />
                          </Field>
                        </div>

                        {/* 소견 · 사후관리 · 생활습관 */}
                        <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-3">
                          <div className="flex items-center gap-2">
                            <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-slate-500">🔎 검진소견</span>
                            <input
                              id={`hf-findings-${r.id}`}
                              placeholder="예: 고혈압"
                              value={r.findings}
                              onChange={(e) => setRow(r.id, { findings: e.target.value })}
                              className={`${CELL} flex-1`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold text-slate-500">📋 사후관리</span>
                            <input
                              id={`hf-action-${r.id}`}
                              placeholder="예: 근무중 치료, 건강상담"
                              value={r.action}
                              onChange={(e) => setRow(r.id, { action: e.target.value })}
                              className={`${CELL} flex-1`}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
                            <label className="flex items-center gap-1.5 text-xs text-slate-600">
                              <input type="checkbox" checked={!!r.drinking} onChange={(e) => setRow(r.id, { drinking: e.target.checked })} className="h-3.5 w-3.5 accent-[#1f3864]" />
                              음주
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600">
                              <input type="checkbox" checked={!!r.smoking} onChange={(e) => setRow(r.id, { smoking: e.target.checked })} className="h-3.5 w-3.5 accent-[#1f3864]" />
                              흡연
                            </label>
                            <input
                              aria-label="복용중인 약"
                              placeholder="복용중인 약"
                              value={r.meds ?? ''}
                              onChange={(e) => setRow(r.id, { meds: e.target.value })}
                              className={`${CELL} min-w-[7rem] flex-1`}
                            />
                            <input
                              aria-label="비고"
                              placeholder="비고"
                              value={r.note ?? ''}
                              onChange={(e) => setRow(r.id, { note: e.target.value })}
                              className={`${CELL} min-w-[7rem] flex-1`}
                            />
                          </div>
                        </div>

                        {/* 상담이력 — 타임라인 (신체도 오른쪽 여백을 채운다) */}
                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-600">🕐 상담이력</p>
                            {last && <span className="text-[11px] text-slate-400">최근 {last}</span>}
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
                            (() => {
                              const sorted = [...r.counsels].map((c, i) => ({ c, i })).sort((a, b) => b.c.date.localeCompare(a.c.date));
                              return (
                                <div>
                                  {sorted.map(({ c, i }, idx) => (
                                    <div key={i} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                                      {idx !== sorted.length - 1 && (
                                        <span aria-hidden className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200" />
                                      )}
                                      <span aria-hidden className="relative z-10 mt-2 h-3 w-3 shrink-0 rounded-full border-2 border-white bg-[#1f3864] shadow" />
                                      <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-[7.5rem_1fr_1fr_1.25rem] sm:items-center">
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
                                    </div>
                                  ))}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </div>
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

/** 압축 정보 칸 — 작은 라벨 + 입력 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 truncate text-[9px] font-semibold text-slate-400">{label}</p>
      {children}
    </div>
  );
}
