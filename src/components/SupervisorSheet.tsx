'use client';

import { useMemo } from 'react';
import { EDU_COURSES } from '@/lib/education';
import { seedId } from '@/lib/ids';
import { SUPERVISOR_KEY } from '@/lib/yncc';
import EduWorkerSheet from './EduWorkerSheet';

/** 공무관리 › 안전교육 › 관리감독자 — 명부 이관 + 수료증 첨부/교체 가능 시트 */
export default function SupervisorSheet() {
  const seed = useMemo(() => {
    const course = EDU_COURSES.find((c) => c.key === 'supervisor');
    return (course?.records ?? []).map((r, i) => ({
      id: seedId('SW-seed', i, r.name),
      group: '직원' as const,
      name: r.name,
      birth: r.birth,
      offlineDate: r.completedAt, // 관리감독자는 집체(비대면) 교육 1건
      onlineDate: '',
      certFile: r.certFile,
      updatedAt: '',
    }));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <EduWorkerSheet
          logType="supervisor"
          localKey={SUPERVISOR_KEY}
          group="직원"
          variant="supervisor"
          seed={seed}
        />
      </div>
    </div>
  );
}
