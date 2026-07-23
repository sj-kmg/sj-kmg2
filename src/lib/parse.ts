import * as XLSX from 'xlsx';
import type {
  SafetyData, RiskRow, TaskRow, EduRow, InspRow, IncidentRow, ScheduleRow, GradeSystem,
} from './types';
import { gradeOf } from './risk';

type Cell = unknown;
type Row = Record<string, Cell>;

function str(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return dateStr(v);
  return String(v).trim();
}

function num(v: Cell): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateStr(v: Cell): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  if (typeof v === 'number') {
    // 엑셀 날짜 일련번호 (cellDates가 놓친 경우 대비)
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
    return String(v);
  }
  return String(v).trim();
}

function avg(xs: number[]): number | null {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

/* ============================================================
 * 양식 ① standard — safety-data.xlsx (평가ID/작업ID 열, 1행 헤더)
 * ============================================================ */

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
}

function parseStandardRisks(wb: XLSX.WorkBook): RiskRow[] {
  return sheetRows(wb, '위험성평가')
    .filter((r) => str(r['평가ID']) !== '')
    .map((r) => {
      const f = num(r['가능성(F)']);
      const s = num(r['중대성(S)']);
      // R은 항상 F×S로 재계산 (사용자가 수식 복사를 빠뜨린 행도 안전하게 처리)
      const rv = f !== null && s !== null ? f * s : num(r['위험성(R)']);
      const f2 = num(r['개선후가능성(F)']);
      const s2 = num(r['개선후중대성(S)']);
      const r2 = f2 !== null && s2 !== null ? f2 * s2 : num(r['개선후위험성(R)']);
      return {
        id: str(r['평가ID']),
        taskId: str(r['작업ID']),
        taskName: str(r['작업명']),
        company: '',
        facility: '',
        stage: str(r['작업단계']),
        group: str(r['작업절차']),
        sub: str(r['세부작업']),
        hazard: str(r['유해위험요인']),
        dtype: str(r['재해형태']),
        measure: str(r['현재안전보건조치']),
        f, s, r: rv,
        grade: str(r['위험등급']) || gradeOf(rv, 'korean6')?.key || '',
        improvement: str(r['개선대책']),
        f2, s2, r2,
        grade2: str(r['개선후위험등급']) || gradeOf(r2, 'korean6')?.key || '',
        status: str(r['개선상태']),
        due: dateStr(r['개선기한']),
        done: dateStr(r['개선완료일']),
        note: str(r['비고']),
        date: '',
      };
    });
}

function parseStandardTasks(wb: XLSX.WorkBook, risks: RiskRow[]): TaskRow[] {
  return sheetRows(wb, '작업목록')
    .filter((r) => str(r['작업ID']) !== '')
    .map((r) => {
      const id = str(r['작업ID']);
      const rs = risks.filter((k) => k.taskId === id && k.r !== null).map((k) => k.r as number);
      const r2s = risks.filter((k) => k.taskId === id && k.r2 !== null).map((k) => k.r2 as number);
      return {
        id,
        name: str(r['작업명']),
        desc: str(r['작업내용']),
        company: '',
        area: str(r['작업지역(공정)']),
        owner: str(r['담당자']),
        lastDate: dateStr(r['최근평가일']),
        evaluator: str(r['평가자']),
        checker: str(r['확인자']),
        // 집계는 위험성평가 원본에서 직접 계산 (엑셀 수식 캐시에 의존하지 않음)
        count: risks.filter((k) => k.taskId === id).length,
        avgR: avg(rs),
        maxR: rs.length ? Math.max(...rs) : null,
        avgR2: avg(r2s),
      };
    });
}

function parseEdu(wb: XLSX.WorkBook): EduRow[] {
  return sheetRows(wb, '안전교육')
    .filter((r) => str(r['교육ID']) !== '')
    .map((r) => ({
      id: str(r['교육ID']),
      date: dateStr(r['교육일자']),
      kind: str(r['교육구분']),
      title: str(r['교육명']),
      target: str(r['교육대상']),
      attendees: num(r['참석인원']),
      hours: num(r['교육시간(h)']),
      instructor: str(r['강사']),
      note: str(r['비고']),
    }));
}

