'use client';

/**
 * 메뉴 내용을 엑셀로 저장하고 인쇄한다 — A4 용지 기준.
 *
 * 엑셀과 인쇄물이 **같은 표**여야 해서 한곳에서 만든다.
 * 엑셀은 exceljs로 굽고(테두리·머리글 색·A4 용지설정까지), 인쇄는 같은 자료로
 * A4 크기의 인쇄용 화면을 만들어 브라우저 인쇄에 넘긴다.
 * 엑셀 파일을 열지 않고도 화면에서 바로 인쇄할 수 있고, 결과물 모양은 같다.
 */

export interface ExportColumn<T> {
  /** 머리글에 적히는 이름 */
  label: string;
  /** 글자 수 기준 너비 — 비우면 머리글 길이에 맞춘다 */
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** 이 칸에 들어갈 값 — 빈 값은 '' 로 */
  value: (row: T) => string;
}

export interface ExportSpec<T> {
  /** 표 위에 크게 적히는 제목 — 파일 이름으로도 쓴다 */
  title: string;
  /** 제목 아래 한 줄 설명 (기준일 등) */
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /** 칸이 많아 세로로 안 들어가면 가로로 눕힌다 */
  landscape?: boolean;
}

/** ㈜신정개발 대시보드 색 — 머리글 남색 */
const HEADER_BG = 'FF1F3864';
const BORDER = 'FFBFBFBF';
const STRIPE = 'FFF4F6FA';

function today(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 파일 이름에 쓸 수 없는 글자를 걷어낸다 */
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').trim() || '내보내기';
}

function widthOf<T>(col: ExportColumn<T>, rows: T[]): number {
  if (col.width) return col.width;
  // 한글은 자리를 두 배 차지한다 — 가장 긴 값에 맞춰 잡되 너무 넓어지지 않게 자른다
  const len = (s: string) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  const longest = rows.reduce((m, r) => Math.max(m, len(col.value(r) || '')), len(col.label));
  return Math.min(Math.max(longest + 3, 8), 40);
}

/** 엑셀 파일로 저장 — A4 용지에 맞춰 굽는다 */
export async function downloadExcel<T>(spec: ExportSpec<T>): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '㈜신정개발 안전관리 대시보드';
  wb.created = new Date();

  const ws = wb.addWorksheet(safeName(spec.title).slice(0, 28), {
    pageSetup: {
      paperSize: 9, // A4
      orientation: spec.landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0, // 세로는 여러 장으로 나뉘어도 된다
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      // 여러 장이 되면 머리글을 각 장마다 반복한다
      printTitlesRow: '3:3',
    },
    headerFooter: { oddFooter: '&C&P / &N' },
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const cols = spec.columns;
  ws.columns = cols.map((c) => ({ width: widthOf(c, spec.rows) }));

  // 1행: 제목
  ws.mergeCells(1, 1, 1, cols.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = spec.title;
  titleCell.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: HEADER_BG } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  // 2행: 기준일 등
  ws.mergeCells(2, 1, 2, cols.length);
  const subCell = ws.getCell(2, 1);
  subCell.value = spec.subtitle ? `${spec.subtitle}   ·   기준일 ${today()}` : `기준일 ${today()}`;
  subCell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF808080' } };
  subCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 16;

  // 3행: 머리글
  const head = ws.getRow(3);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.label;
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  head.height = 22;

  // 4행부터: 내용
  spec.rows.forEach((row, n) => {
    const r = ws.getRow(4 + n);
    cols.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      cell.value = c.value(row) || '';
      cell.font = { name: '맑은 고딕', size: 10 };
      cell.alignment = { horizontal: c.align ?? 'center', vertical: 'middle', wrapText: true };
      if (n % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } };
      }
    });
    r.height = 20;
  });

  // 테두리 — 머리글부터 마지막 줄까지
  const last = 3 + spec.rows.length;
  for (let rr = 3; rr <= last; rr += 1) {
    for (let cc = 1; cc <= cols.length; cc += 1) {
      ws.getCell(rr, cc).border = {
        top: { style: 'thin', color: { argb: BORDER } },
        left: { style: 'thin', color: { argb: BORDER } },
        bottom: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } },
      };
    }
  }
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: last, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(spec.title)}_${today()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 인쇄 — 엑셀과 같은 표를 A4 인쇄용으로 띄운다.
 * 별도 창을 열어 그 창만 인쇄하므로, 대시보드 화면은 인쇄물에 섞이지 않는다.
 */
export function printSpec<T>(spec: ExportSpec<T>): void {
  const cols = spec.columns;
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = spec.rows
    .map(
      (row) =>
        `<tr>${cols
          .map((c) => `<td style="text-align:${c.align ?? 'center'}">${esc(c.value(row) || '')}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const sub = spec.subtitle ? `${esc(spec.subtitle)} &middot; ` : '';

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(spec.title)}</title>
<style>
  @page { size: A4 ${spec.landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "맑은 고딕", "Malgun Gothic", sans-serif; color: #111; }
  h1 { margin: 0 0 2mm; font-size: 16pt; color: #1f3864; text-align: center; }
  .sub { margin: 0 0 4mm; font-size: 8pt; color: #888; text-align: right; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 0.4pt solid #bfbfbf; padding: 1.6mm 1.2mm; font-size: 9pt; word-break: break-word; }
  th { background: #1f3864; color: #fff; font-weight: 700; }
  /* 표가 여러 장으로 넘어가도 머리글이 매 장 위에 다시 찍힌다 */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f4f6fa; }
  .empty { padding: 20mm 0; text-align: center; color: #999; font-size: 10pt; }
</style></head><body>
<h1>${esc(spec.title)}</h1>
<p class="sub">${sub}기준일 ${today()}</p>
${spec.rows.length ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` : '<p class="empty">내용이 없습니다.</p>'}
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    alert('인쇄 창이 열리지 않았습니다. 브라우저의 팝업 차단을 풀어 주세요.');
    return;
  }
  win.document.write(html);
  win.document.close();
  // 글꼴·표가 다 그려진 뒤 인쇄 대화상자를 띄운다
  win.onload = () => {
    win.focus();
    win.print();
  };
}
