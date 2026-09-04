'use client';

import { useState } from 'react';
import { downloadExcel, printSpec, type ExportSpec } from '@/lib/sheetExport';

/**
 * 메뉴 내용을 [엑셀 저장]·[인쇄]하는 버튼 한 쌍.
 *
 * 두 버튼이 **같은 표**를 쓴다 — 인쇄물은 엑셀 파일과 같은 제목·같은 칸·같은 순서로
 * A4에 맞춰 나온다. 화면에 보이는 그대로(정렬·검색이 적용된 상태)를 넘기면 된다.
 */
export default function SheetExport<T>({ spec, className }: { spec: () => ExportSpec<T>; className?: string }) {
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await downloadExcel(spec());
    } catch (e) {
      console.error('엑셀 저장 실패:', e);
      alert('엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const btn =
    'rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864] disabled:opacity-50';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <button onClick={() => void save()} disabled={busy} className={btn} title="A4 용지에 맞춘 엑셀 파일로 저장합니다">
        {busy ? '만드는 중…' : '⤓ 엑셀 저장'}
      </button>
      <button onClick={() => printSpec(spec())} className={btn} title="엑셀과 같은 표를 A4로 인쇄합니다">
        🖨 인쇄
      </button>
    </span>
  );
}
