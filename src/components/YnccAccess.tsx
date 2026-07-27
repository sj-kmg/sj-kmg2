'use client';

import { useEffect, useRef, useState } from 'react';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import {
  YNCC_NOTICE_DAYS,
  YNCC_VEHICLES_KEY,
  YNCC_WORKERS_KEY,
  type YnccVehicle,
  type YnccWorker,
} from '@/lib/yncc';

const GROUPS = ['직원', '인력'] as const;

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** YNCC출입 관리 — 작업자(직원·인력) 교육 시트 + 작업차량 등록 현황 */
export default function YnccAccess() {
  const [tab, setTab] = useState<'workers' | 'vehicles'>('workers');
  const tabBtn = (active: boolean) =>
    `rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-bold ${
      active ? 'border-slate-200 bg-white text-[#1f3864]' : 'border-transparent bg-slate-100 text-slate-400 hover:text-slate-600'
    }`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex gap-1">
        <button onClick={() => setTab('workers')} className={tabBtn(tab === 'workers')}>
          👷 작업자
        </button>
        <button onClick={() => setTab('vehicles')} className={tabBtn(tab === 'vehicles')}>
          🚚 작업차량
        </button>
      </div>
      <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-4 shadow-sm">
        {tab === 'workers' ? <WorkersSheet /> : <VehiclesSheet />}
      </div>
    </div>
  );
}

/* ---------------- 작업자 시트 ---------------- */

