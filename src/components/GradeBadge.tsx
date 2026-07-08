import { gradeByKey, gradeOf } from '@/lib/risk';

/** 등급 배지 — 색상 + 텍스트를 항상 함께 표시한다 */
export default function GradeBadge({ grade, r }: { grade?: string; r?: number | null }) {
  const meta = grade ? gradeByKey(grade) : gradeOf(r ?? null);
  if (!meta) return <span className="text-slate-400">-</span>;
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ backgroundColor: meta.fill, color: meta.ink, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  );
}
