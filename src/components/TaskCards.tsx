import type { SafetyData } from '@/lib/types';
import GradeBadge from './GradeBadge';

export default function TaskCards({ data }: { data: SafetyData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.tasks.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-mono text-slate-400">{t.id}</p>
              <h3 className="font-bold text-slate-800">{t.name}</h3>
            </div>
            <GradeBadge r={t.maxR} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500" title={t.desc}>
            {t.desc}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
            <div>
              <dt className="text-xs text-slate-400">위험요인</dt>
              <dd className="font-bold text-slate-800">{t.count}건</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">평균 R</dt>
              <dd className="font-bold text-slate-800">{t.avgR ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">최고 R</dt>
              <dd className="font-bold text-slate-800">{t.maxR ?? '-'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            {t.area && <>지역: {t.area} · </>}
            평가일 {t.lastDate || '-'} · 평가 {t.evaluator || '-'} / 확인 {t.checker || '-'}
          </p>
        </div>
      ))}
    </div>
  );
}
