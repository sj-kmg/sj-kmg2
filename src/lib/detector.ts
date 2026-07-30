/**
 * 산소·가스측정기(Detector) 관리대장 — 공무관리 메뉴와 메인 [공무관리 현황] 패널이 공유한다.
 * 원본: 산소측정기 관리 현황 (최신화) 2026-07-08 기준.
 */

/** 장비 상태 — 원본 대장의 비고 열에 섞여 있던 값을 별도 항목으로 분리했다 */
export type DetectorStatus = '사용' | '고장' | '분실' | '폐기';

export interface GasDetector {
  id: string;
  mgmtNo: string; // 관리번호 (SJ-O2-01 등)
  detector: string; // 장비 구분 (휴대용 O2 측정기 / 복합가스 측정기)
  model: string; // MODEL
  usage: string; // 용도 (측정 가스)
  calDate: string; // 검교정일
  nextCalDate: string; // 차기 검교정일 — 검교정일 + 1년 (수정 가능)
  kolas: boolean; // KOLAS 인정 여부
  maker: string; // 제조사
  vendor: string; // 검교정업체
  status: DetectorStatus;
  certFile?: string; // 교정성적서 파일 URL
  note?: string; // 비고
  updatedAt: string;
}

export const DETECTOR_KEY = 'sj-detectors:v1';

/** 차기 검교정일 알림 시작 (D-60) */
export const DETECTOR_NOTICE_DAYS = 60;

export const DETECTOR_STATUSES: DetectorStatus[] = ['사용', '고장', '분실', '폐기'];

/** 상태 배지 색 — 사용만 관리 대상이고 나머지는 흐리게 */
export const DETECTOR_STATUS_STYLE: Record<DetectorStatus, string> = {
  사용: 'bg-emerald-50 text-emerald-700',
  고장: 'bg-amber-50 text-amber-700',
  분실: 'bg-red-50 text-red-700',
  폐기: 'bg-slate-100 text-slate-500',
};

