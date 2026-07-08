export interface GradeMeta {
  key: string;
  label: string;
  range: string;
  min: number;
  max: number;
  /** 차트 막대/배지 배경색 */
  fill: string;
  /** 막대 테두리(한 단계 진한 색) */
  border: string;
  /** 배경 위 텍스트 색 */
  ink: string;
}

/**
 * 위험등급 6단계 — 신호등 의미 체계(상태 색상).
 * 색상 단독으로 의미를 전달하지 않도록 모든 사용처에 등급 텍스트를 병기한다.
 */
export const GRADES: GradeMeta[] = [
  { key: '허용불가', label: '허용불가', range: '16~20', min: 16, max: 20, fill: '#c00000', border: '#8a0000', ink: '#ffffff' },
  { key: '중대',     label: '중대',     range: '13~15', min: 13, max: 15, fill: '#e2711d', border: '#b25715', ink: '#ffffff' },
  { key: '상당',     label: '상당',     range: '9~12',  min: 9,  max: 12, fill: '#eda100', border: '#b87d00', ink: '#3d2b00' },
  { key: '경미',     label: '경미',     range: '7~8',   min: 7,  max: 8,  fill: '#e5cf62', border: '#b3a03e', ink: '#3d3200' },
  { key: '미미',     label: '미미',     range: '3~6',   min: 3,  max: 6,  fill: '#a5cf8d', border: '#7ba465', ink: '#1e3312' },
  { key: '무시가능', label: '무시가능', range: '1~2',   min: 1,  max: 2,  fill: '#57a05f', border: '#3f7c46', ink: '#ffffff' },
];

export function gradeOf(r: number | null): GradeMeta | null {
  if (r === null || Number.isNaN(r)) return null;
  return GRADES.find((g) => r >= g.min && r <= g.max) ?? null;
}

export function gradeByKey(key: string): GradeMeta | null {
  return GRADES.find((g) => g.key === key) ?? null;
}

/** R≥9 (상당 등급 이상)를 고위험으로 본다 */
export const HIGH_RISK_MIN = 9;
