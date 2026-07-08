'use client';

import type { SafetyData } from '@/lib/types';
import { HIGH_RISK_MIN } from '@/lib/risk';
import StatTile from './StatTile';
import GradeBadge from './GradeBadge';
import GradeDistChart from './charts/GradeDistChart';
import TaskRiskChart from './charts/TaskRiskChart';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

export default function DashboardHome({ data }: { data: SafetyData }) {
  const { risks, tasks, edu, insp, incidents, schedule } = data;

  const rs = risks.filter((r) => r.r !== null).map((r) => r.r as number);
  const avgR = rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : 0;
  const highRisk = rs.filter((r) => r >= HIGH_RISK_MIN).length;
  const improving = risks.filter((r) => r.status === '진행중' || r.status === '계획').length;
  const improved = risks.filter((r) => r.status === '완료').length;
  const openInsp = insp.filter((i) => i.status !== '완료' && i.status !== '해당없음');
  const openIncidents = incidents.filter((i) => i.status !== '완료');

  const upcoming = schedule
    .filter((s) => s.status === '예정' || s.status === '진행중')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const topRisks = [...risks]
    .filter((r) => r.r !== null)
    .sort((a, b) => (b.r ?? 0) - (a.r ?? 0))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="평가 대상 작업" value={tasks.length} sub="위험성평가 작업 수" />
        <StatTile label="유해위험요인" value={risks.length} sub={`평균 위험성 R ${avgR}`} />
        <StatTile
          label={`고위험 요인 (R≥${HIGH_RISK_MIN})`}
          value={highRisk}
          sub="상당 등급 이상"
          accent={highRisk > 0 ? '#c00000' : '#006300'}
        />
        <StatTile
          label="개선대책 진행 / 완료"
          value={`${improving} / ${improved}`}
          sub="위험성 감소대책 조치 현황"
          accent={improving > 0 ? '#b25715' : '#006300'}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="안전교육 실시" value={edu.length} sub="교육 대장 기준" />
        <StatTile label="안전점검 실시" value={insp.length} sub="점검 대장 기준" />
        <StatTile
          label="점검 미조치"
          value={openInsp.length}
          sub="조치상태가 완료가 아닌 건"
          accent={openInsp.length > 0 ? '#c00000' : '#006300'}
        />
        <StatTile
          label="아차사고"
          value={incidents.length}
          sub={openIncidents.length > 0 ? `미결 ${openIncidents.length}건` : '전건 처리 완료'}
        />
      </div>

      {/* 차트 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="위험등급 분포 (현재 위험성 기준)">
          <GradeDistChart risks={risks} />
        </Card>
        <Card title="작업별 위험성 비교">
          <TaskRiskChart tasks={tasks} />
        </Card>
      </div>

      {/* 리스트 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="위험성 상위 요인">
          <ul className="divide-y divide-slate-100">
            {topRisks.map((r) => (
              <li key={r.id} className="flex items-start gap-2 py-2 text-sm">
                <GradeBadge grade={r.grade} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800" title={r.hazard}>
                    {r.hazard || '(요인 미기입)'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.taskName} · R {r.r}
                    {r.r2 !== null && ` → 개선 후 ${r.r2}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="다가오는 일정">
          {upcoming.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">예정된 일정이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{s.date}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {s.kind}
                  </span>
                  <span className="truncate text-slate-800" title={s.title}>
                    {s.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="미조치 점검사항">
          {openInsp.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">미조치 사항이 없습니다. ✅</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openInsp.map((i) => (
                <li key={i.id} className="py-2 text-sm">
                  <p className="font-medium text-slate-800">{i.finding}</p>
                  <p className="text-xs text-slate-500">
                    {i.date} · {i.area} · 기한 {i.due || '미정'} ·{' '}
                    <span className="font-semibold text-orange-700">{i.status || '미입력'}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
