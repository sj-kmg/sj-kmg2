import * as XLSX from 'xlsx';
import type {
  SafetyData, RiskRow, TaskRow, EduRow, InspRow, IncidentRow, ScheduleRow,
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

function sheetRows(wb: XLSX.WorkBook, name: string, required = false): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) {
    if (required) throw new Error(`필수 시트 '${name}'을(를) 찾을 수 없습니다. 파일 양식을 확인해 주세요.`);
    return [];
  }
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
}

function parseRisks(wb: XLSX.WorkBook): RiskRow[] {
  return sheetRows(wb, '위험성평가', true)
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
        stage: str(r['작업단계']),
        group: str(r['작업절차']),
        sub: str(r['세부작업']),
        hazard: str(r['유해위험요인']),
        dtype: str(r['재해형태']),
        measure: str(r['현재안전보건조치']),
        f, s, r: rv,
        grade: str(r['위험등급']) || gradeOf(rv)?.key || '',
        improvement: str(r['개선대책']),
        f2, s2, r2,
        grade2: str(r['개선후위험등급']) || gradeOf(r2)?.key || '',
        status: str(r['개선상태']),
        due: dateStr(r['개선기한']),
        done: dateStr(r['개선완료일']),
        note: str(r['비고']),
      };
    });
}

function parseTasks(wb: XLSX.WorkBook, risks: RiskRow[]): TaskRow[] {
  return sheetRows(wb, '작업목록', true)
    .filter((r) => str(r['작업ID']) !== '')
    .map((r) => {
      const id = str(r['작업ID']);
      const mine = risks.filter((k) => k.taskId === id && k.r !== null);
      const rs = mine.map((k) => k.r as number);
      const r2s = risks
        .filter((k) => k.taskId === id && k.r2 !== null)
        .map((k) => k.r2 as number);
      const avg = (xs: number[]) =>
        xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
      return {
        id,
        name: str(r['작업명']),
        desc: str(r['작업내용']),
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

/** 브라우저에서 읽은 엑셀 파일(ArrayBuffer)을 대시보드 데이터로 변환한다. */
export function parseWorkbook(buffer: ArrayBuffer, fileName: string): SafetyData {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const risks = parseRisks(wb);
  if (risks.length === 0) {
    throw new Error("'위험성평가' 시트에 데이터가 없습니다. 파일을 확인해 주세요.");
  }
  return {
    meta: parseMeta(wb),
    risks,
    tasks: parseTasks(wb, risks),
    edu: parseEdu(wb),
    insp: parseInsp(wb),
    incidents: parseIncidents(wb),
    schedule: parseSchedule(wb),
    fileName,
    loadedAt: new Date().toISOString(),
  };
}
