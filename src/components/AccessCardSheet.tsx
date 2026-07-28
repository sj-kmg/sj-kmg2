'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS_KEY, CARD_NOTICE_DAYS, accessCardSeed, cardEndDate, type AccessCard } from '@/lib/cards';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';

/**
 * 신청현황 — 상시카드 관리 시트.
 * 발급일자 입력 시 종료일자(발급일 + 1년 - 1일)가 자동 입력되고, 종료 100일 전부터 D-day가 표시된다.
 */
export default function AccessCardSheet() {
  const { entries, mode, add, remove } = useSyncedLog<AccessCard>('cards', CARDS_KEY);
  const seed = useMemo(() => accessCardSeed(), []);
  const [rows, setRows] = useState<AccessCard[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  useEffect(() => {
    if (mode === 'loading' || dirty) return;
    const savedIds = new Set(entries.map((e) => e.id));
    const pending = seed.filter((s) => !savedIds.has(s.id));
    setRows([...entries, ...pending].sort((a, b) => (a.issueDate || '9999').localeCompare(b.issueDate || '9999')));
  }, [entries, mode, dirty, seed]);

  const setRow = (id: string, patch: Partial<AccessCard>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    seq.current += 1;
    setRows((list) => [
      ...list,
      {
        id: `AC-${Date.now()}-${seq.current}`,
        name: '',
        applyType: '신규',
        issueDate: '',
        endDate: '',
        loginId: '',
        password: '',
        updatedAt: '',
      },
    ]);
    setDirty(true);
  };

  const removeRow = (id: string, name: string) => {
    if (name.trim() && !confirm(`[${name}] 행을 삭제할까요? [변경사항 저장]을 눌러야 반영됩니다.`)) return;
    setRows((list) => list.filter((r) => r.id !== id));
    if (entries.some((e) => e.id === id)) setRemovedIds((l) => [...l, id]);
    setDirty(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      for (const id of removedIds) {
        await remove(id);
      }
      for (const r of rows) {
        if (!r.name.trim()) continue;
        const orig = entries.find((e) => e.id === r.id);
        const changed =
          !orig ||
          orig.name !== r.name.trim() ||
          orig.applyType !== r.applyType ||
          orig.issueDate !== r.issueDate ||
          orig.endDate !== r.endDate ||
          orig.loginId !== r.loginId ||
          orig.password !== r.password ||
          (orig.note ?? '') !== (r.note ?? '');
        if (changed) {
          await add({ ...r, name: r.name.trim(), updatedAt: new Date().toISOString() });
        }
      }
      setRemovedIds([]);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const badge = modeBadge(mode);
  const cell =
    'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none';

  const pendingCount = rows.filter((r) => r.name.trim() && !entries.some((e) => e.id === r.id)).length;

  const dday = (r: AccessCard) => {
    if (!r.endDate || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.endDate, today);
    const level = noticeLevel(days, CARD_NOTICE_DAYS);
    if (!level) return <span className="font-mono text-[11px] text-slate-400">D-{days}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>
        {days < 0 ? `D+${-days}` : `D-${days}`}
      </span>
    );
  };

  return (
    <div>
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            💳 상시카드 신청현황
            <span className="ml-1.5 font-normal text-slate-400">{rows.length}명</span>
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          {dirty && <span className="text-[11px] font-semibold text-orange-500">● 저장되지 않은 변경</span>}
          {!dirty && pendingCount > 0 && (
            <span className="text-[11px] text-slate-400">기존 현황 {pendingCount}명 — [변경사항 저장]을 누르면 등록됩니다</span>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[880px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className="min-w-24 px-2 py-2 font-semibold">성명</th>
                <th className="w-24 px-2 py-2 font-semibold">신청구분</th>
                <th className="w-36 px-2 py-2 font-semibold">출입시작일</th>
                <th className="w-36 px-2 py-2 font-semibold">출입종료일</th>
                <th className="w-28 px-2 py-2 font-semibold">아이디</th>
                <th className="w-32 px-2 py-2 font-semibold">비밀번호</th>
                <th className="w-20 px-2 py-2 text-center font-semibold">D-day</th>
                <th className="min-w-20 px-2 py-2 font-semibold">비고</th>
                <th className="w-8 px-1 py-2" aria-label="행 삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-slate-300">
                    아래 ＋ 버튼으로 상시카드 대상자를 추가해 주세요
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="성명" placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={cell} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <select
                      aria-label="신청구분"
                      value={r.applyType}
                      onChange={(e) => setRow(r.id, { applyType: e.target.value as AccessCard['applyType'] })}
                      className={cell}
                    >
                      <option value="신규">신규</option>
                      <option value="연장">연장</option>
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input
                      aria-label="출입시작일"
                      type="date"
                      value={r.issueDate}
                      onChange={(e) => setRow(r.id, { issueDate: e.target.value, endDate: r.endDate || cardEndDate(e.target.value) })}
                      className={cell}
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="출입종료일" type="date" value={r.endDate} onChange={(e) => setRow(r.id, { endDate: e.target.value })} className={cell} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="아이디" placeholder="ID" value={r.loginId} onChange={(e) => setRow(r.id, { loginId: e.target.value })} className={cell} autoComplete="off" />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        aria-label="비밀번호"
                        type={showPw[r.id] ? 'text' : 'password'}
                        placeholder="PW"
                        value={r.password}
                        onChange={(e) => setRow(r.id, { password: e.target.value })}
                        className={cell}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        aria-label={showPw[r.id] ? '비밀번호 숨기기' : '비밀번호 보기'}
                        onClick={() => setShowPw((m) => ({ ...m, [r.id]: !m[r.id] }))}
                        className="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:text-[#1f3864]"
                      >
                        {showPw[r.id] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                  <td className="px-1.5 py-1.5">
                    <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={cell} />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button aria-label="행 삭제" onClick={() => removeRow(r.id, r.name)} className="text-slate-300 hover:text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={addRow}
            className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            ＋ 대상자 추가
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || (!dirty && pendingCount === 0)}
            className="rounded-lg bg-[#1f3864] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a4a80] disabled:opacity-50"
          >
            {saving ? '저장 중…' : '변경사항 저장'}
          </button>
          {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          출입시작일을 입력하면 종료일(시작일 + 1년 - 1일)이 자동 입력되며, 갱신 시 직접 수정할 수 있습니다. 종료
          {CARD_NOTICE_DAYS}일 전부터 이 화면과 메인 [공무관리 현황]에 D-day가 표시됩니다.
        </p>
      </div>
    </div>
  );
}
