'use client';

import { useEffect, useState } from 'react';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import { YNCC_VEHICLES_KEY, type YnccVehicle } from '@/lib/yncc';
import { TD_STICKY_POS, TH_STICKY } from './SheetUI';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 신청현황 — YNCC 작업차량 등록 현황 (차량번호 고정, 등록일자·등록자 수시 갱신) */
export default function YnccVehicles() {
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
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">🚚 YNCC 작업차량 등록 현황</h3>
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
                <th className={`px-4 py-2.5 font-semibold ${TH_STICKY}`}>차량번호</th>
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
                  <td
                    className={`${TD_STICKY_POS} ${plateSel === v.plate ? 'bg-sky-50' : 'bg-white'} px-4 py-2.5 font-bold text-slate-800`}
                  >
                    {v.plate}
                  </td>
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
    </div>
  );
}