function parseInsp(wb: XLSX.WorkBook): InspRow[] {
  return sheetRows(wb, '안전점검')
    .filter((r) => str(r['점검ID']) !== '')
    .map((r) => ({
      id: str(r['점검ID']),
      date: dateStr(r['점검일자']),
      kind: str(r['점검구분']),
      inspector: str(r['점검자']),
      area: str(r['점검구역']),
      finding: str(r['지적사항']),
      action: str(r['조치사항']),
      due: dateStr(r['조치기한']),
      status: str(r['조치상태']),
      done: dateStr(r['완료일']),
      note: str(r['비고']),
    }));
}

function parseIncidents(wb: XLSX.WorkBook): IncidentRow[] {
  return sheetRows(wb, '아차사고')
    .filter((r) => str(r['사고ID']) !== '')
    .map((r) => ({
      id: str(r['사고ID']),
      date: dateStr(r['발생일자']),
      kind: str(r['사고구분']),
      place: str(r['발생장소']),
      task: str(r['관련작업']),
      summary: str(r['사고개요']),
      cause: str(r['원인']),
      prevention: str(r['재발방지대책']),
      status: str(r['처리상태']),
      done: dateStr(r['완료일']),
      note: str(r['비고']),
    }));
}

function parseSchedule(wb: XLSX.WorkBook): ScheduleRow[] {
  return sheetRows(wb, '안전일정')
    .filter((r) => str(r['일정ID']) !== '')
    .map((r) => ({
      id: str(r['일정ID']),
      date: dateStr(r['날짜']),
      kind: str(r['구분']),
      title: str(r['제목']),
      owner: str(r['담당자']),
      status: str(r['상태']),
      note: str(r['비고']),
    }));
}

function parseMeta(wb: XLSX.WorkBook): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const r of sheetRows(wb, '기준정보')) {
    const k = str(r['항목']);
    if (k) meta[k] = str(r['값']);
  }
  return meta;
}

function parseStandard(wb: XLSX.WorkBook, fileName: string): SafetyData {
  const risks = parseStandardRisks(wb);
  return {
    meta: parseMeta(wb),
    risks,
    tasks: parseStandardTasks(wb, risks),
    edu: parseEdu(wb),
    insp: parseInsp(wb),
    incidents: parseIncidents(wb),
    schedule: parseSchedule(wb),
    gradeSystem: 'korean6',
    format: 'standard',
    fileName,
    loadedAt: new Date().toISOString(),
  };
}

/* ============================================================
 * 양식 ② ledger — 통합 위험성평가 관리대장
 *   마스터 표: '회사(발주처)' 헤더가 있는 시트 (2행 헤더, 데이터는 그 아래)
 *   회사별 뷰 시트(No/작업단계/... + ▣ 구분행)는 마스터의 부분집합이므로
 *   마스터가 있으면 마스터만 읽는다. 마스터가 없으면 뷰 시트를 읽는다.
 * ============================================================ */

type Grid = Cell[][];

function grid(ws: XLSX.WorkSheet): Grid {
  return XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null });
}

function findLedgerMaster(wb: XLSX.WorkBook): { g: Grid; headerRow: number } | null {
  for (const name of wb.SheetNames) {
    const g = grid(wb.Sheets[name]);
    for (let i = 0; i < Math.min(g.length, 5); i++) {
      if ((g[i] ?? []).some((c) => str(c) === '회사(발주처)')) {
        return { g, headerRow: i };
      }
    }
  }
  return null;
}

function colIndex(header: Cell[], match: (s: string) => boolean): number {
  return header.findIndex((c) => c !== null && match(str(c)));
}

