'use client';

import { riskProduct } from '@/lib/risk';

/**
 * 위험성평가 참고·결과 표.
 * - RiskEstimationGuide: 위험성 추정결정표 (빈도·강도·위험도 산출표·Risk Level) — 페이지 하단 상시 표시
 * - RiskResultSummary: 위험등급결정 및 개선대책 수립현황 — 저장된 평가별 자동 집계
 */

/** 결과표 등급 구간 (위험등급표 기준) */
const BUCKETS = [
  { grade: 'ii', range: '16~20', name: '중대위험', min: 16, max: 20, bg: '#ff0000', ink: '#ffffff' },
  { grade: 'iii', range: '9~15', name: '보통위험', min: 9, max: 15, bg: '#f4b183', ink: '#3b2300' },
  { grade: 'iv', range: '7~8', name: '수용가능', min: 7, max: 8, bg: '#8db4e2', ink: '#1f3864' },
  { grade: 'v', range: '1~6', name: '안전수준', min: 1, max: 6, bg: '#deeaf6', ink: '#1f3864' },
];

const td = 'border border-slate-300 px-2 py-1.5';

interface SummaryRow {
  freq1: string;
  sev1: string;
  freq2: string;
  sev2: string;
  action: string;
}

/** 위험등급결정 및 개선대책 수립현황 — 평가 항목에서 자동 집계 */
export function RiskResultSummary({ rows }: { rows: SummaryRow[] }) {
  const cur = rows.map((r) => riskProduct(r.freq1, r.sev1)).filter((v): v is number => v !== null);
  const post = rows.map((r) => riskProduct(r.freq2, r.sev2)).filter((v): v is number => v !== null);
  const actions = rows.filter((r) => r.action.trim()).length;
  const count = (list: number[], min: number, max: number) => list.filter((v) => v >= min && v <= max).length;

  const gradeHeader = BUCKETS.map((b) => (
    <th key={b.grade} className={`${td} w-[19%] font-medium text-slate-600`}>
      {b.grade}
      <span className="block text-[10px] font-normal text-slate-500">({b.range})</span>
      <span className="block text-[10px] font-normal text-slate-500">({b.name})</span>
    </th>
  ));
  const countRow = (list: number[]) =>
    BUCKETS.map((b) => {
      const n = count(list, b.min, b.max);
      return (
        <td key={b.grade} className={`${td} font-bold`} style={{ background: b.bg, color: b.ink }}>
          {n > 0 ? n : ''}
        </td>
      );
    });

  return (
    <table className="mt-3 w-full border-collapse text-center text-[11px]">
      <tbody>
        <tr>
          <th colSpan={6} className={`${td} bg-slate-50 py-2 text-xs font-bold text-slate-700`}>
            위험등급결정 및 개선대책 수립현황
          </th>
        </tr>
        <tr>
          <th rowSpan={7} className={`${td} w-8 bg-white font-semibold text-slate-600`}>
            <span style={{ writingMode: 'vertical-rl', letterSpacing: '0.3em' }}>위험등급표</span>
          </th>
          <th className={`${td} font-medium text-slate-600`}>총위험요인수</th>
          <td className={`${td} font-bold text-slate-800`} style={{ background: '#ffff00' }}>{cur.length}</td>
          <th colSpan={2} className={`${td} font-medium text-slate-600`}>개선대책수</th>
          <td className={`${td} font-bold text-slate-800`} style={{ background: '#ffc000' }}>{actions}</td>
        </tr>
        <tr>
          <td colSpan={5} className={`${td} text-left text-slate-600`}>개선전 위험등급별 요인수</td>
        </tr>
        <tr>
          <th className={`${td} font-medium text-slate-600`}>등급</th>
          {gradeHeader}
        </tr>
        <tr>
          <th className={`${td} font-medium text-slate-600`}>요인수</th>
          {countRow(cur)}
        </tr>
        <tr>
          <td colSpan={5} className={`${td} text-left text-slate-600`}>개선후 위험등급별 요인수</td>
        </tr>
        <tr>
          <th className={`${td} font-medium text-slate-600`}>등급</th>
          {gradeHeader}
        </tr>
        <tr>
          <th className={`${td} font-medium text-slate-600`}>요인수</th>
          {countRow(post)}
        </tr>
      </tbody>
    </table>
  );
}

