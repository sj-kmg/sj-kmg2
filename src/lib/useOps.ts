'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NEARMISS_KEY, nearMissDate, type NearMissEntry } from './nearmiss';
import { listEntriesSilently } from './sync';
import { TBM_KEY, tbmDate, type TbmEntry } from './tbm';
import {
  WORKFORCE_KEY,
  datesOf,
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
  /** 그날 접수된 아차사고 */
  nearMisses: NearMissEntry[];
}

export interface OpsData {
  loading: boolean;
  workforce: WorkforceEntry[];
  tbm: TbmEntry[];
  nearmiss: NearMissEntry[];
  /** YYYY-MM-DD → 하루 요약 */
  byDate: Map<string, DayOps>;
  dayOf: (date: string) => DayOps;
  /** 지금 바로 다시 불러오기 */
  reload: () => void;
}

const EMPTY_DAY = (date: string): DayOps => ({
  date,
  entries: [],
  sites: [],
  headcount: 0,
  staff: 0,
  labor: 0,
  tbmSites: new Set<string>(),
  nearMisses: [],
});

/**
 * 메인 대시보드용 현장·인원·아차사고 데이터.
 *
 * 작업인원 기록·TBM일지·아차사고를 조용히(암호 프롬프트 없이) 불러와 날짜별로 묶는다.
 * 다른 화면에서 기록을 저장한 뒤 돌아오면 최신 내용이 보여야 하므로,
 * 창이 다시 활성화될 때마다 자동으로 다시 읽는다.
 */
export function useOps(): OpsData {
  const [workforce, setWorkforce] = useState<WorkforceEntry[]>([]);
  const [tbm, setTbm] = useState<TbmEntry[]>([]);
  const [nearmiss, setNearmiss] = useState<NearMissEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const aliveRef = useRef(true);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    aliveRef.current = true;
    void (async () => {
      const [wf, tb, nm] = await Promise.all([
        listEntriesSilently<WorkforceEntry>('workforce', WORKFORCE_KEY),
        listEntriesSilently<TbmEntry>('tbm', TBM_KEY),
        listEntriesSilently<NearMissEntry>('nearmiss', NEARMISS_KEY),
      ]);
      if (!aliveRef.current) return;
      setWorkforce(wf);
      setTbm(tb);
      setNearmiss(nm);
      setLoading(false);
    })();
    return () => {
      aliveRef.current = false;
    };
  }, [tick]);

  // 다른 탭·기기에서 기록을 남기고 돌아왔을 때 최신 상태로 맞춘다
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [reload]);

  const byDate = useMemo(() => {
    const map = new Map<string, DayOps>();
    const dayFor = (d: string): DayOps => {
      const found = map.get(d);
      if (found) return found;
      const made = EMPTY_DAY(d);
      map.set(d, made);
      return made;
    };

    for (const e of workforce) {
      // 여러 날 이어지는 작업은 그 기간의 모든 날에 똑같이 올린다
      for (const d of datesOf(e)) {
        const day = dayFor(d);
        day.entries.push(e);
        if (e.site && !day.sites.includes(e.site)) day.sites.push(e.site);
        day.staff += staffCountOf(e);
        day.labor += laborCountOf(e);
        day.headcount += headcountOf(e);
      }
    }
    for (const t of tbm) {
      const d = tbmDate(t);
      if (!d) continue;
      if (t.site) dayFor(d).tbmSites.add(t.site);
    }
    for (const n of nearmiss) {
      const d = nearMissDate(n);
      if (!d) continue;
      dayFor(d).nearMisses.push(n);
    }
    return map;
  }, [workforce, tbm, nearmiss]);

  const dayOf = useMemo(() => (date: string) => byDate.get(date) ?? EMPTY_DAY(date), [byDate]);

  return { loading, workforce, tbm, nearmiss, byDate, dayOf, reload };
}