function WorkersSheet() {
  const { entries, mode, add, remove } = useSyncedLog<YnccWorker>('yncc-workers', YNCC_WORKERS_KEY);
  const [rows, setRows] = useState<YnccWorker[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);

  useEffect(() => setToday(new Date()), []);

  // 저장된 목록을 편집본으로 로드 — 편집 중(dirty)에는 덮어쓰지 않는다
  useEffect(() => {
    if (mode === 'loading' || dirty) return;
    setRows([...entries].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  }, [entries, mode, dirty]);

  const setRow = (id: string, patch: Partial<YnccWorker>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = (group: (typeof GROUPS)[number]) => {
    seq.current += 1;
    setRows((list) => [
      ...list,
      { id: `YW-${Date.now()}-${seq.current}`, group, name: '', birth: '', lastEdu: '', eduExpire: '', updatedAt: '' },
    ]);
    setDirty(true);
  };

  const removeRow = (id: string, name: string) => {
    if (name.trim() && !confirm(`[${name}] 행을 삭제할까요? 저장을 눌러야 반영됩니다.`)) return;
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
          orig.group !== r.group ||
          orig.name !== r.name.trim() ||
          orig.birth !== r.birth ||
          orig.lastEdu !== r.lastEdu ||
          orig.eduExpire !== r.eduExpire;
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

  const dday = (r: YnccWorker) => {
    if (!r.eduExpire || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.eduExpire, today);
    const level = noticeLevel(days, YNCC_NOTICE_DAYS);
    if (!level) return <span className="font-mono text-[11px] text-slate-400">D-{days}</span>;
    return (
      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${NOTICE_STYLE[level].badge}`}>
        {days < 0 ? `D+${-days}` : `D-${days}`}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">작업자 교육 관리</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
        {dirty && <span className="text-[11px] font-semibold text-orange-500">● 저장되지 않은 변경</span>}
      </div>

      {GROUPS.map((group) => {
        const groupRows = rows.filter((r) => r.group === group);
        return (
          <section key={group} className="mb-5">
            <p className="mb-1.5 text-xs font-bold text-slate-600">
              {group === '직원' ? '🧑‍💼 직원' : '👷 인력'}
              <span className="ml-1.5 font-normal text-slate-400">{groupRows.length}명</span>
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                    <th className="min-w-28 px-2 py-2 font-semibold">작업자명</th>
                    <th className="w-36 px-2 py-2 font-semibold">생년월일</th>
                    <th className="w-36 px-2 py-2 font-semibold">최근교육일</th>
                    <th className="w-36 px-2 py-2 font-semibold">교육유효종료일</th>
                    <th className="w-20 px-2 py-2 text-center font-semibold">D-day</th>
                    <th className="w-8 px-1 py-2" aria-label="행 삭제" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-300">
                        아래 ＋ 버튼으로 {group}을 추가해 주세요
                      </td>
                    </tr>
                  )}
                  {groupRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="작업자명" placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="생년월일" type="date" value={r.birth} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="최근교육일" type="date" value={r.lastEdu} onChange={(e) => setRow(r.id, { lastEdu: e.target.value })} className={cell} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input aria-label="교육유효종료일" type="date" value={r.eduExpire} onChange={(e) => setRow(r.id, { eduExpire: e.target.value })} className={cell} />
                      </td>
                      <td className="px-2 py-1.5 text-center">{dday(r)}</td>
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
            <button
              onClick={() => addRow(group)}
              className="mt-2 rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
            >
              ＋ {group} 추가
            </button>
          </section>
        );
      })}

      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
        <button
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="rounded-lg bg-[#1f3864] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a4a80] disabled:opacity-50"
        >
          {saving ? '저장 중…' : '변경사항 저장'}
        </button>
        {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        교육유효종료일 {YNCC_NOTICE_DAYS}일 전부터 메인 화면 [안전교육 현황]에 해당 작업자가 표시됩니다. 행을 수정·추가한
        뒤 반드시 [변경사항 저장]을 눌러주세요.
      </p>
    </div>
  );
}

/* ---------------- 작업차량 시트 ---------------- */

function VehiclesSheet() {
  const { entries, mode, add, remove } = useSyncedLog<YnccVehicle>('yncc-vehicles', YNCC_VEHICLES_KEY);
  const [plateSel, setPlateSel] = useState(''); // '' = 신규 차량
  const [plateNew, setPlateNew] = useState('');
  const [regDate, setRegDate] = useState('');
  const [registrant, setRegistrant] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setRegDate(todayStr()), []);

  const vehicles = [...entries].sort((a, b) => a.plate.localeCompare(b.plate, 'ko'));

  // 기존 차량 선택 시 현재 등록 내용을 입력창에 불러온다
  const selectPlate = (plate: string) => {
    setPlateSel(plate);
    const v = entries.find((e) => e.plate === plate);
    if (v) {
      setRegDate(v.regDate || todayStr());
      setRegistrant(v.registrant);
    } else {
      setRegDate(todayStr());
      setRegistrant('');
    }
  };

  const submit = async () => {
    const plate = (plateSel || plateNew).trim();
    if (!plate) {
      alert('차량번호를 선택하거나 새로 입력해 주세요.');
      return;
    }
    if (!regDate || !registrant.trim()) {
      alert('등록일자와 차량 등록자를 입력해 주세요.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const existing = entries.find((v) => v.plate === plate);
      const entry: YnccVehicle = {
        id: existing?.id ?? `YV-${Date.now()}`,
        plate,
        regDate,
        registrant: registrant.trim(),
        updatedAt: new Date().toISOString(),
      };
      if (!(await add(entry))) return;
      setPlateSel(plate); // 방금 등록한 차량을 선택 상태로 유지
      setPlateNew('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const removeVehicle = async (v: YnccVehicle) => {
    if (!confirm(`차량 [${v.plate}]을(를) 목록에서 삭제할까요?`)) return;
    await remove(v.id);
    if (plateSel === v.plate) {
      setPlateSel('');
      setRegistrant('');
      setRegDate(todayStr());
    }
  };

  const badge = modeBadge(mode);
  const input =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';
  const label = 'mb-1 block text-xs font-semibold text-slate-500';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">작업차량 등록 현황</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>

      {/* 입력창 — 차량번호는 고정, 등록일자·등록자만 갱신 */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <label className={label} htmlFor="yv-sel">차량 선택</label>
            <select id="yv-sel" value={plateSel} onChange={(e) => selectPlate(e.target.value)} className={`${input} w-full`}>
              <option value="">＋ 신규 차량</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.plate}>{v.plate}</option>
              ))}
            </select>
          </div>
          {plateSel === '' && (
            <div>
              <label className={label} htmlFor="yv-new">새 차량번호</label>
              <input id="yv-new" placeholder="예: 12가3456" value={plateNew} onChange={(e) => setPlateNew(e.target.value)} className={`${input} w-full`} />
            </div>
          )}
          <div>
            <label className={label} htmlFor="yv-date">등록일자</label>
            <input id="yv-date" type="date" value={regDate} onChange={(e) => setRegDate(e.target.value)} className={`${input} w-full`} />
          </div>
          <div>
            <label className={label} htmlFor="yv-reg">차량 등록자</label>
            <input id="yv-reg" placeholder="예: 김민규" value={registrant} onChange={(e) => setRegistrant(e.target.value)} className={`${input} w-full`} />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="rounded-lg bg-[#1f3864] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a80] disabled:opacity-50"
            >
              {saving ? '저장 중…' : plateSel ? '갱신' : '등록'}
            </button>
            {saved && <span className="pb-2 text-sm font-medium text-green-600">✓</span>}
          </div>
        </div>
      </div>

      {/* 차량 전체 현황 — 입력하면 아래 내용이 바로 갱신된다 */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-semibold">차량번호</th>
              <th className="px-4 py-2.5 font-semibold">등록일자</th>
              <th className="px-4 py-2.5 font-semibold">차량 등록자</th>
              <th className="px-4 py-2.5 font-semibold">최근 변경</th>
              <th className="w-10 px-2 py-2.5" aria-label="삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-300">
                  {mode === 'loading' ? '불러오는 중…' : '등록된 차량이 없습니다. 위 입력창에서 차량을 등록해 주세요.'}
                </td>
              </tr>
            )}
            {vehicles.map((v) => (
              <tr
                key={v.id}
                className={`cursor-pointer hover:bg-sky-50/50 ${plateSel === v.plate ? 'bg-sky-50' : ''}`}
                onClick={() => selectPlate(v.plate)}
                title="클릭하면 위 입력창에 불러와 갱신할 수 있습니다"
              >
                <td className="px-4 py-2.5 font-bold text-slate-800">{v.plate}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{v.regDate}</td>
                <td className="px-4 py-2.5 text-slate-700">{v.registrant}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                  {v.updatedAt ? new Date(v.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <button
                    aria-label={`${v.plate} 삭제`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeVehicle(v);
                    }}
                    className="text-slate-300 hover:text-red-500"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        차량번호는 고정이고 등록일자·차량 등록자만 수시로 갱신됩니다. 표에서 차량을 클릭하면 위 입력창으로 불러와 바로
        갱신할 수 있습니다.
      </p>
    </div>
  );
}
