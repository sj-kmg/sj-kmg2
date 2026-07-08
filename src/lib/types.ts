export type GradeSystem = 'korean6' | 'letter4';

export interface RiskRow {
  id: string;
  taskId: string;
  taskName: string;
  /** 회사(발주처) — 통합 관리대장 양식에만 존재 */
  company: string;
  /** 설비/공정 — 통합 관리대장 양식에만 존재 */
  facility: string;
  stage: string;
  group: string;
  sub: string;
  hazard: string;
  dtype: string;
  measure: string;
  f: number | null;
  s: number | null;
  r: number | null;
  grade: string;
  improvement: string;
  f2: number | null;
  s2: number | null;
  r2: number | null;
  grade2: string;
  status: string;
  due: string;
  done: string;
  note: string;
  /** 평가일/조치일자 */
  date: string;
}

export interface TaskRow {
  id: string;
  name: string;
  desc: string;
  company: string;
  area: string;
  owner: string;
  lastDate: string;
  evaluator: string;
  checker: string;
  count: number;
  avgR: number | null;
  maxR: number | null;
  avgR2: number | null;
}

export interface EduRow {
  id: string;
  date: string;
  kind: string;
  title: string;
  target: string;
  attendees: number | null;
  hours: number | null;
  instructor: string;
  note: string;
}

export interface InspRow {
  id: string;
  date: string;
  kind: string;
  inspector: string;
  area: string;
  finding: string;
  action: string;
  due: string;
  status: string;
  done: string;
  note: string;
}

export interface IncidentRow {
  id: string;
  date: string;
  kind: string;
  place: string;
  task: string;
  summary: string;
  cause: string;
  prevention: string;
  status: string;
  done: string;
  note: string;
}

export interface ScheduleRow {
  id: string;
  date: string;
  kind: string;
  title: string;
  owner: string;
  status: string;
  note: string;
}

export interface SafetyData {
  meta: Record<string, string>;
  tasks: TaskRow[];
  risks: RiskRow[];
  edu: EduRow[];
  insp: InspRow[];
  incidents: IncidentRow[];
  schedule: ScheduleRow[];
  /** 위험등급 체계: korean6(허용불가~무시가능) | letter4(A~D) */
  gradeSystem: GradeSystem;
  /** 데이터 양식: standard(safety-data.xlsx) | ledger(통합 관리대장) */
  format: 'standard' | 'ledger';
  fileName: string;
  loadedAt: string;
}
