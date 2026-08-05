/**
 * 장비점검 — 장비 종류별 관리 현황.
 * 장비 종류가 탭이 되고, 종류마다 대상 설비를 한 표로 관리한다.
 * 원본: 에어분배기_관리일지.xlsx [전체현황] 시트 (2026-08-05 기준)
 */
import { seedId } from './ids';

/** 장비 종류 — 탭으로 표시된다. 새 장비는 여기에 추가한다. */
export type EquipType = 'AIR분배기';

export const EQUIP_TYPES: EquipType[] = ['AIR분배기'];

/** 교체·점검 여부 — 원본 대장의 드롭다운 선택지 */
export type EquipStatus = '교체 완료' | '수리 완료' | '점검 완료' | '조치 필요' | '미실시' | '해당없음';

export const EQUIP_STATUSES: EquipStatus[] = [
  '교체 완료',
  '수리 완료',
  '점검 완료',
  '조치 필요',
  '미실시',
  '해당없음',
];

export const EQUIP_STATUS_STYLE: Record<EquipStatus, string> = {
  '교체 완료': 'bg-emerald-50 text-emerald-700',
  '수리 완료': 'bg-emerald-50 text-emerald-700',
  '점검 완료': 'bg-sky-50 text-sky-700',
  '조치 필요': 'bg-red-50 text-red-700',
  미실시: 'bg-amber-50 text-amber-700',
  해당없음: 'bg-slate-100 text-slate-500',
};

export interface EquipCheck {
  id: string;
  equip: EquipType;
  unitNo: number; // 호기 번호
  name: string; // 설비명
  status: EquipStatus | ''; // 필터교체 여부
  doneAt: string; // 필터교체일자
  nextDue: string; // 차기 교체예정일 — 교체일 + 주기 (수정 가능)
  actionCount: number; // 조치 필요 건수
  owner: string; // 담당자
  note: string; // 비고
  certFile?: string; // 점검·교체 증빙 첨부
  updatedAt: string;
}

export const EQUIP_KEY = 'sj-equipment:v1';

/** 차기 교체예정일 알림 시작 (D-60) */
export const EQUIP_NOTICE_DAYS = 60;

/** 장비 종류별 설정 — 점검주기 안내와 자동 계산 주기 */
export const EQUIP_META: Record<EquipType, { cycleLabel: string; cycleMonths: number; itemLabel: string }> = {
  AIR분배기: { cycleLabel: '월 1회 / 필터 6개월', cycleMonths: 6, itemLabel: '필터교체' },
};

/** 교체일 + 개월 (말일 보정) */
export function equipNextDue(doneAt: string, cycleMonths: number): string {
  const d = new Date(`${doneAt}T00:00:00`);
  if (Number.isNaN(d.getTime()) || !cycleMonths) return '';
  const day = d.getDate();
  d.setMonth(d.getMonth() + cycleMonths);
  if (d.getDate() !== day) d.setDate(0);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 종류 → 호기 순 정렬 */
export function compareEquip(a: EquipCheck, b: EquipCheck): number {
  const byType = String(a.equip).localeCompare(String(b.equip), 'ko');
  if (byType !== 0) return byType;
  return a.unitNo - b.unitNo;
}

/** 26.08.04 정기 필터교체에서 제외된 호기 — 교체 예정 */
const NOT_DONE = new Set([3, 5, 6]);
/** 1호기만 하루 늦게 교체됨 */
const DONE_AT = (unit: number) => (unit === 1 ? '2026-08-05' : '2026-08-04');

export const AIR_UNIT_COUNT = 13;

/**
 * 에어분배기 13호기 — 저장 이력이 없을 때 최초 1회 자동 등록된다.
 * 원본 [전체현황] 시트 기준: 교체 완료 10대, 미실시 3대(3·5·6호기).
 */
export function airDistributorSeed(): EquipCheck[] {
  const cycle = EQUIP_META.AIR분배기.cycleMonths;
  return Array.from({ length: AIR_UNIT_COUNT }, (_, i) => {
    const unit = i + 1;
    const done = !NOT_DONE.has(unit);
    const doneAt = done ? DONE_AT(unit) : '';
    return {
      id: seedId('EQ-seed', i, `AD${String(unit).padStart(2, '0')}`),
      equip: 'AIR분배기' as const,
      unitNo: unit,
      name: `에어분배기 ${unit}호기`,
      status: (done ? '교체 완료' : '미실시') as EquipStatus,
      doneAt,
      nextDue: done ? equipNextDue(doneAt, cycle) : '',
      actionCount: 0,
      owner: '',
      note: '',
      updatedAt: '',
    };
  });
}
