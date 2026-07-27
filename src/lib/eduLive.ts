/**
 * 실시간 교육 현황 수집 — 정적 명부(education.ts) + 입력 시트(YNCC·유해화학물질)를 합쳐
 * 메인 [안전교육 현황] 패널과 스탯 보드가 같은 기준으로 쓴다.
 */
import {
  EDU_COURSES,
  allRenewals,
  chemicalRenewalFromDates,
  daysUntil,
  noticeLevel,
  upcomingRenewals,
  type NoticeLevel,
} from './education';
import { listEntriesSilently } from './sync';
import {
  CHEM_WORKERS_KEY,
  YNCC_NOTICE_DAYS,
  YNCC_WORKERS_KEY,
  type EduSheetWorker,
} from './yncc';

export interface LiveDueItem {
  id: string;
  name: string;
  course: string;
  renewAt: string;
  days: number;
  level: NoticeLevel;
  certFile?: string;
}

export interface LiveUpcoming {
  name: string;
  course: string;
  renewAt: string;
  days: number;
}

export interface EducationStatus {
  /** 갱신기간 도래·기한 초과 — 임박 순 */
  due: LiveDueItem[];
  /** 아직 도래 전 — 가까운 순 */
  upcoming: LiveUpcoming[];
}

export async function collectEducationStatus(now: Date): Promise<EducationStatus> {
  const [ynccWs, chemWs] = await Promise.all([
    listEntriesSilently<EduSheetWorker>('yncc-workers', YNCC_WORKERS_KEY),
    listEntriesSilently<EduSheetWorker>('chem-workers', CHEM_WORKERS_KEY),
  ]);

  // 유해화학물질 시트에 입력된 이름은 정적 명부 대신 시트 데이터를 우선한다
  const chemSheetNames = new Set(chemWs.filter((w) => w.name).map((w) => w.name.trim()));
  const staticItems = allRenewals(now).filter(
    (r) => !(r.course.key === 'chemical' && chemSheetNames.has(r.record.name)),
  );

  const due: LiveDueItem[] = staticItems
    .filter((r) => r.level !== null)
    .map((r) => ({
      id: `${r.course.key}-${r.record.name}`,
      name: r.record.name,
      course: r.course.label,
      renewAt: r.renewAt,
      days: r.days,
      level: r.level!,
      certFile: r.record.certFile,
    }));
  const upcoming: LiveUpcoming[] = staticItems
    .filter((r) => r.level === null && r.days >= 0)
    .map((r) => ({ name: r.record.name, course: r.course.label, renewAt: r.renewAt, days: r.days }));

  // YNCC출입 — 교육유효종료일 기준 D-30
  for (const w of ynccWs) {
    if (!w.name || !w.eduExpire) continue;
    const days = daysUntil(w.eduExpire, now);
    const level = noticeLevel(days, YNCC_NOTICE_DAYS);
    if (level) due.push({ id: `yncc-${w.id}`, name: w.name, course: 'YNCC출입', renewAt: w.eduExpire, days, level });
    else if (days >= 0) upcoming.push({ name: w.name, course: 'YNCC출입', renewAt: w.eduExpire, days });
  }

  // 유해화학물질 시트 — 이수년도 기준 갱신년도 1월 1일, D-30
  for (const w of chemWs) {
    if (!w.name) continue;
    const renewAt = chemicalRenewalFromDates(w.offlineDate, w.onlineDate);
    if (!renewAt) continue;
    const days = daysUntil(renewAt, now);
    const level = noticeLevel(days, 30);
    if (level) due.push({ id: `chem-${w.id}`, name: w.name, course: '유해화학물질', renewAt, days, level });
    else if (days >= 0) upcoming.push({ name: w.name, course: '유해화학물질', renewAt, days });
  }

  due.sort((a, b) => a.days - b.days);
  upcoming.sort((a, b) => a.days - b.days);
  return { due, upcoming };
}

/** 과정 수(참고용) */
export const EDU_COURSE_COUNT = EDU_COURSES.length;
export { upcomingRenewals };
