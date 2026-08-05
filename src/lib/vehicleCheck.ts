/**
 * 차량점검내역 — 차량 1대가 한 행, 정비항목이 열이 되어 마지막 교체·시행일을 기록한다.
 * 항목 구성(이름·주기)은 사용자가 직접 고칠 수 있도록 별도 목록으로 관리한다.
 *
 * 원본: 차량 엔진오일 교체.xlsx + 대시보드에서 갱신한 내용 (2026-08-05 기준)
 */
import { seedId } from './ids';

export type VehicleCategory = '일반차량' | '특수차량' | '중장비';

export const VEHICLE_CATEGORIES: VehicleCategory[] = ['일반차량', '특수차량', '중장비'];

/** 분류 표시색 — 원본 대장의 배경색(흰색·하늘색·베이지)을 따른다 */
export const CATEGORY_STYLE: Record<VehicleCategory, string> = {
  일반차량: 'bg-slate-100 text-slate-600',
  특수차량: 'bg-sky-50 text-sky-700',
  중장비: 'bg-amber-50 text-amber-700',
};

/** 차량 1대 */
export interface VehicleCheck {
  id: string;
  category: VehicleCategory;
  name: string; // 장비명
  plate: string; // 차량번호
  /** 정비항목 id → 마지막 교체·시행일 (YYYY-MM-DD) */
  dates: Record<string, string>;
  certFile?: string; // 정비명세서·영수증
  note: string; // 비고 (자유 기재)
  updatedAt: string;
}

/** 정비항목(열) 정의 — 이름·주기를 사용자가 고칠 수 있다 */
export interface VehicleItem {
  id: string; // 열 키 — 이름을 바꿔도 기록이 유지되도록 고정
  label: string; // 표시 이름
  /** 교체주기(개월) — 0이면 주기 관리 없이 날짜만 기록 */
  cycleMonths: number;
  order: number;
  updatedAt: string;
}

export const VEHICLE_CHECK_KEY = 'sj-vehicle-check:v1';
export const VEHICLE_ITEMS_KEY = 'sj-vehicle-items:v1';

/** 차기 교체일 알림 시작 (D-60) */
export const VEHICLE_CHECK_NOTICE_DAYS = 60;

