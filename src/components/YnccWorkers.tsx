'use client';

import { YNCC_WORKERS_KEY } from '@/lib/yncc';
import EduWorkerSheet from './EduWorkerSheet';

/**
 * 공무관리 > 안전교육 > YNCC출입 — 직원 명부.
 * 인력은 [공무관리 > 인력관리]에서 인력소별로 관리하므로 여기서는 다루지 않는다.
 */
export default function YnccWorkers() {
  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <EduWorkerSheet logType="yncc-workers" localKey={YNCC_WORKERS_KEY} group="직원" variant="yncc" />
      </div>
    </div>
  );
}
