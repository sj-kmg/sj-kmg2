'use client';

import { useCallback, useRef, useState } from 'react';
import { parseWorkbook } from '@/lib/parse';
import type { SafetyData } from '@/lib/types';

export default function FileDrop({ onLoaded }: { onLoaded: (data: SafetyData) => void }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError('');
      if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
        setError('엑셀 파일(.xlsx)만 불러올 수 있습니다.');
        return;
      }
      setBusy(true);
      try {
        const buffer = await file.arrayBuffer();
        onLoaded(parseWorkbook(buffer, file.name));
      } catch (e) {
        setError(e instanceof Error ? e.message : '파일을 읽는 중 오류가 발생했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [onLoaded],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="엑셀 파일 선택"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'
        }`}
      >
        <div className="text-4xl">📂</div>
        <p className="mt-3 font-semibold text-slate-800">
          {busy ? '파일을 읽는 중…' : '안전관리 데이터 엑셀 파일을 여기에 끌어다 놓거나 클릭해서 선택'}
        </p>
        <p className="mt-1 text-sm text-slate-500">safety-data.xlsx (위험성평가·교육·점검·아차사고·일정)</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>
      )}
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span aria-hidden>🔒</span>
        <span>
          선택한 파일은 <b>이 브라우저 안에서만</b> 처리됩니다. 서버로 전송·저장되지 않으며, 데이터는 이
          컴퓨터의 브라우저 저장소(localStorage)에만 보관됩니다.
        </span>
      </p>
    </div>
  );
}
