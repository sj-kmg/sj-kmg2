'use client';

import { useEffect, useMemo, useState } from 'react';
import { listEntriesSilently } from './sync';
import { TBM_KEY, tbmDate, type TbmEntry } from './tbm';
import {
  WORKFORCE_KEY,
  headcountOf,
  laborCountOf,
  staffCountOf,
  type WorkforceEntry,
} from './workforce';

/** 하루치 현장 운영 요약 — 캘린더 셀·KPI에서 쓴다 */
export interface DayOps {
  date: string;
  entries: WorkforceEntry[];
  sites: string[];
  /** 총 투입 인원(직원 + 인력) */
  headcount: number;
  staff: number;
  labor: number;
  /** TBM일지가 작성된 현장 */
  tbmSites: Set<string>;
}

export interface OpsData {
  loading: boolean;
  workforce: WorkforceEntry[];
  tbm: TbmEntry[];
  /** YYYY-MM-DD → 하루 요약 */
  byDate: Map<string, DayOps>;
  dayOf: (date: string) => DayOps;
}

const EMPTY_DAY = (date: string): DayOps => ({
  date,
  entries: [],
  sites: [],
  headcount: 0,
  staff: 0,
  labor: 0,
  tbmSites: new Set<string>(),
});

/**
 * 메인 대시보드용 현장·인원 데이터.
 * 작업인원 기록과 TBM일지를 조용히(암호 프롬프트 없이) 불러와 날짜별로 묶는다.
 */
export function useOps(): OpsData {
  const [workforce, setWorkforce] = useState<WorkforceEntry[]>([]);
  const [tbm, setTbm] = useState<TbmEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [wf, tb] = await Promise.all([
        listEntriesSilently<WorkforceEntry>('workforce', WORKFORCE_KEY),
        listEntriesSilently<TbmEntry>('tbm', TBM_KEY),
      ]);
      if (!alive) return;
      setWorkforce(wf);
      setTbm(tb);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, DayOps>();
    for (const e of workforce) {
      if (!e.date) continue;
      const day = map.get(e.date) ?? EMPTY_DAY(e.date);
      day.entries.push(e);
      if (e.site && !day.sites.includes(e.site)) day.sites.push(e.site);
      day.staff += staffCountOf(e);
      day.labor += laborCountOf(e);
      day.headcount += headcountOf(e);
      map.set(e.date, day);
    }
    for (const t of tbm) {
      const d = tbmDate(t);
      if (!d) continue;
      const day = map.get(d) ?? EMPTY_DAY(d);
      if (t.site) day.tbmSites.add(t.site);
      map.set(d, day);
    }
    return map;
  }, [workforce, tbm]);

  const dayOf = useMemo(() => (date: string) => byDate.get(date) ?? EMPTY_DAY(date), [byDate]);

  return { loading, workforce, tbm, byDate, dayOf };
}
