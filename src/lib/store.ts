import type { SafetyData } from './types';

/**
 * 데이터는 브라우저 localStorage에만 저장한다.
 * 서버 전송·외부 저장이 없으므로 엑셀 원본은 사용자 PC를 벗어나지 않는다.
 */
const KEY = 'sj-safety-data:v1';

export function saveData(data: SafetyData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장 공간 부족 등 — 저장 실패해도 화면 표시는 계속한다
  }
}

export function loadData(): SafetyData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SafetyData;
    // 구버전 저장 데이터 호환
    if (!data.gradeSystem) data.gradeSystem = 'korean6';
    if (!data.format) data.format = 'standard';
    return data;
  } catch {
    return null;
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
