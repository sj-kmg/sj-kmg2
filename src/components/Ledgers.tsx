'use client';

import { useState } from 'react';
import type { SafetyData } from '@/lib/types';

const TABS = ['안전교육', '안전점검', '아차사고', '안전일정'] as const;
type Tab = (typeof TABS)[number];

export default function Ledgers({ data }: { data: SafetyData }) {
  const [tab, setTab] = useState<Tab>('안전교육');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
            <span className="ml-1.5 text-xs text-slate-400">
              {t === '안전교육'
                ? data.edu.length
                : t === '안전점검'
                  ? data.insp.length
                  : t === '아차사고'
                    ? data.incidents.length
                    : data.schedule.length}
            </span>
          </button>
        ))}
      </div>

      {tab === '안전교육' && (
        <Table
          head={['ID', '교육일자', '구분', '교육명', '대상', '인원', '시간(h)', '강사', '비고']}
          rows={data.edu.map((e) => [e.id, e.date, e.kind, e.title, e.target, e.attendees, e.hours, e.instructor, e.note])}
        />
      )}
      {tab === '안전점검' && (
        <Table
          head={['ID', '점검일자', '구분', '점검자', '구역', '지적사항', '조치사항', '기한', '상태', '완료일']}
          rows={data.insp.map((i) => [
            i.id, i.date, i.kind, i.inspector, i.area, i.finding, i.action, i.due,
            <StatusChip key={i.id} value={i.status} />, i.done,
          ])}
        />
      )}
      {tab === '아차사고' && (
        <Table
          head={['ID', '발생일자', '구분', '장소', '관련작업', '사고개요', '원인', '재발방지대책', '상태', '완료일']}
          rows={data.incidents.map((n) => [
            n.id, n.date, n.kind, n.place, n.task, n.summary, n.cause, n.prevention,
            <StatusChip key={n.id} value={n.status} />, n.done,
          ])}
        />
      )}
      {tab === '안전일정' && (
        <Table
          head={['ID', '날짜', '구분', '제목', '담당자', '상태', '비고']}
          rows={[...data.schedule]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => [s.id, s.date, s.kind, s.title, s.owner, <StatusChip key={s.id} value={s.status} />, s.note])}
        />
      )}
    </div>
  );
}

function StatusChip({ value }: { value: string }) {
  if (!value) return <span className="text-slate-300">-</span>;
  const done = value === '완료';
  const active = value === '진행중' || value === '조치중' || value === '조사중' || value === '계획' || value === '접수';
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
        done
          ? 'bg-green-100 text-green-800'
          : active
            ? 'bg-orange-100 text-orange-800'
            : 'bg-slate-100 text-slate-600'
      }`}
    >
      {value}
    </span>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs text-slate-500">
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-slate-100 align-top hover:bg-slate-50">
              {cells.map((c, j) => (
                <td key={j} className="max-w-64 whitespace-pre-line px-3 py-2.5 text-slate-700">
                  {c === null || c === '' ? <span className="text-slate-300">-</span> : c}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-4 py-10 text-center text-slate-400">
                데이터가 없습니다. 엑셀 파일의 해당 시트에 입력 후 다시 불러와 주세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
