'use client';

import { useMemo, useState } from 'react';
import { deletePhoto, fileToResizedDataUrl, getPhoto, putPhoto } from '@/lib/photos';
import { RiskAiError, SyncError, generateRiskRows, setPasscode, uploadPhoto } from '@/lib/sync';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import SheetExport from './SheetExport';
import type { ExportSpec } from '@/lib/sheetExport';
import { gradeByKey, riskLevelKey, riskProduct } from '@/lib/risk';
import RiskEstimationGuide, { RiskResultSummary } from './RiskGuide';
import { TD_STICKY, TH_STICKY } from './SheetUI';

/** 공사업체 선택 목록 */
const COMPANIES = [
  'LG화학 SAP',
  'LG화학 PC',
  'LG화학 BPA',
  'LG화학 NCC1',
  'LG화학 NCC2',
  'LG화학 화치',
  'LG화학(대산)',
  '한화토탈(대산)',
  'OCI광양',
  'OCI포항',
  'GS칼텍스',
  '본사',
  '여천NCC 1공장',
  '여천NCC 2공장',
  '여천NCC 3공장',
  '여천NCC 4공장',
  '여수시',
  '롯데케미칼',
];

const TIMINGS = ['작업 전', '작업 중', '작업 후'];
/** 평가방법 — 고정 */
const RISK_METHOD = '빈도·강도법';
const MAX_PHOTOS_PER_ROW = 3;

/** 저장되는 평가 항목(행) */
interface SavedRow {
  step: string; // 작업단계
  hazard: string; // 유해위험요인
  measure: string; // 현재 안전조치
  freq1: string; // 현재 빈도
  sev1: string; // 현재 강도
  action: string; // 개선대책
  freq2: string; // 개선 후 빈도
  sev2: string; // 개선 후 강도
  timing: string; // 개선일자 (작업 전/중/후)
  photoIds: string[]; // 로컬(IndexedDB) 사진
  photoUrls: string[]; // 서버(Blob) 사진
}

interface RiskEntry {
  id: string;
  company: string; // 공사업체
  workName: string; // 공사명
  workers: string; // 작업인원
  periodFrom: string;
  periodTo: string;
  method: string; // 평가방법
  assessor: string; // 평가자
  rows: SavedRow[];
  /** 전체 행 사진 URL 집계 — 서버에서 기록 삭제 시 사진 일괄 정리에 사용 */
  photoUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

/** 작성 중 폼의 사진 — pending(신규 dataURL) / url(서버 저장됨) / local(IndexedDB 저장됨) */
interface FormPhoto {
  kind: 'pending' | 'url' | 'local';
  src: string;
  id?: string;
}

interface FormRow {
  step: string;
  hazard: string;
  measure: string;
  freq1: string;
  sev1: string;
  action: string;
  freq2: string;
  sev2: string;
  timing: string;
  photos: FormPhoto[];
}

const EMPTY_ROW: FormRow = {
  step: '', hazard: '', measure: '', freq1: '', sev1: '', action: '', freq2: '', sev2: '', timing: '', photos: [],
};

const EMPTY_HEAD = {
  company: '', workName: '', workers: '', periodFrom: '', assessor: '',
};

/** 숫자 입력 정리 — 빈 값 허용, 1~max로 제한 */
function clampNum(v: string, max: number): string {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(Math.max(Number(digits), 1), max));
}