function parseLedgerMaster(g: Grid, headerRow: number): RiskRow[] {
  const header = g[headerRow].map((c) => str(c));
  const iCompany = colIndex(g[headerRow], (s) => s === '회사(발주처)');
  const iFacility = colIndex(g[headerRow], (s) => s.startsWith('설비'));
  const iWork = colIndex(g[headerRow], (s) => s === '작업명');
  const iStage = colIndex(g[headerRow], (s) => s === '작업단계');
  const iHazard = colIndex(g[headerRow], (s) => s.startsWith('유해'));
  const iDtype = colIndex(g[headerRow], (s) => s === '재해형태');
  const iMeasure = colIndex(g[headerRow], (s) => s.includes('안전보건조치'));
  const iPre = colIndex(g[headerRow], (s) => s.startsWith('개선 전') || s.startsWith('개선전'));
  const iImp = colIndex(g[headerRow], (s) => s.includes('대책'));
  const iPost = colIndex(g[headerRow], (s) => s.startsWith('개선 후') || s.startsWith('개선후'));
  const iDate = colIndex(g[headerRow], (s) => s === '평가일' || s === '조치일자' || s === '평가 일자');
  if (iCompany < 0 || iHazard < 0 || iPre < 0) return [];

  const rows: RiskRow[] = [];
  // 헤더 2행(빈도/강도/위험성/등급 소제목) 다음부터 데이터
  for (let i = headerRow + 2; i < g.length; i++) {
    const row = g[i] ?? [];
    const company = str(row[iCompany]);
    const hazard = str(row[iHazard]);
    const f = num(row[iPre]);
    if (!company && !hazard && f === null) continue; // 빈 행/구분 행
    const s = num(row[iPre + 1]);
    const rv = f !== null && s !== null ? f * s : num(row[iPre + 2]);
    const f2 = iPost >= 0 ? num(row[iPost]) : null;
    const s2 = iPost >= 0 ? num(row[iPost + 1]) : null;
    const r2 = f2 !== null && s2 !== null ? f2 * s2 : iPost >= 0 ? num(row[iPost + 2]) : null;
    const improvement = iImp >= 0 ? str(row[iImp]) : '';
    rows.push({
      id: `L${String(rows.length + 1).padStart(3, '0')}`,
      taskId: '',
      taskName: iWork >= 0 ? str(row[iWork]) : '',
      company,
      facility: iFacility >= 0 ? str(row[iFacility]) : '',
      stage: iStage >= 0 ? str(row[iStage]) : '',
      group: '',
      sub: '',
      hazard,
      dtype: iDtype >= 0 ? str(row[iDtype]) : '',
      measure: iMeasure >= 0 ? str(row[iMeasure]) : '',
      f, s, r: rv,
      grade: str(row[iPre + 3]) || gradeOf(rv, 'letter4')?.key || '',
      improvement,
      f2, s2, r2,
      grade2: (iPost >= 0 ? str(row[iPost + 3]) : '') || gradeOf(r2, 'letter4')?.key || '',
      status: improvement ? '진행중' : '해당없음',
      due: '',
      done: '',
      note: '',
      date: iDate >= 0 ? dateStr(row[iDate]) : '',
    });
  }
  void header;
  return rows;
}

/** 회사별 뷰 시트: 1행 제목 '위험성평가 — 회사명', 2행 헤더(No/작업단계/...), ▣ 구분행 */
function parseLedgerViews(wb: XLSX.WorkBook): RiskRow[] {
  const rows: RiskRow[] = [];
  for (const name of wb.SheetNames) {
    const g = grid(wb.Sheets[name]);
    if (g.length < 3) continue;
    const h = (g[1] ?? []).map((c) => str(c));
    if (h[0] !== 'No' || !h.some((s) => s.startsWith('유해'))) continue;
    const title = str(g[0]?.[0]);
    const company = title.includes('—') ? title.split('—')[1].trim() : title.replace('위험성평가', '').trim();
    let facility = '';
    let work = '';
    let date = '';
    for (let i = 2; i < g.length; i++) {
      const row = g[i] ?? [];
      const a = str(row[0]);
      if (a.startsWith('▣')) {
        const fm = a.match(/설비\/?공정\s*:\s*([^|]+)/);
        const wm = a.match(/작업\s*:\s*([^|]+)/);
        const dm = a.match(/평가일\s*:\s*([^|]+)/);
        facility = fm ? fm[1].trim() : facility;
        work = wm ? wm[1].trim() : work;
        date = dm ? dm[1].trim() : date;
        continue;
      }
      const f = num(row[5]);
      const hazard = str(row[2]);
      if (!hazard && f === null) continue;
      const s = num(row[6]);
      const rv = f !== null && s !== null ? f * s : num(row[7]);
      const f2 = num(row[10]);
      const s2 = num(row[11]);
      const r2 = f2 !== null && s2 !== null ? f2 * s2 : num(row[12]);
      const improvement = str(row[9]);
      rows.push({
        id: `L${String(rows.length + 1).padStart(3, '0')}`,
        taskId: '',
        taskName: work,
        company,
        facility,
        stage: str(row[1]),
        group: '',
        sub: '',
        hazard,
        dtype: str(row[3]),
        measure: str(row[4]),
        f, s, r: rv,
        grade: str(row[8]) || gradeOf(rv, 'letter4')?.key || '',
        improvement,
        f2, s2, r2,
        grade2: str(row[13]) || gradeOf(r2, 'letter4')?.key || '',
        status: improvement ? '진행중' : '해당없음',
        due: '',
        done: '',
        note: '',
        date,
      });
    }
  }
  return rows;
}

