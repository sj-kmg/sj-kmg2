/**
 * 차량점검내역 — 차량·장비별 정비(교체) 이력.
 * 공무관리 메뉴와 메인 [공무관리 현황] 패널이 공유한다.
 *
 * 한 행 = 「차량 1대 + 정비항목 1건」이므로, 같은 차량에 엔진오일·타이어·배터리를
 * 각각 추가해 나가면 차량별 교체 이력이 항목별로 쌓인다.
 * 원본: 차량 엔진오일 교체.xlsx (2026-07-31 기준, 배경색으로 차종 구분)
 */

export type VehicleCategory = '일반차량' | '특수차량' | '중장비';

export interface VehicleService {
  id: string;
  category: VehicleCategory;
  name: string; // 장비명
  plate: string; // 차량번호
  item: string; // 정비항목 (엔진오일·타이어 등)
  replacedAt: string; // 교체일
  cycleMonths: number; // 교체주기(개월)
  nextDue: string; // 차기 교체일 — 교체일 + 주기 (수정 가능)
  certFile?: string; // 정비명세서·영수증 첨부
  note?: string;
  updatedAt: string;
}

export const VEHICLE_SERVICE_KEY = 'sj-vehicle-service:v1';

/** 차기 교체일 알림 시작 (D-60) */
export const VEHICLE_SERVICE_NOTICE_DAYS = 60;

export const VEHICLE_CATEGORIES: VehicleCategory[] = ['일반차량', '특수차량', '중장비'];

/** 분류별 표 머리 색 — 원본 대장의 배경색(흰색·하늘색·베이지)을 따른다 */
export const CATEGORY_STYLE: Record<VehicleCategory, { bar: string; chip: string }> = {
  일반차량: { bar: 'bg-slate-300', chip: 'bg-slate-100 text-slate-600' },
  특수차량: { bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-700' },
  중장비: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700' },
};

/**
 * 정비항목 기본 선택지 — 목록에 없는 항목은 직접 입력할 수 있다.
 * [항목명, 기본 교체주기(개월)]
 */
export const SERVICE_ITEMS: [string, number][] = [
  ['엔진오일', 12],
  ['오일필터', 12],
  ['에어크리너', 12],
  ['미션오일', 24],
  ['브레이크오일', 24],
  ['부동액', 24],
  ['타이어', 36],
  ['배터리', 36],
  ['브레이크패드', 24],
  ['연료필터', 12],
];

/** 항목별 기본 주기 (없으면 12개월) */
export function defaultCycle(item: string): number {
  return SERVICE_ITEMS.find(([name]) => name === item)?.[1] ?? 12;
}

/** 교체일 + 주기(개월) */
export function nextDueDate(replacedAt: string, cycleMonths: number): string {
  const d = new Date(`${replacedAt}T00:00:00`);
  if (Number.isNaN(d.getTime()) || !cycleMonths) return '';
  const day = d.getDate();
  d.setMonth(d.getMonth() + cycleMonths);
  // 말일 보정 (1/31 + 1개월 → 2/28)
  if (d.getDate() !== day) d.setDate(0);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 분류 → 차량번호 순 정렬 */
export function compareVehicle(a: VehicleService, b: VehicleService): number {
  const ca = VEHICLE_CATEGORIES.indexOf(a.category);
  const cb = VEHICLE_CATEGORIES.indexOf(b.category);
  if (ca !== cb) return ca - cb;
  const p = a.plate.localeCompare(b.plate, 'ko', { numeric: true });
  return p !== 0 ? p : a.item.localeCompare(b.item, 'ko');
}

/**
 * 차량 엔진오일 교체 현황 — 저장 이력이 없을 때 최초 1회 자동 등록된다.
 * 원본의 '점검 필요' 열은 비어 있어 제외했고, 중복 기재된 봉고Ⅲ(93가 9652) 1건은 합쳤다.
 * [분류, 장비명, 차량번호, 교체일]
 */
export function vehicleServiceSeed(): VehicleService[] {
  const rows: [VehicleCategory, string, string, string][] = [
    // 일반차량 (원본 흰색)
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

    // 특수차량 (원본 하늘색)
    ['특수차량', '에코필드5.3톤 건식진공흡입차', '83로 6699', '2026-07-31'],
    ['특수차량', '한성4.5톤 카고', '89도 8997', '2023-09-06'],
    ['특수차량', '한빛습식진공흡입차', '83두 2898', '2023-12-19'],
    ['특수차량', '한빛복합식하수구청소차', '95러 9793', '2024-01-12'],
    ['특수차량', '수산1.9톤 크레인카고트럭(이동식크레인)', '97소 1434', '2024-06-17'],
    ['특수차량', '한빛건식진공흡입차', '91오 8390', '2025-08-01'],
    ['특수차량', '고압살수차', '95어 6296', '2025-08-01'],
    ['특수차량', 'KCP 7.9톤건식진공흡입차', '95우 6525', '2026-07-31'],
    ['특수차량', '9.6톤복합식하수구청소차', '85루 1418', '2025-06-25'],
    ['특수차량', '6.9톤건식진공흡입차', '86주 6774', '2026-04-28'],
    ['특수차량', '한국쓰리축6.5톤 트럭', '81러 0891', '2025-09-04'],
    ['특수차량', '에코필드6.8톤 건식진공흡입차', '83마 2628', '2026-01-05'],
    ['특수차량', 'KCP 5.3톤 건식 진공흡입차', '96머 0525', '2026-03-30'],
    ['특수차량', '동우고성능건식 진공흡입청소차', '86조 6489', '2025-10-01'],
    ['특수차량', 'kcp6.3톤건식진공흡입차', '95우 6541', '2026-01-05'],

    // 중장비 (원본 베이지)
    ['중장비', '지게차', '전남04바 2827', ''],
    ['중장비', '지게차', '전남04라 3482', '2026-01-05'],
    ['중장비', '스키드로더', '전남03나 3645', ''],
    ['중장비', '굴착기', '02마 1168', '2025-12-08'],
  ];
  return rows.map(([category, name, plate, replacedAt]) => ({
    id: `VS-seed-${plate.replace(/\s/g, '')}-엔진오일`,
    category,
    name,
    plate,
    item: '엔진오일',
    replacedAt,
    cycleMonths: 12,
    nextDue: nextDueDate(replacedAt, 12),
    note: '',
    updatedAt: '',
  }));
}
