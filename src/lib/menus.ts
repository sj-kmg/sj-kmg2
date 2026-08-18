/**
 * 열람 권한 단위 — 승인된 외부 사용자에게 메뉴별로 열어 줄 범위를 정의한다.
 *
 * 화면(메뉴) 하나가 어떤 기록 종류를 읽는지 여기에 함께 적어 두고,
 * 서버가 이 표를 근거로 API 접근을 막는다. 화면에서 메뉴를 숨기는 것만으로는
 * 주소창으로 API를 직접 부르는 것을 막을 수 없기 때문이다.
 */
import type { LogType } from './sync';

export interface MenuDef {
  /** 화면 키 — page.tsx의 ViewKey와 같은 값을 쓴다 */
  key: string;
  label: string;
  /** 이 화면이 읽는 기록 종류 */
  types: LogType[];
}

export const VIEWABLE_MENUS: MenuDef[] = [
  { key: 'main', label: '메인 대시보드', types: ['workforce', 'tbm', 'nearmiss'] },
  { key: 'tbm', label: 'TBM일지', types: ['tbm'] },
  { key: 'nearmiss', label: '아차사고', types: ['nearmiss'] },
  { key: 'people', label: '작업인원관리', types: ['workforce'] },
  { key: 'risk-assess', label: '위험성평가', types: ['risk'] },
  { key: 'annual-plan', label: '공무연간계획', types: ['annual-plan', 'annual-plan-tasks'] },
  { key: 'health-general', label: '건강검진(일반)', types: ['health'] },
  { key: 'health-special', label: '건강검진(특수)', types: ['health'] },
  { key: 'health-followup', label: '건강검진 — 유소견자 관리', types: ['health-followup'] },
  { key: 'edu-supervisor', label: '안전교육 — 관리감독자', types: ['supervisor'] },
  { key: 'edu-chemical', label: '안전교육 — 유해화학물질', types: ['chem-workers'] },
  { key: 'edu-yncc', label: '안전교육 — YNCC출입', types: ['yncc-workers'] },
  { key: 'card', label: '신청현황 — 상시카드&차량', types: ['cards', 'pass-vehicles'] },
  { key: 'yncc-vehicle', label: '신청현황 — YNCC차량', types: ['yncc-vehicles'] },
  { key: 'gas-meter', label: '산소&가스측정기', types: ['detectors'] },
  { key: 'vehicle-service', label: '차량점검내역', types: ['vehicle-service', 'vehicle-check', 'vehicle-items'] },
  { key: 'inventory', label: '통합재고관리', types: ['inventory'] },
  { key: 'safety-stock', label: '안전용품관리', types: ['safety-items', 'safety-dates'] },
  { key: 'equipment-check', label: '장비점검', types: ['equipment'] },
  { key: 'labor-roster', label: '인력관리', types: ['labor-roster'] },
  {
    key: 'extinguisher',
    label: '소화기관리',
    types: ['extinguisher-hq', 'extinguisher-hq-check', 'extinguisher-vehicle'],
  },
];

export const MENU_KEYS = VIEWABLE_MENUS.map((m) => m.key);

/** 허용된 메뉴들로 읽을 수 있는 기록 종류 전부 */
export function typesForMenus(menus: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const m of VIEWABLE_MENUS) {
    if (menus.includes(m.key)) m.types.forEach((t) => allowed.add(t));
  }
  return allowed;
}

/** 알 수 없는 키를 걸러 낸다 — 클라이언트가 보낸 값을 그대로 믿지 않는다 */
export function sanitizeMenus(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((k): k is string => typeof k === 'string' && MENU_KEYS.includes(k)))];
}