/** 산출표 셀 색 — 첨부 산출표 기준 (20 빨강 · 13~16 파랑 · 7~12 노랑) */
function matrixStyle(v: number): React.CSSProperties {
  if (v >= 17) return { background: '#ff0000', color: '#ffffff', fontWeight: 700 };
  if (v >= 13) return { background: '#8db4e2', color: '#1f3864', fontWeight: 700 };
  if (v >= 7) return { background: '#ffff00', color: '#3b2300', fontWeight: 700 };
  return {};
}

function SectionBar({ tone, children }: { tone: 'blue' | 'orange'; children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 rounded px-2 py-1.5 text-center text-xs font-bold text-slate-800"
      style={{ background: tone === 'blue' ? '#bdd7ee' : '#ffd966' }}
    >
      {children}
    </p>
  );
}

const FREQ = [
  ['빈번함', '5', '1일 1회 정도 발생할 경우'],
  ['가능성 높음', '4', '1개월 1회 정도 발생할 경우'],
  ['가능성 있음', '3', '1년 1회 정도 발생할 경우'],
  ['가끔 낮음', '2', '3년 1회 정도 발생할 경우'],
  ['가능성 거의 없음', '1', '10년 1회 정도 발생할 경우'],
];

const SEV = [
  ['중대재해', '4', '사망 또는 노동력 상실재해를 가져오는 치명적인 재해인 경우 또는 치명적으로 예상되는 경우'],
  ['경미한 휴업재해', '3', '휴업재해인 경우 또는 휴업재해가 발생될 것으로 예상되는 경우'],
  ['경미한 불휴업재해', '2', '경미한 재해를 포함한 불휴업재해인 경우 또는 불휴업재해로 예상되는 경우'],
  ['영향없음', '1', '재해로 인한 인적 손실이 없는 경우 또는 없을 것이라 예상되는 경우'],
];

const MATRIX_ROWS = [
  ['최상', 5],
  ['상시 있음', 4],
  ['중', 3],
  ['하', 2],
  ['최하', 1],
] as const;

const SEV_COLS = [
  ['최대', 4],
  ['대', 3],
  ['중', 2],
  ['소', 1],
] as const;

/** Risk Level 행 — [범위, Level(rowSpan), 위험수준, 관리기준, 비고(rowSpan)] */
const LEVELS: {
  range: string;
  level?: { text: string; span: number };
  name: string;
  standard: string;
  note?: { text: string; span: number };
  bg: string;
  ink: string;
}[] = [
  {
    range: '16~20',
    level: { text: 'D', span: 1 },
    name: '허용불가 위험',
    standard: '작업 즉시 중단 / 작업을 지속하려면 즉시 시설개선을 실시해야 하는 위험',
    note: { text: '위험작업 불허 (즉시 작업을 중지하여야 함)', span: 1 },
    bg: '#ff0000',
    ink: '#ffffff',
  },
  {
    range: '13~15',
    level: { text: 'C', span: 1 },
    name: '중대한 위험',
    standard: '긴급 임시안전대책을 세운 후 작업을 하되 계획된 정기 보수기간에 설비개선 등 안전대책을 세워야 하는 위험',
    note: { text: '조건부 위험 작업수용 (위험이 없으면 작업을 계속하되, 위험감소 활동을 실시해야 함)', span: 3 },
    bg: '#8db4e2',
    ink: '#1f3864',
  },
  {
    range: '9~12',
    level: { text: 'B', span: 2 },
    name: '상당한 위험',
    standard: '계획된 정기 보수기간에 설비개선 등 위험 감소 대책을 세워야 하는 위험',
    bg: '#ffff00',
    ink: '#3b2300',
  },
  {
    range: '7~8',
    name: '경미한 위험',
    standard: '위험의 표지부착·작업절차서 표기를 통한 관리대책이 필요한 위험',
    bg: '#ffff00',
    ink: '#3b2300',
  },
  {
    range: '3~6',
    level: { text: 'A', span: 2 },
    name: '미미한 위험',
    standard: '안전정보 및 주기적 표준작업 안전교육의 제공이 필요한 위험',
    note: { text: '위험작업을 수용함 (현상태로 계속 작업가능)', span: 2 },
    bg: '#ffffff',
    ink: '#334155',
  },
  {
    range: '1~2',
    name: '무시할 수 있는 위험',
    standard: '현재의 안전 대책 유지',
    bg: '#ffffff',
    ink: '#334155',
  },
];