function synthesizeTasks(risks: RiskRow[]): TaskRow[] {
  const keys: string[] = [];
  const map = new Map<string, RiskRow[]>();
  for (const r of risks) {
    const key = `${r.company}|${r.taskName}`;
    if (!map.has(key)) {
      map.set(key, []);
      keys.push(key);
    }
    map.get(key)!.push(r);
  }
  return keys.map((key, idx) => {
    const items = map.get(key)!;
    const id = `T${String(idx + 1).padStart(2, '0')}`;
    items.forEach((r) => (r.taskId = id));
    const rs = items.filter((r) => r.r !== null).map((r) => r.r as number);
    const r2s = items.filter((r) => r.r2 !== null).map((r) => r.r2 as number);
    const areas = [...new Set(items.map((r) => r.facility).filter(Boolean))];
    const dates = items.map((r) => r.date).filter(Boolean).sort();
    return {
      id,
      name: items[0].taskName || '(작업명 없음)',
      desc: '',
      company: items[0].company,
      area: areas.join(', '),
      owner: '',
      lastDate: dates[dates.length - 1] ?? '',
      evaluator: '',
      checker: '',
      count: items.length,
      avgR: avg(rs),
      maxR: rs.length ? Math.max(...rs) : null,
      avgR2: avg(r2s),
    };
  });
}

function parseLedger(wb: XLSX.WorkBook, fileName: string): SafetyData | null {
  const master = findLedgerMaster(wb);
  const risks = master ? parseLedgerMaster(master.g, master.headerRow) : parseLedgerViews(wb);
  if (risks.length === 0) return null;
  const years = [...new Set(risks.map((r) => r.date.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort();
  const meta: Record<string, string> = {
    회사명: '㈜신정개발',
    문서명: '통합 위험성평가 관리대장',
  };
  if (years.length) meta['평가연도'] = years[years.length - 1];
  return {
    meta,
    risks,
    tasks: synthesizeTasks(risks),
    edu: [],
    insp: [],
    incidents: [],
    schedule: [],
    gradeSystem: 'letter4',
    format: 'ledger',
    fileName,
    loadedAt: new Date().toISOString(),
  };
}

/* ============================================================ */

function isStandard(wb: XLSX.WorkBook): boolean {
  const ws = wb.Sheets['위험성평가'];
  if (!ws) return false;
  const g = grid(ws);
  return (g[0] ?? []).some((c) => str(c) === '평가ID');
}

/** CSV 바이트를 문자열로 디코딩 — UTF-8 우선, 실패 시 EUC-KR(한국어 엑셀 기본 인코딩) */
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('euc-kr').decode(buffer);
  }
}

/** 브라우저에서 읽은 파일(엑셀 xlsx/xls/xlsm/xlsb 또는 CSV)을 대시보드 데이터로 변환한다. */
export function parseWorkbook(buffer: ArrayBuffer, fileName: string): SafetyData {
  const wb = /\.csv$/i.test(fileName)
    ? XLSX.read(decodeCsv(buffer), { type: 'string', cellDates: true })
    : XLSX.read(buffer, { type: 'array', cellDates: true });

  if (isStandard(wb)) {
    const data = parseStandard(wb, fileName);
    if (data.risks.length === 0) {
      throw new Error("'위험성평가' 시트에 데이터가 없습니다. 파일을 확인해 주세요.");
    }
    return data;
  }

  const ledger = parseLedger(wb, fileName);
  if (ledger) return ledger;

  throw new Error(
    '위험성평가 데이터를 찾을 수 없습니다. 지원 양식: ① 표준 데이터 파일(위험성평가 시트에 평가ID 열) ② 통합 관리대장(회사(발주처) 열이 있는 표)',
  );
}
