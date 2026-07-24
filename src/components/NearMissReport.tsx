'use client';

import { useEffect, useMemo, useState } from 'react';
import { putPhoto, getPhoto, deletePhoto, fileToResizedDataUrl } from '@/lib/photos';

interface NearMissEntry {
  id: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  place: string;
  finder: string;
  content: string;
  action: string; // 개선대책
  photoIds: string[];
  createdAt: string;
}

const KEY = 'sj-nearmiss:v1';

function loadEntries(): NearMissEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as NearMissEntry[];
  } catch {
    return [];
  }
}

function saveEntries(list: NearMissEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 저장 실패 무시
  }
}

function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const EMPTY = { datetime: '', place: '', finder: '', content: '', action: '' };

export default function NearMissReport() {
  const [entries, setEntries] = useState<NearMissEntry[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]); // dataURL
  const [photos, setPhotos] = useState<Record<string, string>>({}); // photoId → dataURL
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    const list = loadEntries();
    setEntries(list);
    setForm((f) => ({ ...f, datetime: nowLocal() }));
    // 목록의 사진을 IndexedDB에서 로드
    (async () => {
      const map: Record<string, string> = {};
      for (const e of list) {
        for (const pid of e.photoIds) {
          const d = await getPhoto(pid).catch(() => null);
          if (d) map[pid] = d;
        }
      }
      setPhotos(map);
    })();
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
    if (!form.datetime || !form.place.trim() || !form.content.trim()) return;
    const id = `NM-${Date.now()}`;
    const photoIds: string[] = [];
    for (let i = 0; i < pendingPhotos.length; i++) {
      const pid = `${id}-P${i + 1}`;
      try {
        await putPhoto(pid, pendingPhotos[i]);
        photoIds.push(pid);
        setPhotos((m) => ({ ...m, [pid]: pendingPhotos[i] }));
      } catch {
        // 사진 저장 실패 시 해당 사진만 제외
      }
    }
    const entry: NearMissEntry = {
      id,
      ...form,
      place: form.place.trim(),
      photoIds,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    saveEntries(next);
    setForm({ ...EMPTY, datetime: nowLocal() });
    setPendingPhotos([]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const remove = async (id: string) => {
    if (!confirm('이 아차사고 기록을 삭제할까요? 첨부 사진도 함께 삭제됩니다.')) return;
    const target = entries.find((e) => e.id === id);
    for (const pid of target?.photoIds ?? []) {
      await deletePhoto(pid).catch(() => undefined);
    }
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    saveEntries(next);
  };

  const exportCsv = () => {
    const head = ['시간', '장소', '발견자', '내용', '개선대책', '사진(장)'];
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const rows = [...entries]
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .map((e) =>
        [e.datetime.replace('T', ' '), e.place, e.finder, e.content, e.action, String(e.photoIds.length)]
          .map(esc)
          .join(','),
      );
    const csv = '﻿' + [head.join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `아차사고_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shown = useMemo(() => [...entries].sort((a, b) => b.datetime.localeCompare(a.datetime)), [entries]);

  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';
  const label = 'mb-1 block text-xs font-semibold text-slate-500';

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* 작성 폼 */}
      <form onSubmit={submit} className="xl:col-span-2 h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-700">아차사고 신고</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="nm-dt">시간 *</label>
            <input id="nm-dt" type="datetime-local" required value={form.datetime} onChange={set('datetime')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="nm-place">장소 *</label>
            <input id="nm-place" required placeholder="예: Boiler 구역 M/H 앞" value={form.place} onChange={set('place')} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="nm-finder">발견자</label>
            <input id="nm-finder" placeholder="예: 김민규" value={form.finder} onChange={set('finder')} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="nm-content">내용 *</label>
            <textarea
              id="nm-content"
              required
              rows={4}
              placeholder="무슨 일이 있었는지 구체적으로 적어주세요.&#10;예: M/H Open 중 Bolt가 낙하하여 작업자 발 옆에 떨어짐 (부상 없음)"
              value={form.content}
              onChange={set('content')}
              className={input}
            />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="nm-action">개선대책</label>
            <textarea
              id="nm-action"
              rows={3}
              placeholder="예: Bolt 전용 보관함 사용 의무화, TBM 시 전파"
              value={form.action}
              onChange={set('action')}
              className={input}
            />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="nm-photo">사진 첨부 (최대 5장)</label>
            <label
              htmlFor="nm-photo"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
            >
              📷 {photoBusy ? '사진 처리 중…' : '사진 선택 또는 촬영'}
            </label>
            <input
              id="nm-photo"
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
          <button type="submit" className="rounded-lg bg-[#1f3864] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a80]">
            신고 저장
          </button>
          {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          기록·사진은 이 브라우저에만 저장됩니다. 보존이 필요하면 [CSV 내보내기]로 백업하세요. (사진은 브라우저 안에 보관되며 CSV에는 장수만 표기)
        </p>
      </form>

      {/* 목록 */}
      <div className="xl:col-span-3 space-y-3">
        <div className="flex items-center gap-2">
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
            등록된 아차사고가 없습니다. 위험 요인을 발견하면 바로 기록해 주세요.
          </div>
        ) : (
          shown.map((e) => (
            <article key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">아차사고</span>
                <span className="font-mono text-xs text-slate-500">{e.datetime.replace('T', ' ')}</span>
                <span className="text-xs text-slate-500">📍 {e.place}</span>
                {e.finder && <span className="text-xs text-slate-500">발견 {e.finder}</span>}
                <button onClick={() => void remove(e.id)} className="ml-auto text-xs text-slate-300 hover:text-red-500">
                  삭제
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">{e.content}</p>
              {e.action && (
                <p className="mt-2 whitespace-pre-line rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <b>개선대책:</b> {e.action}
                </p>
              )}
              {e.photoIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.photoIds.map((pid) =>
                    photos[pid] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={pid}
                        src={photos[pid]}
                        alt="아차사고 사진"
                        className="h-20 w-20 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
                        onClick={() => setPreview(photos[pid])}
                      />
                    ) : (
                      <div key={pid} className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                        사진
                      </div>
                    ),
                  )}
                </div>
              )}
            </article>
          ))
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