export default function RiskAssessment() {
  // 로컬 → 서버 이관 시 IndexedDB 사진을 서버로 올리고 URL로 교체
  const migrateExtra = useMemo(
    () => async (entry: RiskEntry): Promise<RiskEntry> => {
      const rows: SavedRow[] = [];
      for (const row of entry.rows ?? []) {
        const urls = [...(row.photoUrls ?? [])];
        const remain: string[] = [];
        for (const pid of row.photoIds ?? []) {
          const dataUrl = await getPhoto(pid).catch(() => null);
          if (!dataUrl) continue;
          try {
            urls.push(await uploadPhoto(dataUrl));
            await deletePhoto(pid).catch(() => undefined);
          } catch {
            remain.push(pid);
          }
        }
        rows.push({ ...row, photoIds: remain, photoUrls: urls });
      }
      return { ...entry, rows, photoUrls: rows.flatMap((r) => r.photoUrls) };
    },
    [],
  );

  const { entries, mode, add, remove } = useSyncedLog<RiskEntry>('risk', 'sj-risk:v1', { migrateExtra });

  const [head, setHead] = useState({ ...EMPTY_HEAD });
  const [rows, setRows] = useState<FormRow[]>([{ ...EMPTY_ROW }]);
  const [editId, setEditId] = useState<string | null>(null);
  const [origLocalIds, setOrigLocalIds] = useState<string[]>([]); // 편집 전 로컬 사진 — 저장 시 제거된 것 정리
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [aiPhotos, setAiPhotos] = useState<string[]>([]); // AI 생성용 작업 사진 (dataURL)
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const setHeadField = (k: keyof typeof EMPTY_HEAD) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setHead((h) => ({ ...h, [k]: e.target.value }));

  const setRow = (i: number, patch: Partial<FormRow>) =>
    setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows((list) => [...list, { ...EMPTY_ROW }]);

  const removeRow = (i: number) => {
    if (rows.length <= 1) {
      setRows([{ ...EMPTY_ROW }]);
      return;
    }
    setRows((list) => list.filter((_, j) => j !== i));
  };

  const addRowPhotos = async (i: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoBusy(true);
    try {
      const room = MAX_PHOTOS_PER_ROW - rows[i].photos.length;
      for (const file of Array.from(files).slice(0, Math.max(room, 0))) {
        const dataUrl = await fileToResizedDataUrl(file);
        setRows((list) =>
          list.map((r, j) => (j === i ? { ...r, photos: [...r.photos, { kind: 'pending' as const, src: dataUrl }] } : r)),
        );
      }
    } catch {
      alert('사진을 처리하지 못했습니다. 이미지 파일인지 확인해 주세요.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const resetForm = () => {
    setHead({ ...EMPTY_HEAD });
    setRows([{ ...EMPTY_ROW }]);
    setEditId(null);
    setOrigLocalIds([]);
    setAiPhotos([]);
    setAiNote(null);
  };

  const addAiPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoBusy(true);
    try {
      for (const file of Array.from(files).slice(0, Math.max(3 - aiPhotos.length, 0))) {
        const dataUrl = await fileToResizedDataUrl(file);
        setAiPhotos((p) => [...p, dataUrl]);
      }
    } catch {
      alert('사진을 처리하지 못했습니다. 이미지 파일인지 확인해 주세요.');
    } finally {
      setPhotoBusy(false);
    }
  };

  /** 작업 사진으로 평가표 초안 자동 생성 — 생성 항목은 기존 표 뒤에 추가되고, 사진은 첫 항목에 첨부된다 */
  const runAiGenerate = async () => {
    if (aiPhotos.length === 0 || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    const context = [head.company && `공사업체: ${head.company}`, head.workName && `공사명: ${head.workName}`]
      .filter(Boolean)
      .join(' · ');
    const attempt = () => generateRiskRows(aiPhotos, context);
    try {
      let generated;
      try {
        generated = await attempt();
      } catch (e) {
        if (e instanceof SyncError && e.status === 401) {
          const entered = window.prompt('동기화 암호를 입력하세요. (AI 자동 생성 기능 사용에 필요합니다)');
          if (!entered?.trim()) return;
          setPasscode(entered.trim());
          generated = await attempt();
        } else {
          throw e;
        }
      }
      if (generated.length === 0) {
        setAiNote('사진에서 평가 항목을 만들지 못했습니다. 작업 상황이 잘 보이는 사진으로 다시 시도해 주세요.');
        return;
      }
      const newRows: FormRow[] = generated.map((g, i) => ({
        step: g.step,
        hazard: g.hazard,
        measure: g.measure,
        freq1: String(g.freq1),
        sev1: String(g.sev1),
        action: g.action,
        freq2: String(g.freq2),
        sev2: String(g.sev2),
        timing: TIMINGS.includes(g.timing) ? g.timing : '',
        photos: i === 0 ? aiPhotos.map((src) => ({ kind: 'pending' as const, src })) : [],
      }));
      const isEmptyRow = (r: FormRow) =>
        !r.step && !r.hazard && !r.measure && !r.freq1 && !r.sev1 && !r.action && !r.freq2 && !r.sev2 && !r.timing && r.photos.length === 0;
      setRows((prev) => [...prev.filter((r) => !isEmptyRow(r)), ...newRows]);
      setAiPhotos([]);
      setAiNote(`✅ ${generated.length}개 항목이 생성되었습니다. 내용을 확인·수정한 후 저장해 주세요.`);
    } catch (e) {
      if (e instanceof SyncError && e.status === 503) {
        alert('AI 자동 생성은 배포된 사이트에서 사용할 수 있습니다.\n로컬 개발 환경에서는 동작하지 않습니다.');
      } else if (e instanceof RiskAiError && e.code === 'no_credit') {
        alert('이번 달 무료 AI 사용량이 모두 소진되었습니다.\n다음 달에 자동으로 초기화됩니다.');
      } else if (e instanceof RiskAiError && e.code === 'gateway_auth') {
        alert(
          'AI 인증에 실패했습니다.\nGOOGLE_GENERATIVE_AI_API_KEY(Google AI Studio 키) 설정 확인이 필요합니다.\n\n상세: ' +
            e.detail,
        );
      } else if (e instanceof RiskAiError && e.detail) {
        alert(`자동 생성에 실패했습니다.\n\n오류 내용: ${e.detail}\n\n이 내용을 관리자(Claude)에게 알려주시면 해결해 드립니다.`);
      } else {
        const status = e instanceof SyncError ? ` (오류 코드 ${e.status})` : '';
        alert(`자동 생성에 실패했습니다.${status} 잠시 후 다시 시도해 주세요.`);
      }
    } finally {
      setAiBusy(false);
    }
  };

  /** 저장된 평가를 폼으로 불러와 수정 */
  const loadEntry = async (e: RiskEntry) => {
    const formRows: FormRow[] = [];
    const localIds: string[] = [];
    for (const row of e.rows) {
      const photos: FormPhoto[] = (row.photoUrls ?? []).map((u) => ({ kind: 'url' as const, src: u }));
      for (const pid of row.photoIds ?? []) {
        localIds.push(pid);
        const dataUrl = await getPhoto(pid).catch(() => null);
        if (dataUrl) photos.push({ kind: 'local', src: dataUrl, id: pid });
      }
      const { photoIds: _ids, photoUrls: _urls, ...rest } = row;
      formRows.push({ ...rest, photos });
    }
    setHead({
      company: e.company, workName: e.workName, workers: e.workers,
      periodFrom: e.periodFrom, assessor: e.assessor,
    });
    setRows(formRows.length > 0 ? formRows : [{ ...EMPTY_ROW }]);
    setEditId(e.id);
    setOrigLocalIds(localIds);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!head.company.trim() && !head.workName.trim()) {
      alert('공사업체 또는 공사명을 입력해 주세요.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const id = editId ?? `RA-${Date.now()}`;
      const savedRows: SavedRow[] = [];
      const keptLocalIds: string[] = [];
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const photoIds: string[] = [];
        const photoUrls: string[] = [];
        for (let pi = 0; pi < row.photos.length; pi++) {
          const ph = row.photos[pi];
          if (ph.kind === 'url') {
            photoUrls.push(ph.src);
            continue;
          }
          if (ph.kind === 'local' && ph.id) {
            if (mode === 'server') {
              try {
                photoUrls.push(await uploadPhoto(ph.src));
                await deletePhoto(ph.id).catch(() => undefined);
                continue;
              } catch {
                // 업로드 실패 시 로컬 보관 유지
              }
            }
            photoIds.push(ph.id);
            keptLocalIds.push(ph.id);
            continue;
          }
          // 신규 사진
          if (mode === 'server') {
            try {
              photoUrls.push(await uploadPhoto(ph.src));
              continue;
            } catch {
              // 서버 업로드 실패 시 로컬로라도 보관
            }
          }
          const pid = `${id}-R${ri + 1}-P${pi + 1}-${Date.now()}`;
          try {
            await putPhoto(pid, ph.src);
            photoIds.push(pid);
            keptLocalIds.push(pid);
          } catch {
            // 사진 저장 실패 시 해당 사진만 제외
          }
        }
        const { photos: _photos, ...rest } = row;
        savedRows.push({ ...rest, photoIds, photoUrls });
      }
      // 편집 중 제거된 로컬 사진 정리
      for (const pid of origLocalIds.filter((p) => !keptLocalIds.includes(p))) {
        await deletePhoto(pid).catch(() => undefined);
      }
      const now = new Date().toISOString();
      const entry: RiskEntry = {
        id,
        company: head.company.trim(),
        workName: head.workName.trim(),
        workers: head.workers.trim(),
        periodFrom: head.periodFrom,
        periodTo: '',
        method: RISK_METHOD,
        assessor: head.assessor.trim(),
        rows: savedRows,
        photoUrls: savedRows.flatMap((r) => r.photoUrls),
        createdAt: editId ? entries.find((e) => e.id === editId)?.createdAt ?? now : now,
        updatedAt: now,
      };
      if (!(await add(entry))) return;
      resetForm();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (e: RiskEntry) => {
    if (!confirm(`[${e.company || e.workName}] 위험성평가를 삭제할까요? 첨부 사진도 함께 삭제됩니다.`)) return;
    for (const row of e.rows) {
      for (const pid of row.photoIds ?? []) {
        await deletePhoto(pid).catch(() => undefined);
      }
    }
    await remove(e.id); // 서버 모드에서는 서버가 사진(Blob)도 함께 삭제
    if (editId === e.id) resetForm();
  };

  const shown = useMemo(
    () => [...entries].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [entries],
  );

  const badge = modeBadge(mode);
  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1f3864] focus:outline-none';
  const label = 'mb-1 block text-xs font-semibold text-slate-500';
  const cellArea =
    'w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none';

  /** 엑셀·인쇄에 넘길 표 — 평가서 목록 */
  const exportSpec = (): ExportSpec<RiskEntry> => ({
    title: '위험성평가 목록',
    landscape: true,
    columns: [
      { label: '공사업체', value: (r: RiskEntry) => r.company, align: 'left' as const, width: 20 },
      { label: '공사명', value: (r: RiskEntry) => r.workName, align: 'left' as const, width: 26 },
      { label: '작업인원', value: (r: RiskEntry) => r.workers, width: 12 },
      { label: '평가기간', value: (r: RiskEntry) => [r.periodFrom, r.periodTo].filter(Boolean).join(' ~ '), width: 22 },
      { label: '평가방법', value: (r: RiskEntry) => r.method, width: 14 },
      { label: '평가자', value: (r: RiskEntry) => r.assessor, width: 12 },
      { label: '평가항목 수', value: (r: RiskEntry) => String(r.rows?.length ?? 0), width: 11 },
    ],
    rows: shown,
  });

  return (
    <div className="space-y-6">
      {/* 작성 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">
            {editId ? `위험성평가 수정 (${editId})` : '위험성평가 작성'}
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          <SheetExport spec={exportSpec} className="ml-auto" />
          {editId && (
            <button onClick={resetForm} className="ml-auto text-xs text-slate-400 hover:text-slate-600">
              ✕ 수정 취소 (새로 작성)
            </button>
          )}
        </div>

        {/* 상단 — 공사 정보 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2">
            <label className={label} htmlFor="ra-company-sel">공사업체 *</label>
            <div className="flex gap-2">
              <select
                id="ra-company-sel"
                value={COMPANIES.includes(head.company) ? head.company : ''}
                onChange={(e) => {
                  if (e.target.value) setHead((h) => ({ ...h, company: e.target.value }));
                }}
                className={`${input} w-1/2`}
              >
                <option value="">선택…</option>
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                aria-label="공사업체 직접 입력"
                placeholder="직접 입력 가능"
                value={head.company}
                onChange={setHeadField('company')}
                className={`${input} w-1/2`}
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="ra-work">공사명 *</label>
            <input id="ra-work" placeholder="예: DR-3310 내부 CLEANING" value={head.workName} onChange={setHeadField('workName')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="ra-workers">작업인원</label>
            <input id="ra-workers" placeholder="예: 5명" value={head.workers} onChange={setHeadField('workers')} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="ra-from">평가기간</label>
            <input id="ra-from" type="date" value={head.periodFrom} onChange={setHeadField('periodFrom')} className={input} />
          </div>
          <div>
            <label className={label}>평가방법</label>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              빈도·강도법
            </p>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className={label} htmlFor="ra-assessor">평가자</label>
            <input id="ra-assessor" placeholder="예: 김민규" value={head.assessor} onChange={setHeadField('assessor')} className={input} />
          </div>
        </div>

        {/* AI 자동 생성 */}
        <div className="mt-4 rounded-lg border border-dashed border-sky-300 bg-sky-50/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold text-sky-800">✨ 작업사진으로 자동 생성</p>
            <p className="text-[11px] text-slate-500">
              작업 사진을 첨부하면 AI가 작업단계·유해위험요인·안전조치·위험등급 초안을 만들어 줍니다. 내용을 확인·수정한 뒤 저장하세요.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {aiPhotos.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`작업 사진 ${i + 1}`}
                  className="h-14 w-14 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
                  onClick={() => setPreview(src)}
                />
                <button
                  type="button"
                  aria-label="사진 제거"
                  onClick={() => setAiPhotos((list) => list.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {aiPhotos.length < 3 && (
              <label
                htmlFor="ra-ai-photo"
                className="flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-sky-500 hover:text-sky-600"
                title="작업 사진 추가 (최대 3장)"
              >
                <span className="text-base">📷</span>
                <span className="text-[9px]">{photoBusy ? '처리중' : '추가'}</span>
              </label>
            )}
            <input
              id="ra-ai-photo"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void addAiPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => void runAiGenerate()}
              disabled={aiPhotos.length === 0 || aiBusy}
              className="ml-auto rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {aiBusy ? '생성 중… (최대 1분)' : '✨ 위험성평가 자동 생성'}
            </button>
          </div>
          {aiNote && <p className="mt-2 text-xs font-medium text-sky-800">{aiNote}</p>}
        </div>

        {/* 평가표 */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1180px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] text-slate-500">
                <th className="w-10 px-2 py-2 text-center font-semibold">순서</th>
                <th className={`min-w-32 px-2 py-2 font-semibold ${TH_STICKY}`}>작업단계</th>
                <th className="min-w-40 px-2 py-2 font-semibold">유해위험요인</th>
                <th className="min-w-40 px-2 py-2 font-semibold">현재 안전조치</th>
                <th className="w-40 px-2 py-2 text-center font-semibold">
                  현재 위험등급
                  <span className="block font-normal text-slate-400">빈도(1~5)×강도(1~4)</span>
                </th>
                <th className="min-w-40 px-2 py-2 font-semibold">개선대책</th>
                <th className="w-40 px-2 py-2 text-center font-semibold">
                  개선 후 위험등급
                  <span className="block font-normal text-slate-400">빈도(1~5)×강도(1~4)</span>
                </th>
                <th className="w-24 px-2 py-2 text-center font-semibold">개선일자</th>
                <th className="w-32 px-2 py-2 text-center font-semibold">사진</th>
                <th className="w-8 px-1 py-2" aria-label="행 삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-2 text-center font-semibold text-slate-500">{i + 1}</td>
                  <td className={`px-1.5 py-2 ${TD_STICKY}`}>
                    <textarea rows={3} placeholder="예: M/H Open" value={row.step} onChange={(e) => setRow(i, { step: e.target.value })} className={cellArea} />
                  </td>
                  <td className="px-1.5 py-2">
                    <textarea rows={3} placeholder="예: 잔류가스 누출로 인한 질식" value={row.hazard} onChange={(e) => setRow(i, { hazard: e.target.value })} className={cellArea} />
                  </td>
                  <td className="px-1.5 py-2">
                    <textarea rows={3} placeholder="예: 가스검지 후 작업, 송기마스크 착용" value={row.measure} onChange={(e) => setRow(i, { measure: e.target.value })} className={cellArea} />
                  </td>
                  <td className="px-1.5 py-2">
                    <GradeInput
                      freq={row.freq1}
                      sev={row.sev1}
                      onFreq={(v) => setRow(i, { freq1: v })}
                      onSev={(v) => setRow(i, { sev1: v })}
                    />
                  </td>
                  <td className="px-1.5 py-2">
                    <textarea rows={3} placeholder="예: 감시자 배치, 환기 실시" value={row.action} onChange={(e) => setRow(i, { action: e.target.value })} className={cellArea} />
                  </td>
                  <td className="px-1.5 py-2">
                    <GradeInput
                      freq={row.freq2}
                      sev={row.sev2}
                      onFreq={(v) => setRow(i, { freq2: v })}
                      onSev={(v) => setRow(i, { sev2: v })}
                    />
                  </td>
                  <td className="px-1.5 py-2">
                    <select
                      aria-label="개선일자"
                      value={row.timing}
                      onChange={(e) => setRow(i, { timing: e.target.value })}
                      className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none"
                    >
                      <option value="">선택…</option>
                      {TIMINGS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1.5 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {row.photos.map((ph, pi) => (
                        <div key={pi} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ph.src}
                            alt={`${i + 1}번 항목 사진 ${pi + 1}`}
                            className="h-10 w-10 cursor-zoom-in rounded border border-slate-200 object-cover"
                            onClick={() => setPreview(ph.src)}
                          />
                          <button
                            type="button"
                            aria-label="사진 제거"
                            onClick={() => setRow(i, { photos: row.photos.filter((_, j) => j !== pi) })}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {row.photos.length < MAX_PHOTOS_PER_ROW && (
                        <label
                          htmlFor={`ra-photo-${i}`}
                          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded border-2 border-dashed border-slate-300 text-base text-slate-400 hover:border-[#1f3864] hover:text-[#1f3864]"
                          title="사진 추가"
                        >
                          {photoBusy ? '…' : '📷'}
                        </label>
                      )}
                      <input
                        id={`ra-photo-${i}`}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void addRowPhotos(i, e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button
                      type="button"
                      aria-label={`${i + 1}번 행 삭제`}
                      onClick={() => removeRow(i)}
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

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-dashed border-slate-400 px-4 py-2 text-sm font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            ＋ 항목 추가
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-[#1f3864] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a4a80] disabled:opacity-60"
          >
            {saving ? '저장 중…' : editId ? '수정 저장' : '평가 저장'}
          </button>
          {saved && <span className="text-sm font-medium text-green-600">저장되었습니다 ✓</span>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          위험성 = 빈도 × 강도 · Level 1~6 A(안전) / 7~12 B(상당) / 13~15 C(중대) / 16~20 D(허용불가) 자동 산출 ·
          AI 자동 생성 결과는 초안이므로 반드시 현장 상황에 맞게 확인·수정 후 저장하세요.
        </p>
      </section>

      {/* 저장된 평가 목록 */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700">저장된 위험성평가 {shown.length}건</h3>
        {shown.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            {mode === 'loading' ? '기록을 불러오는 중…' : '저장된 위험성평가가 없습니다. 위 양식으로 작성해 주세요.'}
          </div>
        ) : (
          shown.map((e) => {
            const maxRisk = Math.max(0, ...e.rows.map((r) => riskProduct(r.freq1, r.sev1) ?? 0));
            const level = maxRisk > 0 ? riskLevelKey(maxRisk) : null;
            const meta = level ? gradeByKey(level, 'letter4') : null;
            return (
              <article key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="rounded bg-[#1f3864] px-2 py-0.5 text-xs font-bold text-white">{e.company || '업체 미기재'}</span>
                  <span className="text-sm font-semibold text-slate-800">{e.workName || '공사명 미기재'}</span>
                  {meta && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: meta.fill, color: meta.ink }}
                    >
                      최고 {maxRisk} · {meta.label}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <button onClick={() => void loadEntry(e)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50">
                      열람·수정
                    </button>
                    <button onClick={() => void removeEntry(e)} className="text-xs text-slate-300 hover:text-red-500">
                      삭제
                    </button>
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {e.periodFrom && `평가기간 ${e.periodFrom} · `}
                  {e.workers && `작업인원 ${e.workers} · `}
                  {e.method && `${e.method} · `}
                  {e.assessor && `평가자 ${e.assessor} · `}
                  항목 {e.rows.length}건 · 사진 {(e.photoUrls?.length ?? 0) + e.rows.reduce((n, r) => n + (r.photoIds?.length ?? 0), 0)}장
                </p>
                {/* 위험성결과표 — 항목에서 자동 집계 */}
                <RiskResultSummary rows={e.rows} />
              </article>
            );
          })
        )}
      </section>

      {/* 위험성 추정결정표 (참고 기준표) */}
      <RiskEstimationGuide />

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

/** 빈도·강도 입력 + 위험성·Level 자동 산출 배지 */
function GradeInput({
  freq,
  sev,
  onFreq,
  onSev,
}: {
  freq: string;
  sev: string;
  onFreq: (v: string) => void;
  onSev: (v: string) => void;
}) {
  const r = riskProduct(freq, sev);
  const level = r === null ? null : riskLevelKey(r);
  const meta = level ? gradeByKey(level, 'letter4') : null;
  const num =
    'w-10 rounded-md border border-slate-200 bg-white px-1 py-1.5 text-center text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none';
  return (
    <div className="flex items-center justify-center gap-1">
      <input aria-label="빈도" inputMode="numeric" placeholder="빈도" value={freq} onChange={(e) => onFreq(clampNum(e.target.value, 5))} className={num} />
      <span className="text-slate-300">×</span>
      <input aria-label="강도" inputMode="numeric" placeholder="강도" value={sev} onChange={(e) => onSev(clampNum(e.target.value, 4))} className={num} />
      <span
        className="min-w-12 rounded px-1.5 py-1 text-center text-[11px] font-bold"
        style={meta ? { background: meta.fill, color: meta.ink } : { background: '#f1f5f9', color: '#94a3b8' }}
        title={meta ? meta.label : '빈도·강도 입력 시 자동 산출'}
      >
        {r === null ? '—' : `${r} ${level}`}
      </span>
    </div>
  );
}
