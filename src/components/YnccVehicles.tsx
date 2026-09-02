'use client';

import { useEffect, useRef, useState } from 'react';
import { certPhoto, fileHref } from '@/lib/ids';
import { isPdf, pdfFirstPageToJpeg } from '@/lib/pdfPhoto';
import { SyncError, uploadCert } from '@/lib/sync';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import { useRole } from '@/lib/useRole';
import { YNCC_VEHICLES_KEY, type YnccVehicle } from '@/lib/yncc';
import { useSortable } from '@/lib/useSortable';
import { SortButton, TD_STICKY_POS, TH_STICKY } from './SheetUI';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 서류 한 건 — 사진으로 바로 띄워 본다.
 *
 * 휴대폰마다 PDF 뷰어가 달라 안 열리는 기기가 있어, 저장소에 넣어 둔 서류는
 * 같은 이름의 사진(JPG)을 함께 두고 그걸 먼저 보여 준다.
 * 사진은 길게 눌러 저장할 수 있고, [저장] 버튼으로 내려받을 수도 있다.
 * 원본 PDF는 인쇄용으로 옆에 남겨 둔다.
 */
function CertView({
  label,
  url,
  photoUrl,
  plate,
  canEdit,
  uploading,
  inputId,
  onFile,
  fullscreen,
}: {
  label: string;
  url: string | undefined;
  /** 올릴 때 함께 만들어 둔 사진 — 없으면 저장소에 나란히 둔 사진을 찾는다 */
  photoUrl?: string;
  plate: string;
  canEdit: boolean;
  uploading: boolean;
  inputId: string;
  onFile: (file: File | undefined) => void;
  /** 휴대폰 — 좁은 칸에 끼워 넣지 않고 화면 전체에 크게 띄운다 */
  fullscreen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const photo = photoUrl?.trim() || certPhoto(url);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        {url && photo && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
          >
            {open ? '닫기' : '🖼 보기'}
          </button>
        )}
        {url && !photo && (
          // 올린 파일은 짝이 되는 사진이 없어 원본을 그대로 연다
          <a
            href={fileHref(url)}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
            title={`${plate} ${label} 열기`}
          >
            📄 보기
          </a>
        )}
        {canEdit && (
          <>
            <label
              htmlFor={inputId}
              className="cursor-pointer rounded border border-dashed border-slate-300 px-1.5 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
              title={`${label} 첨부·교체`}
            >
              {uploading ? '업로드중' : url ? '교체' : '첨부'}
            </label>
            <input
              id={inputId}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </>
        )}
        {!url && !canEdit && <span className="text-[11px] text-slate-300">없음</span>}
      </div>

      {open && photo && fullscreen && (
        // 휴대폰 — 서류는 화면 가득 띄워야 글씨가 읽힌다
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/95">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="truncate text-sm font-semibold text-white">
              {plate} {label}
            </span>
            <button onClick={() => setOpen(false)} className="ml-auto rounded px-2 py-1 text-sm font-medium text-white/80">
              닫기 ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileHref(photo)} alt={`${plate} ${label}`} className="mx-auto w-full max-w-3xl rounded" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <a
              href={fileHref(photo)}
              download={`${plate}_${label}.jpg`}
              className="rounded bg-white px-2.5 py-1.5 text-xs font-semibold text-black"
            >
              ⤓ 사진 저장
            </a>
            {url && url !== photo && (
              <a href={fileHref(url)} target="_blank" rel="noreferrer" className="text-xs text-white/60 hover:underline">
                원본 PDF
              </a>
            )}
            <span className="text-[10px] text-white/40">사진을 길게 눌러도 저장됩니다</span>
          </div>
        </div>
      )}

      {open && photo && !fullscreen && (

        <div className="mt-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileHref(photo)}
            alt={`${plate} ${label}`}
            className="w-full rounded"
            style={{ maxHeight: '75vh', objectFit: 'contain' }}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2 px-0.5">
            <a
              href={fileHref(photo)}
              download={`${plate}_${label}.jpg`}
              className="rounded bg-[#1f3864] px-2 py-1 text-[11px] font-semibold text-white"
            >
              ⤓ 사진 저장
            </a>
            <a href={fileHref(photo)} target="_blank" rel="noreferrer" className="text-[11px] text-sky-700 hover:underline">
              새 창에서 크게
            </a>
            {url && url !== photo && (
              <a href={fileHref(url)} target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:underline">
                원본 PDF
              </a>
            )}
            <span className="text-[10px] text-slate-400">사진을 길게 눌러도 저장됩니다</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** 원본 문서를 반영해 둔 차량 — 최초 1회, 비어 있는 첨부 칸에만 채워 넣는다 (이미 있으면 손대지 않는다) */
const DEFAULT_ATTACHMENTS: { plate: string; regCertFile: string; insuranceCertFile: string }[] = [
  {
    plate: '86저0128',
    regCertFile: '/certs/yncc-vehicles/86저0128_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/86저0128_보험증권.pdf',
  },
  {
    plate: '802소3632',
    regCertFile: '/certs/yncc-vehicles/802소3632_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/802소3632_보험증권.pdf',
  },
  {
    plate: '93너7439',
    regCertFile: '/certs/yncc-vehicles/93너7439_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/93너7439_보험증권.pdf',
  },
  {
    plate: '95우6525',
    regCertFile: '/certs/yncc-vehicles/95우6525_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/95우6525_보험증권.pdf',
  },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** 출입신청 — YNCC 작업차량 등록 현황 (차량번호 고정, 등록일자·등록자 수시 갱신) */
export default function YnccVehicles() {
  const { entries, mode, add, remove } = useSyncedLog<YnccVehicle>('yncc-vehicles', YNCC_VEHICLES_KEY);
  const { role } = useRole();
  const [plateSel, setPlateSel] = useState(''); // '' = 신규 차량
  const [plateNew, setPlateNew] = useState('');
  const [regDate, setRegDate] = useState('');
  const [registrant, setRegistrant] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  /** 휴대폰에서 펼쳐 놓은 차량 — 목록이 길어지지 않게 한 대씩만 연다 */
  const [openPlate, setOpenPlate] = useState<string | null>(null);
  const seededRef = useRef(false);
  const sortCtl = useSortable<YnccVehicle>();
  /** 현장·열람 계정은 보기만 한다 — 수정·첨부·삭제는 관리자만 */
  const canEdit = role === 'admin';

  useEffect(() => setRegDate(todayStr()), []);

  // 원본 문서(등록증·보험증권)를 딱 한 번 반영 — 열람 전용 계정은 쓸 수 없으니 건드리지 않는다
  useEffect(() => {
    if (seededRef.current || mode === 'loading' || role === 'viewer') return;
    seededRef.current = true;
    for (const d of DEFAULT_ATTACHMENTS) {
      const norm = (p: string) => p.replace(/\s/g, '');
      const existing = entries.find((e) => norm(e.plate) === norm(d.plate));
      if (existing) {
        if (existing.regCertFile && existing.insuranceCertFile) continue;
        void add({
          ...existing,
          regCertFile: existing.regCertFile ?? d.regCertFile,
          insuranceCertFile: existing.insuranceCertFile ?? d.insuranceCertFile,
          updatedAt: new Date().toISOString(),
        });
      } else {
        void add({
          id: `YV-seed-${d.plate}`,
          plate: d.plate,
          regDate: todayStr(),
          registrant: '',
          regCertFile: d.regCertFile,
          insuranceCertFile: d.insuranceCertFile,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, role]);

  const vehicles = sortCtl.apply([...entries].sort((a, b) => a.plate.localeCompare(b.plate, 'ko')), {
    plate: (v) => v.plate,
    regDate: (v) => v.regDate,
    registrant: (v) => v.registrant,
  });

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
        // 기존 값을 먼저 펼쳐 둔다 — 이렇게 하지 않으면 갱신할 때
        // 여기서 다루지 않는 칸(차량등록증·보험증권 첨부)이 통째로 지워진다
        ...existing,
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

  const attach = async (v: YnccVehicle, field: 'regCertFile' | 'insuranceCertFile', file: File | undefined) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    const key = `${v.id}:${field}`;
    setUploading(key);
    try {
      const dataUrl = await fileToDataUrl(file);
      const label = field === 'regCertFile' ? '자동차등록증' : '보험증권';
      const url = await uploadCert(dataUrl, `${v.plate || '차량'}_${label}`);

      /*
       * 휴대폰에서 바로 열리도록 사진 판을 함께 만든다.
       * PDF면 첫 장을 사진으로 바꿔 올리고, 이미 이미지면 그 자체가 사진 판이다.
       * 변환이 안 되면 사진 없이 원본만 저장한다 (첨부 자체는 실패시키지 않는다).
       */
      const photoField = field === 'regCertFile' ? 'regCertPhoto' : 'insuranceCertPhoto';
      let photo: string | undefined;
      if (isPdf(file)) {
        const jpeg = await pdfFirstPageToJpeg(file);
        if (jpeg) photo = await uploadCert(jpeg, `${v.plate || '차량'}_${label}_사진`);
      } else {
        photo = url;
      }

      await add({
        ...v,
        [field]: url,
        // 변환에 실패했으면 예전 사진을 남겨 두지 않는다 — 원본과 어긋나면 더 혼란스럽다
        [photoField]: photo ?? '',
        updatedAt: new Date().toISOString(),
      });
      if (isPdf(file) && !photo) {
        alert('서류는 올렸지만 사진으로 바꾸지 못했습니다.\n휴대폰에서는 원본 PDF로 열립니다.');
      }
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('첨부는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
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

        {/* 입력창 — 차량번호는 고정, 등록일자·등록자만 갱신 (관리자만) */}
        {canEdit && (
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
        )}

        {/* 휴대폰 — 차량 카드. 표를 옆으로 밀지 않고 그대로 읽을 수 있게 한다 */}
        <div className="mt-4 space-y-2 md:hidden">
          {vehicles.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-300">
              {mode === 'loading' ? '불러오는 중…' : '등록된 차량이 없습니다.'}
            </p>
          )}
          {vehicles.map((v) => {
            const isOpen = openPlate === v.id;
            return (
              <article key={v.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {/* 차량번호 한 줄 — 누르면 서류가 펼쳐진다. 차량이 많아도 목록이 짧게 유지된다 */}
                <button
                  onClick={() => setOpenPlate(isOpen ? null : v.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2.5 text-left active:bg-slate-50"
                >
                  <span className="text-base font-bold text-slate-800">{v.plate}</span>
                  {v.registrant && <span className="text-xs text-slate-600">{v.registrant}</span>}
                  {v.regDate && <span className="font-mono text-[11px] text-slate-400">{v.regDate}</span>}
                  <span className="ml-auto text-slate-300">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-3 py-2.5">
                    {/* 등록증·보험증권을 나란히 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">차량등록증</p>
                        <CertView
                          label="자동차등록증"
                          url={v.regCertFile}
                          photoUrl={v.regCertPhoto}
                          plate={v.plate}
                          canEdit={canEdit}
                          uploading={uploading === `${v.id}:regCertFile`}
                          inputId={`yv-m-reg-${v.id}`}
                          fullscreen
                          onFile={(f) => void attach(v, 'regCertFile', f)}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">보험증권</p>
                        <CertView
                          label="보험증권"
                          url={v.insuranceCertFile}
                          photoUrl={v.insuranceCertPhoto}
                          plate={v.plate}
                          canEdit={canEdit}
                          uploading={uploading === `${v.id}:insuranceCertFile`}
                          inputId={`yv-m-ins-${v.id}`}
                          fullscreen
                          onFile={(f) => void attach(v, 'insuranceCertFile', f)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* 차량 전체 현황 — 입력하면 아래 내용이 바로 갱신된다 */}
        <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className={`px-4 py-2.5 font-semibold ${TH_STICKY}`}>차량번호<SortButton ctl={sortCtl} col="plate" label="차량번호" /></th>
                <th className="px-4 py-2.5 font-semibold">등록일자<SortButton ctl={sortCtl} col="regDate" label="등록일자" /></th>
                <th className="px-4 py-2.5 font-semibold">차량 등록자<SortButton ctl={sortCtl} col="registrant" label="차량 등록자" /></th>
                <th className="w-28 px-2 py-2.5 text-center font-semibold">차량등록증</th>
                <th className="w-28 px-2 py-2.5 text-center font-semibold">보험증권</th>
                <th className="px-4 py-2.5 font-semibold">최근 변경</th>
                <th className="w-10 px-2 py-2.5" aria-label="삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-300">
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
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <CertView
                      label="자동차등록증"
                      url={v.regCertFile}
                      photoUrl={v.regCertPhoto}
                      plate={v.plate}
                      canEdit={canEdit}
                      uploading={uploading === `${v.id}:regCertFile`}
                      inputId={`yv-reg-${v.id}`}
                      onFile={(f) => void attach(v, 'regCertFile', f)}
                    />
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <CertView
                      label="보험증권"
                      url={v.insuranceCertFile}
                      photoUrl={v.insuranceCertPhoto}
                      plate={v.plate}
                      canEdit={canEdit}
                      uploading={uploading === `${v.id}:insuranceCertFile`}
                      inputId={`yv-ins-${v.id}`}
                      onFile={(f) => void attach(v, 'insuranceCertFile', f)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                    {v.updatedAt ? new Date(v.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {canEdit && (
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          [🖼 보기]를 누르면 서류가 사진으로 바로 뜹니다. 사진을 길게 누르거나 [⤓ 사진 저장]으로 휴대폰에 저장할 수
          있고, 인쇄가 필요하면 [원본 PDF]를 쓰면 됩니다.
          {canEdit
            ? ' 차량번호는 고정이고 등록일자·차량 등록자만 수시로 갱신됩니다. 표에서 차량을 클릭하면 위 입력창으로 불러와 갱신할 수 있고, 서류는 [교체]로 바꿀 수 있습니다.'
            : ' 내용 수정과 서류 교체는 관리자만 할 수 있습니다.'}
        </p>
      </div>
    </div>
  );
}
