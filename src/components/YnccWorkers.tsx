'use client';

import { YNCC_WORKERS_KEY } from '@/lib/yncc';
import EduWorkerSheet from './EduWorkerSheet';

/** 공무관리 > 안전교육 > YNCC출입 — 직원/인력 소분류 시트 */
export default function YnccWorkers({ group }: { group: '직원' | '인력' }) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <EduWorkerSheet logType="yncc-workers" localKey={YNCC_WORKERS_KEY} group={group} variant="yncc" />
      </div>
    </div>
  );
}
