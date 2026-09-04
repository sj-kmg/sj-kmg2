/**
 * 실시간 공무관리 현황 수집 — 상시카드·상시차량·건강검진·장비점검을 합쳐
 * 메인 [공무관리 현황] 패널이 쓴다.
 *
 * 차량점검내역(정비항목 교체)과 측정기 검교정은 여기에 넣지 않는다.
 * 차량 31대 × 정비항목 8개라 만료 목록을 가득 채워, 정작 챙겨야 할
 * 상시카드·건강검진이 묻힌다. 두 가지는 각자의 메뉴에서 본다.
 */
import {
  CARDS_KEY,
  CARD_NOTICE_DAYS,
  PASS_VEHICLES_KEY,
  VEHICLE_NOTICE_DAYS,
  accessCardSeed,
  passVehicleSeed,
  type AccessCard,
  type PassVehicle,
} from './cards';
import { daysUntil, noticeLevel, type NoticeLevel } from './education';
import { EQUIP_KEY, EQUIP_NOTICE_DAYS, airDistributorSeed, type EquipCheck } from './equipment';
import { HEALTH_KEY, HEALTH_LABEL, HEALTH_NOTICE_DAYS, healthGeneralSeed, type HealthCheck } from './health';
import { listEntriesSilently } from './sync';

export interface GaDueItem {
  id: string;
  name: string;
  kind: string;
  date: string;
  days: number;
  level: NoticeLevel;
}

export interface GaUpcoming {
  name: string;
  kind: string;
  date: string;
  days: number;
}

export interface GeneralAffairsStatus {
  /** 알림 임계값 도래·기한 초과 — 임박 순 */
  due: GaDueItem[];
  /** 아직 도래 전 — 가까운 순 */
  upcoming: GaUpcoming[];
}

export async function collectGeneralAffairsStatus(now: Date): Promise<GeneralAffairsStatus> {
  const [savedCards, savedVehicles, savedHealth, savedEquip] = await Promise.all([
    listEntriesSilently<AccessCard>('cards', CARDS_KEY),
    listEntriesSilently<PassVehicle>('pass-vehicles', PASS_VEHICLES_KEY),
    listEntriesSilently<HealthCheck>('health', HEALTH_KEY),
    listEntriesSilently<EquipCheck>('equipment', EQUIP_KEY),
  ]);
  const equipIds = new Set(savedEquip.map((e) => e.id));
  const equips = [...savedEquip, ...airDistributorSeed().filter((e) => !equipIds.has(e.id))];
  const healthNames = new Set(savedHealth.filter((h) => h.kind === 'general').map((h) => h.name.trim()));
  const health = [...savedHealth, ...healthGeneralSeed().filter((s) => !healthNames.has(s.name.trim()))];
  // 아직 저장 전이면 기존 신청현황(초기 데이터)을 기준으로 표시
  const cardIds = new Set(savedCards.map((c) => c.id));
  const cards = [...savedCards, ...accessCardSeed().filter((s) => !cardIds.has(s.id))];
  const plates = new Set(savedVehicles.map((v) => v.plate.trim()));
  const vehicles = [...savedVehicles, ...passVehicleSeed().filter((s) => !plates.has(s.plate.trim()))];

  const items = [
    ...cards
      .filter((c) => c.name && c.endDate)
      .map((c) => ({
        id: `card-${c.id}`,
        name: c.name,
        kind: '상시카드',
        date: c.endDate,
        days: daysUntil(c.endDate, now),
        notice: CARD_NOTICE_DAYS,
      })),
    ...vehicles
      .filter((v) => v.plate && v.endDate)
      .map((v) => ({
        id: `veh-${v.id}`,
        name: `${v.plate}${v.driver ? ` (${v.driver})` : ''}`,
        kind: '상시차량',
        date: v.endDate,
        days: daysUntil(v.endDate, now),
        notice: VEHICLE_NOTICE_DAYS,
      })),
    ...health
      .filter((h) => h.name && h.renewDate)
      .map((h) => ({
        id: `health-${h.id}`,
        name: h.name,
        kind: HEALTH_LABEL[h.kind],
        date: h.renewDate,
        days: daysUntil(h.renewDate, now),
        notice: HEALTH_NOTICE_DAYS,
      })),
    ...equips
      .filter((e) => e.nextDue && e.name)
      .map((e) => ({
        id: `eq-${e.id}`,
        name: e.name,
        kind: `${e.equip} 필터교체`,
        date: e.nextDue,
        days: daysUntil(e.nextDue, now),
        notice: EQUIP_NOTICE_DAYS,
      })),
  ].map((i) => ({ ...i, level: noticeLevel(i.days, i.notice) }));

  const due: GaDueItem[] = items
    .filter((i) => i.level !== null)
    .map((i) => ({ id: i.id, name: i.name, kind: i.kind, date: i.date, days: i.days, level: i.level! }))
    .sort((a, b) => a.days - b.days);
  const upcoming: GaUpcoming[] = items
    .filter((i) => i.level === null && i.days >= 0)
    .map((i) => ({ name: i.name, kind: i.kind, date: i.date, days: i.days }))
    .sort((a, b) => a.days - b.days);

  return { due, upcoming };
}
