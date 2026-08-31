'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTICE_STYLE, daysUntil, noticeLevel } from '@/lib/education';
import {
  HEALTH_KEY,
  HEALTH_LABEL,
  HEALTH_NOTICE_DAYS,
  healthGeneralSeed,
  healthRenewDate,
  healthSpecialSeed,
  type HealthCheck,
} from '@/lib/health';
import {
  HAZARD_CYCLE_MONTHS,
  WATCHED_HAZARDS,
  applyHazardCheck,
  hazardStatuses,
  mostUrgentHazard,
  watchedHazardsIn,
  type HazardWatch,
} from '@/lib/hazardWatch';
import { SyncError, extractDocFields, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { modeBadge } from '@/lib/useSyncedLog';
import { useSortable } from '@/lib/useSortable';
import { CELL, SheetToolbar, SortButton, TD_STICKY, TH, TH_STICKY } from './SheetUI';
import { fileHref } from '@/lib/ids';


function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 건강검진(일반·특수) 시트 — 직원 명부.
 * 검진일자를 입력하면 갱신일자(1년 후)가 자동 입력되고, 결과서(이수증)를 첨부·교체할 수 있다.
 * 값을 바꾸면 자동 저장되며 [되돌리기]로 직전 상태로 복구할 수 있다.
 *
 * 인력은 [공무관리 > 인력관리]에서 인력소별로 관리하므로 여기서는 다루지 않는다.
 */
export default function HealthCheckSheet({ kind }: { kind: HealthCheck['kind'] }) {
  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Sheet kind={kind} group="직원" />
      </div>
    </div>
  );
}

/**
 * 유해인자별 갱신 표시 — 물질마다 마지막 검진일과 다음 검진일(D-day)을 함께 보여 준다.
 * 벤젠만 다시 받은 경우처럼 물질별로 날짜가 달라질 수 있어 각각 고칠 수 있게 둔다.
 */
function HazardCell({
  row,
  today,
  onChange,
}: {
  row: HealthCheck;
  today: Date | null;
  onChange: (next: HazardWatch[]) => void;
}) {
  const byName = new Map((row.hazards ?? []).map((h) => [h.name, h.checkedAt]));
  const statuses = new Map(hazardStatuses(row.hazards, today).map((s) => [s.name, s]));

  const setOne = (name: string, checkedAt: string) => {
    const rest = (row.hazards ?? []).filter((h) => h.name !== name);
    onChange(checkedAt ? [...rest, { name, checkedAt }] : rest);
  };

  return (
    <div className="space-y-1">
      {WATCHED_HAZARDS.map((name) => {
        const checkedAt = byName.get(name) ?? '';
        const s = statuses.get(name);
        return (
          <div key={name} className="flex items-center gap-1">
            <span className="w-11 shrink-0 text-[10px] font-bold text-slate-500" title={`${HAZARD_CYCLE_MONTHS[name]}개월 주기`}>
              {name}
            </span>
            <input
              type="date"
              aria-label={`${row.name || '행'} ${name} 검진일`}
              value={checkedAt}
              onChange={(e) => setOne(name, e.target.value)}
              className="w-[8.5rem] rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] text-slate-800 focus:border-[#1f3864] focus:outline-none"
            />
            {s ? (
              <span
                className={`rounded px-1 py-0.5 font-mono text-[10px] font-bold ${
                  s.level ? NOTICE_STYLE[s.level].badge : 'text-slate-400'
                }`}
                title={`다음 검진 ${s.renewAt} (${s.months}개월 주기)`}
              >
                {s.days < 0 ? `D+${-s.days}` : `D-${s.days}`}
              </span>
            ) : (
              <span className="text-[10px] text-slate-300">—</span>
            )}
          </div>
        );
      })}
      {row.recheckCert && (
        <a
          href={fileHref(row.recheckCert)}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-block rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-50"
          title={`${row.name} 재검 확인서 열기`}
        >
          📄 재검 확인서
        </a>
      )}
    </div>
  );
}

