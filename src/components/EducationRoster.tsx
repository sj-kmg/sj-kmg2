'use client';

import { useEffect, useState } from 'react';
import {
  EDU_COURSES,
  NOTICE_STEPS,
  NOTICE_STYLE,
  daysUntil,
  noticeLevel,
  renewalDate,
  type EduCourse,
} from '@/lib/education';

/**
 * 안전교육 이수 명부 (사이드바 안전교육 하위 메뉴) — 메인 [안전교육 현황] 패널과 같은 데이터 사용.
 * 행을 클릭하면 해당 교육자의 수료증 PDF가 열린다.
 */
export default function EducationRoster({ courseKey }: { courseKey: EduCourse['key'] }) {
  const course = EDU_COURSES.find((c) => c.key === courseKey)!;
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => setToday(new Date()), []);
  if (!today) return null;

  const rows = course.records
    .map((record) => {
      const renewAt = renewalDate(record.completedAt, course.renewalMonths);
      const days = daysUntil(renewAt, today);
      return { record, renewAt, days, level: noticeLevel(days) };
    })
    .sort((a, b) => a.days - b.days);

  const dueCount = rows.filter((r) => r.level !== null && r.days >= 0).length;
  const overdueCount = rows.filter((r) => r.days < 0).length;

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-4xl">🎓</p>
        <p className="mt-3 font-semibold text-slate-700">{course.label} — 등록된 이수 자료가 없습니다</p>
        <p className="mt-1 text-sm text-slate-500">수료증 자료가 등록되면 이곳에 명부가 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* 요약 */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <SummaryTile label="이수 인원" value={`${rows.length}명`} tone="text-slate-800" />
        <SummaryTile label={`갱신 임박 (D-${NOTICE_STEPS[0]} 이내)`} value={`${dueCount}명`} tone={dueCount ? 'text-orange-600' : 'text-slate-800'} />
        <SummaryTile label="기한 초과" value={`${overdueCount}명`} tone={overdueCount ? 'text-red-600' : 'text-slate-800'} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-semibold">성명</th>
              <th className="px-4 py-2.5 font-semibold">생년월일</th>
              <th className="px-4 py-2.5 font-semibold">과정</th>
              <th className="px-4 py-2.5 font-semibold">이수시간</th>
              <th className="px-4 py-2.5 font-semibold">이수일자</th>
              <th className="px-4 py-2.5 font-semibold">갱신 도래일</th>
              <th className="px-4 py-2.5 font-semibold">D-day</th>
              <th className="px-4 py-2.5 font-semibold">수료증</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ record, renewAt, days, level }) => (
              <tr
                key={record.certNo}
                className="cursor-pointer hover:bg-sky-50/50"
                onClick={() => window.open(encodeURI(record.certFile), '_blank')}
                title={`${record.name} 수료증 열기`}
              >
                <td className="px-4 py-2.5 font-semibold text-slate-800">{record.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{record.birth}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{course.courseName}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{record.hours}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{record.completedAt}</td>
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">{renewAt}</td>
                <td className="px-4 py-2.5">
                  {level ? (
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>
                      {days < 0 ? `D+${-days}` : `D-${days}`}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-slate-400">D-{days}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={encodeURI(record.certFile)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
                  >
                    📄 보기
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {course.legalBasis} · 이수일로부터 {course.renewalMonths}개월 후 갱신 도래 · 메인 화면에는 D-
        {NOTICE_STEPS[0]} 이내 대상자만 표시됩니다
      </p>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
