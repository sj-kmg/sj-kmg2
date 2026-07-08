export interface RiskRow {
  id: string;
  taskId: string;
  taskName: string;
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
}

export interface TaskRow {
  id: string;
  name: string;
  desc: string;
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
  fileName: string;
  loadedAt: string;
}