function Sheet({ kind, group }: { kind: HealthCheck['kind']; group: HealthCheck['group'] }) {
  const seed = useMemo(() => (kind === 'general' ? healthGeneralSeed() : healthSpecialSeed()), [kind]);
  const { rows, getRows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<HealthCheck>(
    'health',
    HEALTH_KEY,
    {
      seed,
      // 일반·특수가 같은 저장소를 쓰므로, 이 화면 몫만 보고 최초 등록 여부를 판단한다
      seedScope: (r) => r.kind === kind && r.group === group,
      isBlank: (r) => !r.name.trim(),
      sort: (a, b) => a.name.localeCompare(b.name, 'ko'),
    },
  );

  const sortCtl = useSortable<HealthCheck>();
  const [uploading, setUploading] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  /** 첨부서류에서 읽어 자동으로 채운 내용 안내 */
  const [autoNote, setAutoNote] = useState('');
  const seq = useRef(0);
  /** 유해인자별 갱신은 특수검진에서만 따진다 */
  const isSpecial = kind === 'special';

  useEffect(() => setToday(new Date()), []);

  // 이 탭(검진종류·소속)에 해당하는 행만 보여준다
  const shown = sortCtl.apply(
    rows.filter((r) => r.kind === kind && r.group === group),
    { name: (r) => r.name, due: (r) => r.renewDate, hazard: (r) => mostUrgentHazard(r.hazards, today)?.renewAt ?? '' },
  );

  const add = () => {
    seq.current += 1;
    addRow({
      id: `HC-${kind}-${Date.now()}-${seq.current}`,
      kind,
      group,
      name: '',
      birth: '',
      checkDate: '',
      renewDate: '',
      note: '',
      updatedAt: '',
    });
  };

  const del = (r: HealthCheck) => {
    if (r.name.trim() && !confirm(`[${r.name}] 행을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  /** 결과서(이수증) 첨부·교체 */
  const attachCert = async (row: HealthCheck, file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(row.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.name || '검진결과'}`);
      setRow(row.id, { certFile: url });

      // 서류를 읽어 검진일자·유해인자를 자동으로 반영한다 (사람이 적어 둔 값은 건드리지 않는다)
      const f = await extractDocFields(dataUrl, `${HEALTH_LABEL[kind]} 확인서`);
      const cur = getRows().find((x) => x.id === row.id) ?? row;
      const patch: Partial<HealthCheck> = {};
      const filled: string[] = [];
      const checkedAt = f?.issuedAt ?? '';

      if (f?.birth && !cur.birth) {
        patch.birth = f.birth;
        filled.push(`생년월일 ${f.birth}`);
      }
      if (checkedAt && !cur.checkDate) {
        patch.checkDate = checkedAt;
        patch.renewDate = healthRenewDate(checkedAt);
        filled.push(`검진일자 ${checkedAt}`);
      }
      if (isSpecial && checkedAt) {
        // 확인서에 적힌 유해인자만 갱신한다 — 벤젠 재검 확인서면 벤젠 날짜만 바뀐다.
        // 유해인자를 못 읽었으면 연간 검진으로 보고 세 물질을 모두 잡는다.
        const read = watchedHazardsIn(f?.hazards ?? null);
        const names = read.length > 0 ? read : [...WATCHED_HAZARDS];
        const next = applyHazardCheck(cur.hazards, names, checkedAt);
        if (JSON.stringify(next) !== JSON.stringify(cur.hazards ?? [])) {
          patch.hazards = next;
          filled.push(`${names.join('·')} ${checkedAt}${read.length > 0 ? '' : ' (유해인자를 못 읽어 3종 모두 적용)'}`);
        }
      }
      if (Object.keys(patch).length > 0) setRow(row.id, patch);
      setAutoNote(filled.length > 0 ? `📄 ${row.name || '이 행'} — 서류에서 읽어 자동으로 채웠습니다: ${filled.join(' · ')}` : '');
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('결과서 첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  const badge = modeBadge(mode);
  const save = saveBadge(status, mode);

  const dday = (r: HealthCheck) => {
    if (!r.renewDate || !today) return <span className="text-[11px] text-slate-300">—</span>;
    const days = daysUntil(r.renewDate, today);
    const level = noticeLevel(days, HEALTH_NOTICE_DAYS);
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
        <h3 className="text-sm font-bold text-slate-700">
          🩺 {HEALTH_LABEL[kind]} — {group}
          <span className="ml-1.5 font-normal text-slate-400">{shown.length}명</span>
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>

      {autoNote && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <span className="flex-1">{autoNote}</span>
          <button onClick={() => setAutoNote('')} className="shrink-0 text-emerald-600 hover:text-emerald-900" aria-label="안내 닫기">
            ✕
          </button>
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className={`w-full text-xs ${isSpecial ? 'min-w-[1400px]' : 'min-w-[1100px]'}`}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
              <th className={`${TH} ${TH_STICKY} w-36`}>성명<SortButton ctl={sortCtl} col="name" label="성명" /></th>
              <th className={`${TH} w-40`}>생년월일</th>
              <th className={`${TH} w-40`}>검진일자</th>
              <th className={`${TH} w-40`}>갱신일자 (1년)</th>
              <th className={`${TH} w-24 text-center`}>D-day<SortButton ctl={sortCtl} col="due" label="D-day" /></th>
              {isSpecial && (
                <th className={`${TH} w-72`}>
                  유해인자 갱신
                  <span className="ml-1 font-normal text-slate-400">벤젠 6개월 · 톨루엔/크실렌 1년</span>
                  <SortButton ctl={sortCtl} col="hazard" label="유해인자 갱신" />
                </th>
              )}
              <th className={`${TH} w-36 text-center`}>이수증</th>
              <th className={`${TH} w-56`}>비고</th>
              <th className="w-10 px-1 py-2" aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={isSpecial ? 9 : 8} className="px-3 py-4 text-center text-slate-300">
                  아래 ＋ 버튼으로 {group}을 추가해 주세요
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className={`${TD_STICKY} px-1.5 py-1.5`}>
                  <input aria-label="성명" placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="생년월일" type="date" value={r.birth ?? ''} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={CELL} />
                </td>
                <td className="px-1.5 py-1.5">
                  <input
                    aria-label="검진일자"
                    type="date"
                    value={r.checkDate}
                    onChange={(e) => setRow(r.id, { checkDate: e.target.value, renewDate: healthRenewDate(e.target.value) })}
                    className={CELL}
                  />
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="갱신일자" type="date" value={r.renewDate} onChange={(e) => setRow(r.id, { renewDate: e.target.value })} className={CELL} />
                </td>
                <td className="px-2 py-1.5 text-center">{dday(r)}</td>
                {isSpecial && (
                  <td className="px-2 py-1.5">
                    <HazardCell row={r} today={today} onChange={(next) => setRow(r.id, { hazards: next })} />
                  </td>
                )}
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-1">
                    {r.certFile && (
                      <a
                        href={fileHref(r.certFile)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                        title={`${r.name} 결과서 열기`}
                      >
                        📄 보기
                      </a>
                    )}
                    <label
                      htmlFor={`hc-${r.id}`}
                      className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                      title="결과서 첨부·교체 (PDF·이미지)"
                    >
                      {uploading === r.id ? '업로드중' : r.certFile ? '교체' : '첨부'}
                    </label>
                    <input
                      id={`hc-${r.id}`}
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        void attachCert(r, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </td>
                <td className="px-1.5 py-1.5">
                  <input aria-label="비고" value={r.note ?? ''} onChange={(e) => setRow(r.id, { note: e.target.value })} className={CELL} />
                </td>
                <td className="px-1 py-1.5 text-center">
                  <button aria-label="행 삭제" onClick={() => del(r)} className="text-slate-300 hover:text-red-500">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SheetToolbar addLabel={`＋ ${group} 추가`} onAdd={add} onUndo={() => void undo()} canUndo={canUndo} save={save} />

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        검진일자를 입력하면 갱신일자(1년 후)가 자동 입력되며 직접 수정할 수 있습니다. 이수증은 [첨부]로 올리고 [교체]로
        바꿀 수 있으며, 갱신 {HEALTH_NOTICE_DAYS}일 전부터 메인 [공무관리 현황]에 D-day가 표시됩니다.
      </p>
    </div>
  );
}
