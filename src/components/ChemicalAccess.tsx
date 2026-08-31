'use client';

import { useMemo } from 'react';
import { chemicalSeedWorkers } from '@/lib/education';
import { CHEM_WORKERS_KEY } from '@/lib/yncc';
import EduWorkerSheet from './EduWorkerSheet';

/**
 * 공무관리 > 안전교육 > 유해화학물질 — 직원 명부.
 * 인력은 [공무관리 > 인력관리]에서 인력소별로 관리하므로 여기서는 다루지 않는다.
 */
export default function ChemicalAccess() {
  // 정적 수료증 명부 → 직원 시트 초기 데이터
  const seed = useMemo(() => chemicalSeedWorkers(), []);

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <EduWorkerSheet logType="chem-workers" localKey={CHEM_WORKERS_KEY} group="직원" variant="chem" seed={seed} />
      </div>
    </div>
  );
}