/** 검교정일 + 1년 (검교정 주기 1년) */
export function detectorNextCalDate(calDate: string): string {
  const d = new Date(`${calDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 관리번호에서 장비 종류를 뽑아 묶음 표시에 쓴다 (SJ-4G-02 → 4G) */
export function detectorKind(mgmtNo: string): string {
  const m = /^SJ-([A-Z0-9]+)-/i.exec(mgmtNo.trim());
  return m ? m[1].toUpperCase() : '기타';
}

/** 종류별 표시 이름 */
export const DETECTOR_KIND_LABEL: Record<string, string> = {
  O2: '산소 측정기',
  '2G': '복합가스 측정기 (2종)',
  '4G': '복합가스 측정기 (4종)',
  '5G': '복합가스 측정기 (5종)',
  기타: '기타',
};

/** 관리번호 순 정렬 (종류 → 번호) */
const KIND_ORDER = ['O2', '2G', '4G', '5G', '기타'];
export function compareDetector(a: GasDetector, b: GasDetector): number {
  const ka = KIND_ORDER.indexOf(detectorKind(a.mgmtNo));
  const kb = KIND_ORDER.indexOf(detectorKind(b.mgmtNo));
  if (ka !== kb) return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb);
  return a.mgmtNo.localeCompare(b.mgmtNo, 'ko', { numeric: true });
}

/**
 * 관리대장 28대 — 저장 이력이 없을 때 초기 데이터로 표시된다.
 * [관리번호, MODEL, 용도, 검교정일, 차기검교정일, 제조사, 검교정업체, 상태, 비고]
 */
export function detectorSeed(): GasDetector[] {
  const rows: [string, string, string, string, string, string, string, DetectorStatus, string][] = [
    ['SJ-O2-01', 'GAECO<SPG>', 'O2', '2025-08-11', '2026-08-10', '한국.GaeKo', '산성', '폐기', ''],
    ['SJ-O2-02', 'GAECO<SPG>', 'O2', '2025-08-11', '2025-08-10', '한국.GaeKo', '산성', '사용', '고정 · 조준호'],
    ['SJ-O2-03', 'SP-SGTP-O2', 'O2', '2025-06-02', '2026-06-02', 'SENKO', '에스알', '사용', ''],
    ['SJ-O2-04', 'GAECO<SPG>', 'O2', '2025-08-11', '2025-08-10', '한국.GaeKo', '산성', '분실', ''],
    ['SJ-O2-05', '', 'O2', '', '', '', '', '고장', ''],
    ['SJ-2G-01', 'GX-2009', 'O2, LEL', '2025-06-02', '2026-06-02', '일본.RIKEN KEIKI', '에스알', '분실', ''],
    ['SJ-2G-02', 'GX-2009', 'O2, LEL', '2025-06-02', '2026-06-02', '일본.RIKEN KEIKI', '에스알', '고장', '센서 오작동'],
    ['SJ-2G-03', 'GX-2009', 'O2, LEL', '2025-06-02', '2026-06-02', '일본.RIKEN KEIKI', '에스알', '고장', ''],
    ['SJ-2G-04', 'GasAlertMicroClip XL', 'O2, LEL', '2025-06-04', '2026-06-04', '한국.GaeKo', '에스알', '분실', ''],
    ['SJ-2G-05', 'GX-2009', 'O2, LEL', '2024-12-06', '2025-12-05', '일본.RIKEN KEIKI', '에스알', '분실', '센서 오작동'],
    ['SJ-2G-06', 'GX-2009', 'O2, LEL', '', '', '일본.RIKEN KEIKI', '에스알', '분실', ''],
    ['SJ-4G-01', 'Minimax X4', 'O2, CO, H2S, LEL', '2025-06-02', '2026-06-02', '미국.Honeywell', '에스알', '분실', '수치 이상 (20.2)'],
    ['SJ-4G-02', 'Minimax X4', 'O2, CO, H2S, LEL', '2025-06-02', '2026-06-02', '미국.Honeywell', '에스알', '사용', ''],
    ['SJ-4G-03', 'Minimax X4', 'O2, CO, H2S, LEL', '2025-06-04', '2026-06-04', '미국.Honeywell', '에스알', '사용', ''],
    ['SJ-4G-04', 'GX-2009', 'O2, CO, H2S, LEL', '2025-06-02', '2026-06-02', '일본.RIKEN KEIKI', '에스알', '사용', ''],
    ['SJ-4G-05', 'Minimax X4', 'O2, CO, H2S, LEL', '2025-06-02', '2026-06-02', '미국.Honeywell', '에스알', '고장', '센서 오작동'],
    ['SJ-4G-06', 'GX-2009', 'O2, CO, H2S, LEL', '2025-06-04', '2026-06-04', '일본.RIKEN KEIKI', '에스알', '고장', ''],
    ['SJ-4G-07', 'MultiRAE Lite', 'CO, CO2, H2S, LEL', '2025-06-02', '2026-06-02', 'RAE Systems', '에스알', '사용', 'O2 센서 없음'],
    ['SJ-4G-08', 'Minimax X4', 'O2, CO, H2S, LEL', '2025-03-10', '2025-09-10', '미국.Honeywell', '지앤에이', '사용', ''],
    ['SJ-5G-01', 'MultiRAE Lite', 'O2, CO, CO2, H2S, LEL', '2025-06-02', '2026-06-02', 'RAE Systems', '에스알', '사용', '연구소'],
    ['SJ-5G-02', 'GX-3R PRO', 'O2, CO, CO2, H2S, LEL', '2025-06-02', '2026-06-02', '일본.RIKEN KEIKI', '에스알', '사용', ''],
    ['SJ-5G-03', 'Ventis PRO 5', 'O2, CO, CO2, H2S, LEL', '2025-08-11', '2026-08-10', 'Industrial Scientific', '산성', '사용', ''],
    ['SJ-5G-04', 'BW Flex4', 'O2, CO, CO2, H2S, LEL', '2026-03-24', '2027-03-24', '미국.Honeywell', '우남', '사용', ''],
    ['SJ-5G-05', 'BW Flex4', 'O2, CO, CO2, H2S, LEL', '2026-03-24', '2027-03-24', '미국.Honeywell', '우남', '사용', ''],
    ['SJ-5G-06', 'BW Flex4', 'O2, CO, CO2, H2S, LEL', '2026-03-24', '2027-03-24', '미국.Honeywell', '우남', '사용', ''],
    ['SJ-5G-07', 'BW Flex4', 'O2, CO, CO2, H2S, LEL', '2026-03-24', '2027-03-24', '미국.Honeywell', '우남', '사용', ''],
    ['SJ-5G-08', 'GD5000', 'O2, CO, CO2, H2S, LEL', '2026-03-24', '2027-03-24', '중국.GADGET', '우남', '사용', ''],
    ['SJ-5G-09', 'GD5000', 'O2, CO, CO2, H2S, LEL', '2026-03-24', '2027-03-24', '중국.GADGET', '우남', '사용', ''],
  ];
  return rows.map(([mgmtNo, model, usage, calDate, nextCalDate, maker, vendor, status, note]) => ({
    id: `GD-seed-${mgmtNo}`,
    mgmtNo,
    detector: detectorKind(mgmtNo) === 'O2' ? '휴대용 O2 측정기' : '복합가스 측정기',
    model,
    usage,
    calDate,
    nextCalDate,
    kolas: true, // 원본 대장 전 항목 KOLAS 'O'
    maker,
    vendor,
    status,
    note,
    updatedAt: '',
  }));
}
