/**
 * 건강검진 유소견자·요관찰자 사후관리 — 공무관리 > 건강검진 > 유소견자 관리.
 * 원본: 2026 특수검진 유소견자 및 요관찰자 관리계획.xlsx (시트 "2026", "상담기록부").
 */
import { seedId } from './ids';

/** 건강관리구분 코드 (특수건강진단 판정) */
export const HEALTH_GRADE_LABEL: Record<string, string> = {
  A: '건강자 또는 경미한 이상소견이 있는 자',
  C1: 'C1 · 직업성 질병 우려 (요관찰자)',
  C2: 'C2 · 일반질병 우려 (요관찰자)',
  D1: 'D1 · 직업병 유소견자',
  D2: 'D2 · 일반질병 유소견자',
  R: 'R · 2차 건강진단 대상',
};
export const HEALTH_GRADE_CODES = Object.keys(HEALTH_GRADE_LABEL);

/** 업무수행적합여부 코드 */
export const FITNESS_LABEL: Record<string, string> = {
  가: '가 · 현재 조건에서 작업 가능',
  나: '나 · 조건부 작업 가능 (환경개선·보호구·주기단축 등)',
  다: '다 · 한시적으로 현재 작업 불가',
  라: '라 · 건강장해 우려로 현재 작업 불가',
};
export const FITNESS_CODES = Object.keys(FITNESS_LABEL);

/** 상담 기록 1건 */
export interface CounselEntry {
  date: string; // 상담일자 YYYY-MM-DD
  status: string; // 건강상태 (예: 현재 건강상태 : 양호)
  note?: string; // 비고
}

export interface FollowupWorker {
  id: string;
  name: string; // 성명
  dept?: string; // 부서명
  birth?: string; // 생년월일 YYYY-MM-DD
  findings: string; // 검진소견 (Check Point)
  grade: string; // 건강구분 — 복수 가능, 콤마로 표기 (예: "C2, D2")
  action: string; // 사후관리 및 상담내용
  fitness: string; // 업무수행적합여부 (가/나/다/라)
  drinking?: boolean; // 음주여부
  smoking?: boolean; // 흡연여부
  meds?: string; // 복용중인 약
  retestDate?: string; // 재검일자
  note?: string; // 비고
  counsels: CounselEntry[]; // 상담이력 — 날짜순
  updatedAt: string;
}

export const HEALTH_FOLLOWUP_KEY = 'sj-health-followup:v1';

/** 최근 상담일자 — 상담이력 중 가장 늦은 날짜 */
export function lastCounselDate(w: FollowupWorker): string | null {
  if (!w.counsels.length) return null;
  return [...w.counsels].sort((a, b) => b.date.localeCompare(a.date))[0].date;
}

/**
 * 2026년 유소견자·요관찰자 5명 — 원본 관리계획 시트 "2026"(현황) + "상담기록부"(상담이력) 기준.
 * 저장 이력이 없을 때 초기 데이터로 표시된다.
 */
export function healthFollowupSeed(): FollowupWorker[] {
  const rows: Omit<FollowupWorker, 'id' | 'updatedAt'>[] = [
    {
      name: '오남택',
      dept: 'C&S1팀',
      birth: '1965-07-26',
      findings: '고혈압',
      grade: 'D2',
      action: '근무중 치료',
      fitness: '나',
      drinking: true,
      smoking: true,
      meds: '혈압',
      counsels: [
        { date: '2026-03-25', status: '현재 건강상태 : 양호', note: '치료중' },
        { date: '2026-08-10', status: '현재 건강상태 : 양호' },
      ],
    },
    {
      name: '권현철',
      dept: 'SAP팀',
      birth: '1975-08-14',
      findings: '간장질환 및 비만 주의',
      grade: 'C2',
      action: '건강상담',
      fitness: '나',
      drinking: true,
      smoking: true,
      counsels: [
        { date: '2026-03-25', status: '현재 건강상태 : 양호', note: '운동 권유' },
        { date: '2026-08-10', status: '현재 건강상태 : 양호' },
      ],
    },
    {
      name: '김민철',
      dept: 'SAP팀',
      birth: '1963-01-15',
      findings: '흉부질환 (비결핵 질환)',
      grade: 'D2',
      action: '근무중 치료',
      fitness: '나',
      drinking: true,
      smoking: false,
      counsels: [
        { date: '2026-03-25', status: '현재 건강상태 : 양호', note: '치료 권고' },
        { date: '2026-08-10', status: '현재 건강상태 : 양호' },
      ],
    },
    {
      name: '김중길',
      dept: 'SAP팀',
      birth: '1978-10-15',
      findings: '이상지질혈증 및 간장질환 주의',
      grade: 'C2, D2',
      action: '근무중 치료, 건강상담',
      fitness: '나',
      drinking: true,
      smoking: true,
      counsels: [
        { date: '2026-03-25', status: '현재 건강상태 : 보통', note: '절주 및 운동 권유' },
        { date: '2026-08-10', status: '현재 건강상태 : 양호' },
      ],
    },
    {
      name: '김종호',
      dept: 'C&S1팀',
      birth: '1982-01-02',
      findings: '고혈압, 당뇨, 이상지질혈증, 간장질환 주의',
      grade: 'C2, D2',
      action: '근무중 치료, 건강상담',
      fitness: '나',
      drinking: true,
      smoking: true,
      meds: '당뇨, 혈압',
      counsels: [
        { date: '2026-03-25', status: '현재 건강상태 : 보통', note: '운동 권유' },
        { date: '2026-08-10', status: '현재 건강상태 : 양호' },
      ],
    },
  ];
  return rows.map((r, i) => ({
    id: seedId('HF-seed', i, r.name),
    ...r,
    updatedAt: '',
  }));
}