/** 마지막 시행일 + 주기(개월) — 말일 보정 */
export function nextDueDate(doneAt: string, cycleMonths: number): string {
  if (!doneAt || !cycleMonths) return '';
  const d = new Date(`${doneAt}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  d.setMonth(d.getMonth() + cycleMonths);
  if (d.getDate() !== day) d.setDate(0);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 분류 → 차량번호 순 */
export function compareVehicle(a: VehicleCheck, b: VehicleCheck): number {
  const ca = VEHICLE_CATEGORIES.indexOf(a.category);
  const cb = VEHICLE_CATEGORIES.indexOf(b.category);
  if (ca !== cb) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
  return a.plate.localeCompare(b.plate, 'ko', { numeric: true });
}

export function compareItem(a: VehicleItem, b: VehicleItem): number {
  return a.order - b.order || a.label.localeCompare(b.label, 'ko');
}

/**
 * 기본 정비항목 — 주기적으로 교체·점검이 필요한 것 위주.
 * 화면의 [항목 관리]에서 이름·주기를 고치거나 추가·삭제할 수 있다.
 * [표시 이름, 주기(개월)]
 */
const DEFAULT_ITEMS: [string, number][] = [
  ['엔진오일', 12],
  ['오일필터', 12],
  ['에어크리너', 12],
  ['연료필터', 24],
  ['미션오일', 24],
  ['브레이크오일', 24],
  ['브레이크패드', 24],
  ['냉각수(부동액)', 24],
  ['타이어', 36],
  ['배터리', 36],
  ['와이퍼', 12],
  ['정기점검(자동차검사)', 12],
  ['보험기간', 12],
];

export function vehicleItemSeed(): VehicleItem[] {
  return DEFAULT_ITEMS.map(([label, cycleMonths], i) => ({
    id: seedId('VI', i),
    label,
    cycleMonths,
    order: i + 1,
    updatedAt: '',
  }));
}

/** 엔진오일 열의 고정 id — 기존 기록을 이 열로 옮긴다 */
export const ENGINE_OIL_ITEM_ID = seedId('VI', 0);

/** 기존 대장에서 넘어온 정비명세서 (85루 1418 엔진오일) */
const CARRIED_FILE =
  'https://firebasestorage.googleapis.com/v0/b/sj-kmg-deploy2.firebasestorage.app/o/certs%2F1785889647051-85%EB%A3%A8_1418_%EC%97%94%EC%A7%84%EC%98%A4%EC%9D%BC.pdf?alt=media&token=33bb5348-ceb6-499e-ac51-96356795507c';

/**
 * 차량 31대 — 저장 이력이 없을 때 최초 1회 자동 등록된다.
 * 엔진오일 일자는 이전 차량점검내역에 기록돼 있던 최신 값을 그대로 옮겼다.
 * [분류, 장비명, 차량번호, 엔진오일 마지막 교체일]
 */
export function vehicleCheckSeed(): VehicleCheck[] {
  const rows: [VehicleCategory, string, string, string][] = [
    // 일반차량
    ['일반차량', '봉고 Ⅲ', '93가 9652', '2025-08-27'],
    ['일반차량', 'MASTER 벤', '986버 1690', '2024-02-15'],
    ['일반차량', '렉스턴스포츠 칸', '986버 1665', '2024-11-28'],
    ['일반차량', '봉고Ⅲ 1톤', '93너 7439', '2025-06-27'],
    ['일반차량', '포터2', '815너 8465', '2025-08-11'],
    ['일반차량', '포터2 윙바디', '986버 1667', ''],
    ['일반차량', '봉고Ⅲ 1톤', '802소 3625', ''],
    ['일반차량', '봉고Ⅲ 1톤', '86저 0128', '2025-09-11'],
    ['일반차량', '봉고Ⅲ 1톤', '83너 0462', '2025-12-15'],
    ['일반차량', '봉고Ⅲ 1톤', '802소 3632', '2025-12-05'],
    ['일반차량', '포터2 파워게이트', '816도 5194', '2026-04-21'],
    ['일반차량', '봉고Ⅲ 1톤', '802소 3635', '2025-12-05'],

    // 특수차량
    ['특수차량', '에코필드5.3톤 건식진공흡입차', '83로 6699', '2026-07-31'],
    ['특수차량', '한성4.5톤 카고', '89도 8997', '2023-09-06'],
    ['특수차량', '한빛습식진공흡입차', '83두 2898', '2023-12-19'],
    ['특수차량', '한빛복합식하수구청소차', '95러 9793', '2024-01-12'],
    ['특수차량', '수산1.9톤 크레인카고트럭(이동식크레인)', '97소 1434', '2024-06-17'],
    ['특수차량', '한빛건식진공흡입차', '91오 8390', '2025-08-01'],
    ['특수차량', '고압살수차', '95어 6296', '2025-08-01'],
    ['특수차량', 'KCP 7.9톤건식진공흡입차', '95우 6525', '2026-07-31'],
    ['특수차량', '9.6톤복합식하수구청소차', '85루 1418', '2026-08-04'],
    ['특수차량', '6.9톤건식진공흡입차', '86주 6774', '2026-04-28'],
    ['특수차량', '한국쓰리축6.5톤 트럭', '81러 0891', '2025-09-04'],
    ['특수차량', '에코필드6.8톤 건식진공흡입차', '83마 2628', '2026-01-05'],
    ['특수차량', 'KCP 5.3톤 건식 진공흡입차', '96머 0525', '2026-03-30'],
    ['특수차량', '동우고성능건식 진공흡입청소차', '86조 6489', '2025-10-01'],
    ['특수차량', 'kcp6.3톤건식진공흡입차', '95우 6541', '2026-01-05'],

    // 중장비
    ['중장비', '지게차', '전남04바 2827', '2026-08-04'],
    ['중장비', '지게차', '전남04라 3482', '2026-01-05'],
    ['중장비', '스키드로더', '전남03나 3645', ''],
    ['중장비', '굴착기', '02마 1168', '2025-12-08'],
  ];
  return rows.map(([category, name, plate, oilDate], i) => ({
    id: seedId('VC-seed', i, plate),
    category,
    name,
    plate,
    dates: oilDate ? { [ENGINE_OIL_ITEM_ID]: oilDate } : {},
    ...(plate === '85루 1418' ? { certFile: CARRIED_FILE } : {}),
    note: '',
    updatedAt: '',
  }));
}
