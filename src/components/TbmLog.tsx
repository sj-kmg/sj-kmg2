'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SafetyData } from '@/lib/types';
import { deletePhoto, fileToResizedDataUrl, getPhoto, putPhoto } from '@/lib/photos';
import { uploadPhoto } from '@/lib/sync';
import { useRole } from '@/lib/useRole';
import { useSyncedLog, modeBadge } from '@/lib/useSyncedLog';
import { TBM_KEY, tbmAttendees, tbmHazard, tbmMeasure, type TbmEntry } from '@/lib/tbm';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 오늘 날짜 YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 지금 시각 HH:mm */
function nowTime(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const EMPTY = {
  date: '',
  time: '',
  site: '',
  place: '',
  work: '',
  leader: '',
  hazard: '',
  measure: '',
};

export default function TbmLog({ data }: { data: SafetyData | null }) {
  // 로컬 → 서버 이관 시 IndexedDB 사진을 서버로 올리고 URL로 교체
  const migrateExtra = useMemo(
    () => async (entry: TbmEntry): Promise<TbmEntry> => {
      if (!entry.photoIds || entry.photoIds.length === 0) return entry;
      const urls: string[] = [...(entry.photoUrls ?? [])];
      for (const pid of entry.photoIds) {
        const dataUrl = await getPhoto(pid).catch(() => null);
        if (dataUrl) {
          try {
            urls.push(await uploadPhoto(dataUrl));
            await deletePhoto(pid).catch(() => undefined);
          } catch {
            // 업로드 실패한 사진은 포기 (기록 자체는 이관)
          }
        }
      }
      return { ...entry, photoIds: [], photoUrls: urls };
    },
    [],
  );

  const { entries, mode, pending, add, remove } = useSyncedLog<TbmEntry>('tbm', TBM_KEY, { migrateExtra });
  const { role } = useRole();
  /** 삭제는 관리자만 — 현장 계정에는 버튼을 보여 주지 않는다 */
  const canDelete = role !== 'field';
  const [form, setForm] = useState({ ...EMPTY });
  /** 참석자 — ＋버튼으로 칸을 늘려 이름을 적는다 */
  const [attendees, setAttendees] = useState<string[]>(['']);
  const [filterSite, setFilterSite] = useState('');
  const [saved, setSaved] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]); // dataURL
  const [localPhotos, setLocalPhotos] = useState<Record<string, string>>({}); // photoId → dataURL
  const [preview, setPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const loadedPhotoIds = useRef(new Set<string>());

  useEffect(() => {
    setForm((f) => ({ ...f, date: todayStr(), time: nowTime() }));
  }, []);

  // 로컬 모드 항목의 사진을 IndexedDB에서 로드
  useEffect(() => {
    (async () => {
      for (const e of entries) {
        for (const pid of e.photoIds ?? []) {
          if (loadedPhotoIds.current.has(pid)) continue;
          loadedPhotoIds.current.add(pid);
          const d = await getPhoto(pid).catch(() => null);
          if (d) setLocalPhotos((m) => ({ ...m, [pid]: d }));
        }
      }
    })();
  }, [entries]);

  // 현장 자동완성: 불러온 데이터의 발주처 + 기존 일지의 현장명
  const siteOptions = useMemo(() => {
    const s = new Set<string>();
    data?.risks.forEach((r) => r.company && s.add(r.company));
    entries.forEach((e) => e.site && s.add(e.site));
    return [...s];
  }, [data, entries]);

  const sites = useMemo(() => [...new Set(entries.map((e) => e.site).filter(Boolean))], [entries]);
  const shown = useMemo(
    () =>
      [...entries]
        .filter((e) => !filterSite || e.site === filterSite)
        .sort((a, b) => b.datetime.localeCompare(a.datetime)),
    [entries, filterSite],
  );

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setAttendee = (i: number, v: string) =>
    setAttendees((list) => list.map((n, j) => (j === i ? v : n)));

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 5 - pendingPhotos.length)) {
        const dataUrl = await fileToResizedDataUrl(file);
        setPendingPhotos((p) => [...p, dataUrl]);
      }
    } catch {
      alert('사진을 처리하지 못했습니다. 이미지 파일인지 확인해 주세요.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.time || !form.site.trim() || !form.hazard.trim() || submitting) return;
    setSubmitting(true);
    try {
      const names = attendees.map((n) => n.trim()).filter(Boolean);
      const id = `TBM-${Date.now()}`;
      const photoIds: string[] = [];
      const photoUrls: string[] = [];
      for (let i = 0; i < pendingPhotos.length; i++) {
        if (mode === 'server') {
          try {
            photoUrls.push(await uploadPhoto(pendingPhotos[i]));
            continue;
          } catch {
            // 서버 업로드 실패 시 이 사진은 로컬로라도 보관
          }
        }
        const pid = `${id}-P${i + 1}`;
        try {
          await putPhoto(pid, pendingPhotos[i]);
          photoIds.push(pid);
          setLocalPhotos((m) => ({ ...m, [pid]: pendingPhotos[i] }));
        } catch {
          // 사진 저장 실패 시 해당 사진만 제외
        }
      }
      const entry: TbmEntry = {
        id,
        datetime: `${form.date}T${form.time}`,
        site: form.site.trim(),
        place: form.place.trim(),
        work: form.work.trim(),
        leader: form.leader.trim(),
        attendeeList: names,
        attendees: names.join(', '),
        hazard: form.hazard.trim(),
        measure: form.measure.trim(),
        content: '',
        photoIds,
        photoUrls,
        createdAt: new Date().toISOString(),
      };
      if (!(await add(entry))) return;
      // 같은 현장에서 이어 쓰는 경우가 많아 현장·날짜는 남겨 둔다
      setForm({ ...EMPTY, date: form.date, time: nowTime(), site: form.site });
      setAttendees(['']);
      setPendingPhotos([]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm('이 TBM 일지를 삭제할까요? 첨부 사진도 함께 삭제됩니다.')) return;
    const target = entries.find((e) => e.id === id);
    for (const pid of target?.photoIds ?? []) {
      await deletePhoto(pid).catch(() => undefined);
    }
    void remove(id); // 서버 모드에서는 서버가 사진(Blob)도 함께 삭제
  };

  const exportCsv = () => {
    const head = ['일시', '현장(발주처)', '공사명', '금일작업내용', '참석자', '인원', '진행자', '위험요인', '안전대책', '사진(장)'];
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const rows = [...entries]
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .map((e) => {
        const names = tbmAttendees(e);
        return [
          e.datetime.replace('T', ' '),
          e.site,
          e.place,
          e.work,
          names.join(' '),
          names.length ? `${names.length}명` : e.attendees,
          e.leader,
          tbmHazard(e),
          tbmMeasure(e),
          String((e.photoIds?.length ?? 0) + (e.photoUrls?.length ?? 0)),
        ]
          .map(esc)
          .join(',');
      });
    const csv = '﻿' + [head.join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `TBM일지_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const photoSrcs = (e: TbmEntry): string[] => [
    ...(e.photoUrls ?? []),
    ...(e.photoIds ?? []).map((pid) => localPhotos[pid]).filter(Boolean),
  ];

  const badge = modeBadge(mode);
  // 휴대폰에서 입력칸을 누를 때 화면이 확대되지 않도록 본문 글자를 16px로 둔다
  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';
  const label = 'mb-1 block text-xs font-semibold text-slate-500';
  const filled = attendees.filter((n) => n.trim()).length;

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* 작성 폼 */}
      <form onSubmit={submit} className="xl:col-span-2 h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-700">TBM 일지 작성</h3>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {pending > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                미전송 {pending}건
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 일시 — 실시 후 나중에 작성하는 경우가 많아 날짜·시각을 직접 고칠 수 있게 나눠 둔다 */}
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">실시 일시 *</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, date: todayStr(), time: nowTime() }))}
                className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-800"
              >
                지금 시각으로
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="실시 날짜" type="date" required value={form.date} onChange={set('date')} className={input} />
              <input aria-label="실시 시각" type="time" required value={form.time} onChange={set('time')} className={input} />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">실시한 시각으로 고쳐 적을 수 있습니다.</p>
          </div>

          <div>
            <label className={label} htmlFor="tbm-site">현장(발주처) *</label>
            <input id="tbm-site" required list="tbm-sites" placeholder="예: 여천NCC 2공장" value={form.site} onChange={set('site')} className={input} />
            <datalist id="tbm-sites">
              {siteOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label} htmlFor="tbm-place">공사명</label>
            <input id="tbm-place" placeholder="예: B Boiler Cleaning" value={form.place} onChange={set('place')} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="tbm-work">금일작업내용</label>
            <input id="tbm-work" placeholder="예: 보일러 수관 고압세정" value={form.work} onChange={set('work')} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="tbm-leader">진행자</label>
            <input id="tbm-leader" placeholder="예: 김민규" value={form.leader} onChange={set('leader')} className={input} />
          </div>

          {/* 참석자 — 이름을 한 명씩 적는다 */}
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">참석자 ({filled}명)</span>
              <button
                type="button"
                onClick={() => setAttendees((list) => [...list, ''])}
                className="rounded-lg border border-[#1f3864] px-2.5 py-1 text-xs font-bold text-[#1f3864] hover:bg-[#1f3864] hover:text-white"
              >
                ＋ 참석자 추가
              </button>
            </div>
            <div className="space-y-1.5">
              {attendees.map((n, i) => (
                <div key={i} className="grid grid-cols-[2rem_1fr_1.75rem] items-center gap-1.5">
                  <span className="text-center text-sm font-semibold text-slate-500">{i + 1}</span>
                  <input
                    value={n}
                    onChange={(e) => setAttendee(i, e.target.value)}
                    placeholder="이름"
                    aria-label={`참석자 ${i + 1} 이름`}
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttendees((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : ['']))
                    }
                    aria-label={`참석자 ${i + 1} 삭제`}
                    className="text-center text-slate-300 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 위험요인 · 안전대책 — 분리 입력 */}
          <div className="sm:col-span-2">
            <label className={label} htmlFor="tbm-hazard">위험요인 *</label>
            <textarea
              id="tbm-hazard"
              required
              rows={4}
              placeholder={'예:\n- 밀폐공간 산소결핍·유해가스 중독\n- 고압호스 이탈에 의한 타격'}
              value={form.hazard}
              onChange={set('hazard')}
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="tbm-measure">안전대책</label>
            <textarea
              id="tbm-measure"
              rows={4}
              placeholder={'예:\n- 작업 전 산소농도 18% 이상 확인, 연속 환기\n- 2인 1조 작업, 감시자 배치\n- 개인보호구 착용 상태 점검'}
              value={form.measure}
              onChange={set('measure')}
              className={input}
            />
          </div>

          {/* 사진 첨부 */}
          <div className="sm:col-span-2">
            <label className={label} htmlFor="tbm-photo">사진 첨부 (최대 5장)</label>
            <label
              htmlFor="tbm-photo"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
            >
              📷 {photoBusy ? '사진 처리 중…' : '사진 선택 또는 촬영'}
            </label>
            <input
              id="tbm-photo"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            {pendingPhotos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingPhotos.map((p, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`첨부 사진 ${i + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                    <button
                      type="button"
                      aria-label="사진 제거"
                      onClick={() => setPendingPhotos((list) => list.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#1f3864] px-4 py-3 text-base font-bold text-white hover:bg-[#2a4a80] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-sm sm:font-medium"
          >
            {submitting ? '저장 중…' : '일지 저장'}
          </button>
          {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          {mode === 'server'
            ? '기록·사진은 서버에 저장되어 휴대폰·PC 어디서든 함께 보입니다. 현장에서 신호가 약해도 작성한 내용은 휴대폰에 보관됐다가 인터넷이 연결되면 자동으로 올라갑니다.'
            : '기록·사진이 이 브라우저에만 저장됩니다. 보존이 필요하면 주기적으로 [CSV 내보내기]로 백업하세요.'}
        </p>
      </form>

      {/* 목록 */}
      <div className="xl:col-span-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            aria-label="현장 필터"
          >
            <option value="">전체 현장</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500">{shown.length}건</span>
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            CSV 내보내기
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
            {mode === 'loading' ? '기록을 불러오는 중…' : '작성된 TBM 일지가 없습니다. 왼쪽 양식으로 첫 일지를 작성해 보세요.'}
          </div>
        ) : (
          shown.map((e) => {
            const names = tbmAttendees(e);
            const hazard = tbmHazard(e);
            const measure = tbmMeasure(e);
            return (
              <article key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="rounded bg-[#1f3864] px-2 py-0.5 text-xs font-bold text-white">{e.site}</span>
                  <span className="font-mono text-xs text-slate-500">{e.datetime.replace('T', ' ')}</span>
                  {e.place && <span className="text-xs text-slate-500">🏗️ {e.place}</span>}
                  {e.leader && <span className="text-xs text-slate-500">진행 {e.leader}</span>}
                  {canDelete && (
                    <button onClick={() => void removeEntry(e.id)} className="ml-auto text-xs text-slate-300 hover:text-red-500">
                      삭제
                    </button>
                  )}
                </div>

                {e.work && <p className="mt-2 text-sm font-semibold text-slate-800">{e.work}</p>}

                {(names.length > 0 || e.attendees) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-semibold text-slate-400">참석 {names.length || e.attendees}</span>
                    {names.map((n) => (
                      <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {n}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {hazard && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                      <p className="text-[10px] font-bold text-red-700">위험요인</p>
                      <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-600">{hazard}</p>
                    </div>
                  )}
                  {measure && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                      <p className="text-[10px] font-bold text-emerald-700">안전대책</p>
                      <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-600">{measure}</p>
                    </div>
                  )}
                </div>

                {photoSrcs(e).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {photoSrcs(e).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt="TBM 사진"
                        className="h-20 w-20 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
                        onClick={() => setPreview(src)}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* 사진 확대 보기 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="사진 확대" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
