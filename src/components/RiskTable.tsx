'use client';

import { useMemo, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { GRADES } from '@/lib/risk';
import GradeBadge from './GradeBadge';

const STAGES = ['작업 전', '작업 중', '작업 후'];

export default function RiskTable({ data }: { data: SafetyData }) {
  const [taskId, setTaskId] = useState('');
  const [stage, setStage] = useState('');
  const [grade, setGrade] = useState('');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.risks.filter((r) => {
      if (taskId && r.taskId !== taskId) return false;
      if (stage && r.stage !== stage) return false;
      if (grade && r.grade !== grade) return false;
      if (needle) {
        const hay = `${r.hazard} ${r.sub} ${r.group} ${r.measure} ${r.improvement} ${r.dtype}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data.risks, taskId, stage, grade, q]);

  const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700';

  return (
    <div className="space-y-3">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={sel} aria-label="작업 필터">
          <option value="">전체 작업</option>
          {data.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={sel} aria-label="작업단계 필터">
          <option value="">전체 단계</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className={sel} aria-label="위험등급 필터">
          <option value="">전체 등급</option>
          {GRADES.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label} (R {g.range})
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="유해위험요인·조치 검색"
          className={`${sel} w-56`}
          aria-label="검색"
        />
        <span className="ml-auto text-sm text-slate-500">{rows.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <Th>ID</Th>
              <Th>작업명</Th>
              <Th>단계</Th>
              <Th>작업절차 / 세부작업</Th>
              <Th>유해위험요인</Th>
              <Th>재해형태</Th>
              <Th>현재 안전보건조치</Th>
              <Th className="text-center">F</Th>
              <Th className="text-center">S</Th>
              <Th className="text-center">R</Th>
              <Th className="text-center">등급</Th>
              <Th>개선대책</Th>
              <Th className="text-center">개선후 R</Th>
              <Th className="text-center">상태</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                <Td className="font-mono text-xs text-slate-400">{r.id}</Td>
                <Td className="whitespace-nowrap font-medium">{r.taskName}</Td>
                <Td className="whitespace-nowrap text-slate-500">{r.stage}</Td>
                <Td className="max-w-52">
                  <p className="text-xs text-slate-400">{r.group}</p>
                  <p className="whitespace-pre-line">{r.sub}</p>
                </Td>
                <Td className="max-w-56 whitespace-pre-line font-medium text-slate-800">
                  {r.hazard || <span className="text-slate-300">(미기입)</span>}
                </Td>
                <Td className="whitespace-pre-line text-slate-600">{r.dtype}</Td>
                <Td className="max-w-64 whitespace-pre-line text-slate-600">{r.measure}</Td>
                <Td className="text-center">{r.f ?? '-'}</Td>
                <Td className="text-center">{r.s ?? '-'}</Td>
                <Td className="text-center font-bold">{r.r ?? '-'}</Td>
                <Td className="text-center">
                  <GradeBadge grade={r.grade} r={r.r} />
                </Td>
                <Td className="max-w-56 whitespace-pre-line text-slate-600">
                  {r.improvement || <span className="text-slate-300">-</span>}
                </Td>
                <Td className="text-center">
                  {r.r2 !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <b>{r.r2}</b> <GradeBadge grade={r.grade2} r={r.r2} />
                    </span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-center text-xs">
                  {r.status === '완료' ? (
                    <span className="font-semibold text-green-700">완료</span>
                  ) : r.status === '진행중' || r.status === '계획' ? (
                    <span className="font-semibold text-orange-700">{r.status}</span>
                  ) : (
                    <span className="text-slate-400">{r.status || '-'}</span>
                  )}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-10 text-center text-slate-400">
                  조건에 맞는 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