/** 위험성 추정결정표 — 빈도(F)·강도(S)·위험도 산출표·Risk Level */
export default function RiskEstimationGuide() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-center text-sm font-bold text-slate-700">위험성 추정결정표</h3>
      <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
        {/* 1. 빈도 */}
        <div>
          <SectionBar tone="blue">1. 위험발생 빈도(F)</SectionBar>
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className={`${td} w-28 font-semibold`}>빈도구분</th>
                <th className={`${td} w-16 font-semibold`}>빈도수준</th>
                <th className={`${td} font-semibold`}>내용</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {FREQ.map(([a, b, c]) => (
                <tr key={b}>
                  <td className={td}>{a}</td>
                  <td className={`${td} font-bold`}>{b}</td>
                  <td className={`${td} text-left`}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            ※ 빈도결정: 과거의 재해발생(공사 등) 내용과 사업장 특성, 기계·설비의 사용빈도 및 향후 예상되는 빈도를
            고려하여 결정
          </p>
        </div>

        {/* 3. 위험도 산출표 */}
        <div>
          <SectionBar tone="blue">3. 위험도 산출표</SectionBar>
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th colSpan={2} className={`${td} font-semibold`}>
                  가능성(빈도) ＼ 중대성(강도)
                </th>
                {SEV_COLS.map(([name, n]) => (
                  <th key={n} className={`${td} w-[13%] font-semibold`}>
                    {name}
                    <span className="block font-bold">{n}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {MATRIX_ROWS.map(([name, f]) => (
                <tr key={f}>
                  <td className={`${td} bg-slate-50`}>{name}</td>
                  <td className={`${td} bg-slate-50 font-bold`}>{f}</td>
                  {SEV_COLS.map(([, s]) => (
                    <td key={s} className={td} style={matrixStyle(f * s)}>
                      {f * s}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 2. 강도 */}
        <div>
          <SectionBar tone="blue">2. 위험발생 강도(S)</SectionBar>
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className={`${td} w-28 font-semibold`}>강도구분</th>
                <th className={`${td} w-16 font-semibold`}>강도수준</th>
                <th className={`${td} font-semibold`}>내용</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {SEV.map(([a, b, c]) => (
                <tr key={b}>
                  <td className={td}>{a}</td>
                  <td className={`${td} font-bold`}>{b}</td>
                  <td className={`${td} text-left`}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Risk Level */}
        <div>
          <SectionBar tone="orange">4. Risk Level</SectionBar>
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th colSpan={3} className={`${td} font-semibold`}>위험수준</th>
                <th className={`${td} font-semibold`}>관리기준</th>
                <th className={`${td} w-24 font-semibold`}>비고</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {LEVELS.map((l) => (
                <tr key={l.range}>
                  <td className={`${td} w-14 font-bold`} style={{ background: l.bg, color: l.ink }}>
                    {l.range}
                  </td>
                  {l.level && (
                    <td
                      rowSpan={l.level.span}
                      className={`${td} w-10 font-bold`}
                      style={{ background: l.bg, color: l.ink }}
                    >
                      {l.level.text}
                    </td>
                  )}
                  <td className={`${td} w-28`} style={{ background: l.bg, color: l.ink }}>
                    {l.name}
                  </td>
                  <td className={`${td} text-left`} style={{ background: l.bg, color: l.ink }}>
                    {l.standard}
                  </td>
                  {l.note && (
                    <td rowSpan={l.note.span} className={`${td} text-[10px] text-slate-500`}>
                      {l.note.text}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
