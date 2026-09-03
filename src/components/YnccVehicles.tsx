'use client';

import { useEffect, useRef, useState } from 'react';
import { certPhoto, fileHref } from '@/lib/ids';
import { SyncError, uploadDatedCert } from '@/lib/sync';
import {
  CERT_FILE_LABEL,
  CERT_LABEL,
  certStatus,
  summarize,
  worstStatus,
  type CertKind,
  type CertStatus,
} from '@/lib/certExpiry';
import { useCertPhoto } from '@/lib/useCertPhoto';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import { useRole } from '@/lib/useRole';
import { YNCC_VEHICLES_KEY, type YnccVehicle } from '@/lib/yncc';
import { categoryOfPlate, VEHICLE_CATEGORIES, type VehicleCategory } from '@/lib/vehicleCheck';
import { useSortable } from '@/lib/useSortable';
import { SortButton, TD_STICKY_POS, TH_STICKY } from './SheetUI';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 서류 한 건 — 언제나 사진으로 띄워 본다.
 *
 * 휴대폰마다 PDF 뷰어가 달라 안 열리는 기기가 있다. 그래서 첨부는 PDF로 올리더라도
 * 화면에는 서버가 만들어 둔 사진을 띄운다. 사진은 길게 눌러 저장할 수 있고,
 * [사진 저장] 버튼으로도 내려받을 수 있다. 원본 PDF는 인쇄용으로 옆에 남겨 둔다.
 */
function CertView({
  label,
  url,
  plate,
  canEdit,
  uploading,
  inputId,
  onFile,
  fullscreen,
}: {
  label: string;
  url: string | undefined;
  plate: string;
  canEdit: boolean;
  uploading: boolean;
  inputId: string;
  onFile: (file: File | undefined) => void;
  /** 휴대폰 — 좁은 칸에 끼워 넣지 않고 화면 전체에 크게 띄운다 */
  fullscreen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const { src, state } = useCertPhoto(open ? certPhoto(url) : null);
  const failed = state === 'failed' || broken;

  const body = (
    <>
      {state === 'loading' && <p className="py-6 text-center text-xs text-slate-400">사진을 준비하고 있습니다…</p>}
      {failed && (
        <div className="py-6 text-center">
          <p className="text-xs text-slate-400">이 서류는 사진으로 바꾸지 못했습니다.</p>
          {url && (
            <a
              href={fileHref(url)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-sky-700 underline"
            >
              원본 PDF로 열기
            </a>
          )}
        </div>
      )}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${plate} ${label}`}
          onError={() => setBroken(true)}
          className={fullscreen ? 'mx-auto w-full max-w-3xl rounded' : 'w-full rounded'}
          style={fullscreen ? undefined : { maxHeight: '75vh', objectFit: 'contain' }}
        />
      )}
    </>
  );

  const actions = src && !failed && (
    <>
      <a
        href={src}
        download={`${plate}_${label}.jpg`}
        className={
          fullscreen
            ? 'rounded bg-white px-2.5 py-1.5 text-xs font-semibold text-black'
            : 'rounded bg-[#1f3864] px-2 py-1 text-[11px] font-semibold text-white'
        }
      >
        ⤓ 사진 저장
      </a>
      {url && (
        <a
          href={fileHref(url)}
          target="_blank"
          rel="noreferrer"
          className={fullscreen ? 'text-xs text-white/60 hover:underline' : 'text-[11px] text-slate-400 hover:underline'}
        >
          원본 PDF
        </a>
      )}
      <span className={fullscreen ? 'text-[10px] text-white/40' : 'text-[10px] text-slate-400'}>
        사진을 길게 눌러도 저장됩니다
      </span>
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        {url && (
          <button
            onClick={() => {
              setBroken(false);
              setOpen((v) => !v);
            }}
            className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
          >
            {open ? '닫기' : '🖼 보기'}
          </button>
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

      {open && fullscreen && (
        // 휴대폰 — 서류는 화면 가득 띄워야 글씨가 읽힌다
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/95">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="truncate text-sm font-semibold text-white">
              {plate} {label}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto rounded px-2 py-1 text-sm font-medium text-white/80"
            >
              닫기 ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto px-2">{body}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">{actions}</div>
        </div>
      )}

      {open && !fullscreen && (
        <div className="mt-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
          {body}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 px-0.5">{actions}</div>
        </div>
      )}
    </div>
  );
}

/** 만료 배지 — 여유가 있으면 아무것도 그리지 않는다 */
function ExpiryBadge({ status }: { status: CertStatus }) {
  if (status.level === 'ok') return null;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${status.badgeClass}`}
      title={status.note}
    >
      {status.badge}
    </span>
  );
}

/** 서류 밑에 붙는 한 줄 — 만료일과 배지 */
function ExpiryLine({ status }: { status: CertStatus }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {status.until ? (
        <span className={`font-mono text-[10px] ${status.level === 'expired' ? 'text-red-600' : 'text-slate-400'}`}>
          ~{status.until}
        </span>
      ) : null}
      <ExpiryBadge status={status} />
    </div>
  );
}

/**
 * 원본 문서를 반영해 둔 차량 — 최초 1회, **비어 있는 칸에만** 채워 넣는다.
 *
 * 만료일은 서류를 직접 읽어 옮긴 값이다.
 * 802소3632의 검사유효기간은 손으로 덧쓴 글씨라 연도를 확정할 수 없어 비워 두었다.
 * 넘겨짚어 넣으면 지난 서류를 유효한 것처럼 보여 주게 되므로, 화면에서 '만료일 확인'으로 남긴다.
 */
const DEFAULT_ATTACHMENTS: {
  plate: string;
  regCertFile: string;
  insuranceCertFile: string;
  inspectionUntil?: string;
  insuranceUntil?: string;
}[] = [
  {
    plate: '86저0128',
    regCertFile: '/certs/yncc-vehicles/86저0128_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/86저0128_보험증권.pdf',
    inspectionUntil: '2026-07-23',
    insuranceUntil: '2027-07-24',
  },
  {
    plate: '802소3632',
    regCertFile: '/certs/yncc-vehicles/802소3632_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/802소3632_보험증권.pdf',
    insuranceUntil: '2027-04-06',
  },
  {
    plate: '93너7439',
    regCertFile: '/certs/yncc-vehicles/93너7439_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/93너7439_보험증권.pdf',
    inspectionUntil: '2026-10-09',
    insuranceUntil: '2026-10-10',
  },
  {
    plate: '95우6525',
    regCertFile: '/certs/yncc-vehicles/95우6525_자동차등록증.pdf',
    insuranceCertFile: '/certs/yncc-vehicles/95우6525_보험증권.pdf',
    inspectionUntil: '2026-11-15',
    insuranceUntil: '2026-10-15',
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
  const [inspectionUntil, setInspectionUntil] = useState('');
  const [insuranceUntil, setInsuranceUntil] = useState('');
  const [category, setCategory] = useState<VehicleCategory>('일반차량');
  /** 보고 있는 탭 — 차량점검내역과 같은 세 갈래로 나눈다 */
  const [tab, setTab] = useState<VehicleCategory>('일반차량');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  /** 휴대폰에서 펼쳐 놓은 차량 — 목록이 길어지지 않게 한 대씩만 연다 */
  const [openPlate, setOpenPlate] = useState<string | null>(null);
  const seededRef = useRef(false);
  const sortCtl = useSortable<YnccVehicle>();
  /** 서류 첨부·삭제·차량번호·만료일 — 관리자만 */
  const canEdit = role === 'admin';
  /**
   * 차량 등록자는 현장 계정도 고칠 수 있다 — 누가 그 차를 쓰는지는 현장에서 자주 바뀐다.
   * (서버도 이 칸만 반영하므로 화면을 우회해도 다른 값은 바뀌지 않는다)
   */
  const canEditRegistrant = role === 'admin' || role === 'field';

  useEffect(() => setRegDate(todayStr()), []);

  // 원본 문서(등록증·보험증권)를 딱 한 번 반영 — 열람 전용 계정은 쓸 수 없으니 건드리지 않는다
  useEffect(() => {
    if (seededRef.current || mode === 'loading' || role !== 'admin') return;
    seededRef.current = true;
    const norm = (p: string) => p.replace(/\s/g, '');
    for (const d of DEFAULT_ATTACHMENTS) {
      const existing = entries.find((e) => norm(e.plate) === norm(d.plate));
      // 사람이 넣어 둔 값은 건드리지 않고, 비어 있는 칸만 채운다
      const filled = {
        regCertFile: existing?.regCertFile || d.regCertFile,
        insuranceCertFile: existing?.insuranceCertFile || d.insuranceCertFile,
        inspectionUntil: existing?.inspectionUntil || d.inspectionUntil || '',
        insuranceUntil: existing?.insuranceUntil || d.insuranceUntil || '',
      };
      if (existing) {
        const same =
          existing.regCertFile === filled.regCertFile &&
          existing.insuranceCertFile === filled.insuranceCertFile &&
          (existing.inspectionUntil ?? '') === filled.inspectionUntil &&
          (existing.insuranceUntil ?? '') === filled.insuranceUntil;
        if (same) continue;
        void add({ ...existing, ...filled, updatedAt: new Date().toISOString() });
      } else {
        void add({
          id: `YV-seed-${d.plate}`,
          plate: d.plate,
          regDate: todayStr(),
          registrant: '',
          ...filled,
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

  /**
   * 이 차량의 분류 — 직접 정해 둔 값이 있으면 그것을, 없으면 차량점검내역 대장을 따른다.
   * 대장에도 없는 차량은 일반차량으로 둔다 (탭 어디에도 안 보이는 차가 없도록).
   */
  const categoryOf = (v: YnccVehicle): VehicleCategory => v.category ?? categoryOfPlate(v.plate) ?? '일반차량';

  const shown = vehicles.filter((v) => categoryOf(v) === tab);

  /** 이 차량의 두 서류 상태 — 검사유효기간·보험기간 */
  const statusesOf = (v: YnccVehicle): CertStatus[] => [
    certStatus('inspection', v.inspectionUntil),
    certStatus('insurance', v.insuranceUntil),
  ];
  /** 목록에 배지 하나만 달 때 쓰는, 가장 급한 서류 (여유가 있으면 null) */
  const alertOf = (v: YnccVehicle) => worstStatus(statusesOf(v));
  const overview = summarize(vehicles.flatMap(statusesOf));
  /**
   * 만료일을 못 읽은 서류 — 차량번호와 어떤 서류인지 그대로 적어 둔다.
   * 스캔 서류는 글자층이 없어 자동으로 못 읽으므로, 사람이 실물을 보고 넣어야 한다.
   */
  const unreadable = vehicles
    .map((v) => ({ plate: v.plate, kinds: statusesOf(v).filter((st) => st.level === 'unknown') }))
    .filter((r) => r.kinds.length > 0);
  const unreadableText = unreadable
    .map((r) => `${r.plate} — ${r.kinds.map((k) => `${CERT_FILE_LABEL[k.kind]}(${CERT_LABEL[k.kind]})`).join(', ')}`)
    .join(String.fromCharCode(10));
  /** 교체가 필요하거나 곧 필요한 차량 — 위쪽 요약에 이름을 적어 준다 */
  const needsAction = vehicles.filter((v) => {
    const w = alertOf(v);
    return w?.level === 'expired' || w?.level === 'soon';
  });

  // 기존 차량 선택 시 현재 등록 내용을 입력창에 불러온다
  const selectPlate = (plate: string) => {
    setPlateSel(plate);
    const v = entries.find((e) => e.plate === plate);
    if (v) {
      setRegDate(v.regDate || todayStr());
      setRegistrant(v.registrant);
      setInspectionUntil(v.inspectionUntil ?? '');
      setInsuranceUntil(v.insuranceUntil ?? '');
      setCategory(categoryOf(v));
    } else {
      setRegDate(todayStr());
      setRegistrant('');
      setInspectionUntil('');
      setInsuranceUntil('');
      // 새 차량은 지금 보고 있는 탭으로 들어가는 게 자연스럽다
      setCategory(tab);
    }
  };

  const submit = async () => {
    const plate = (plateSel || plateNew).trim();
    if (!plate) {
      alert('차량번호를 선택하거나 새로 입력해 주세요.');
      return;
    }
    // 등록자는 비워 둬도 된다 — 누가 쓸지 정해지기 전에 차량부터 올리고 서류를 붙이는 경우가 있다
    if (!regDate) {
      alert('등록일자를 입력해 주세요.');
      return;
    }
    if (saving) return;
    const existing = entries.find((v) => v.plate === plate);
    // 직원 계정은 이미 있는 차량의 등록자만 고친다 (서버도 같은 기준으로 거른다)
    if (!canEdit && !existing) {
      alert('차량을 목록에서 골라 주세요. 새 차량 등록은 관리자만 할 수 있습니다.');
      return;
    }
    setSaving(true);
    try {
      const entry: YnccVehicle = {
        // 기존 값을 먼저 펼쳐 둔다 — 이렇게 하지 않으면 갱신할 때
        // 여기서 다루지 않는 칸(차량등록증·보험증권 첨부)이 통째로 지워진다
        ...existing,
        id: existing?.id ?? `YV-${Date.now()}`,
        plate,
        registrant: registrant.trim(),
        regDate: canEdit ? regDate : (existing?.regDate ?? regDate),
        // 등록자·등록일자 말고는 관리자만 바꾼다
        ...(canEdit ? { inspectionUntil, insuranceUntil, category } : {}),
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
      const reg = field === 'regCertFile';
      const label = reg ? '자동차등록증' : '보험증권';
      const kind: CertKind = reg ? 'inspection' : 'insurance';
      // 사진으로 바꾸고 만료일을 읽는 일은 서버가 한다 — 어느 기기에서 올리든 결과가 같다
      const { url, expiresAt } = await uploadDatedCert(dataUrl, `${v.plate || '차량'}_${label}`, kind);
      /*
       * 새 서류를 붙였으면 기간도 새 서류 것으로 바꾼다.
       * 다만 읽어 내지 못했을 때(스캔본) 예전 날짜를 지우지는 않는다 —
       * 사람이 넣어 둔 값을 없애 버리는 게 더 나쁘다.
       */
      const untilField = reg ? 'inspectionUntil' : 'insuranceUntil';
      await add({
        ...v,
        [field]: url,
        ...(expiresAt ? { [untilField]: expiresAt } : {}),
        updatedAt: new Date().toISOString(),
      });
      if (!expiresAt && !v[untilField]) {
        alert(`${label}을 올렸습니다. 스캔 서류라 ${reg ? '검사유효기간' : '보험기간'}을 읽지 못했습니다 — 만료일을 직접 넣어 주세요.`);
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

        {/*
          서류 기간 요약 — 기간이 끝난 서류를 그대로 두면 현장에서 무효라,
          목록을 훑지 않아도 바로 알 수 있게 맨 위에 모아 둔다.
        */}
        {(overview.expired > 0 || overview.soon > 0 || overview.unknown > 0) && (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {overview.expired > 0 && (
                <span className="font-semibold text-red-600">기간 지남 {overview.expired}건 — 첨부파일 교체 필요</span>
              )}
              {overview.soon > 0 && <span className="font-semibold text-orange-600">30일 내 만료 {overview.soon}건</span>}
              {overview.unknown > 0 && <span className="text-slate-400">만료일 미입력 {overview.unknown}건</span>}
            </div>
            {needsAction.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-500">
                {needsAction.map((v) => {
                  const w = alertOf(v)!;
                  return `${v.plate} ${CERT_FILE_LABEL[w.kind]}(${w.badge})`;
                }).join(' · ')}
              </p>
            )}

            {/*
              만료일을 못 읽은 서류 — 스캔본은 글자층이 없어 자동으로는 알 수 없다.
              어느 차량의 어떤 서류인지 그대로 적어 두고, 그대로 복사해 물어볼 수 있게 한다.
            */}
            {unreadable.length > 0 && (
              <div className="mt-2 rounded border border-slate-200 bg-white px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">만료일을 읽지 못한 서류</span>
                  <button
                    onClick={() => void navigator.clipboard?.writeText(unreadableText)}
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
                    title="목록을 복사합니다"
                  >
                    복사
                  </button>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {unreadable.map((r) => (
                    <li key={r.plate} className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{r.plate}</span>
                      {' — '}
                      {r.kinds.map((k) => `${CERT_FILE_LABEL[k.kind]}(${CERT_LABEL[k.kind]})`).join(', ')}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-slate-400">
                  스캔한 서류는 글자를 읽을 수 없어 자동으로 채워지지 않습니다. 서류를 보고 위 입력창에 직접 넣어 주세요.
                </p>
              </div>
            )}
          </div>
        )}

        {/*
          분류 탭 — 차량점검내역과 같은 세 갈래로 나눈다.
          위 요약은 탭과 상관없이 전체 기준이라, 다른 탭의 만료를 놓치지 않는다.
        */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {VEHICLE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                tab === c
                  ? 'border-[#1f3864] bg-[#1f3864] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[#1f3864]'
              }`}
            >
              {c} <span className="ml-1 font-normal opacity-70">{vehicles.filter((v) => categoryOf(v) === c).length}</span>
            </button>
          ))}
        </div>

        {/* 입력창 — 차량번호는 고정, 등록일자·등록자만 갱신 (관리자만) */}
        {canEditRegistrant && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className={label} htmlFor="yv-sel">차량 선택</label>
              <select id="yv-sel" value={plateSel} onChange={(e) => selectPlate(e.target.value)} className={`${input} w-full`}>
                {/* 새 차량을 만드는 건 관리자만 — 직원은 이미 있는 차량의 등록자만 고친다 */}
                {canEdit ? <option value="">＋ 신규 차량</option> : <option value="">차량을 고르세요</option>}
                {vehicles.map((v) => (
                  <option key={v.id} value={v.plate}>{v.plate}</option>
                ))}
              </select>
            </div>
            {canEdit && plateSel === '' && (
              <div>
                <label className={label} htmlFor="yv-new">새 차량번호</label>
                <input id="yv-new" placeholder="예: 12가3456" value={plateNew} onChange={(e) => setPlateNew(e.target.value)} className={`${input} w-full`} />
              </div>
            )}
            {canEdit && (
              <div>
                <label className={label} htmlFor="yv-cat">분류</label>
                <select id="yv-cat" value={category} onChange={(e) => setCategory(e.target.value as VehicleCategory)} className={`${input} w-full`}>
                  {VEHICLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            {canEdit && (
              <div>
                <label className={label} htmlFor="yv-date">등록일자</label>
                <input id="yv-date" type="date" value={regDate} onChange={(e) => setRegDate(e.target.value)} className={`${input} w-full`} />
              </div>
            )}
            <div>
              <label className={label} htmlFor="yv-reg">
                차량 등록자 <span className="font-normal text-slate-400">(나중에 입력해도 됩니다)</span>
              </label>
              <input id="yv-reg" placeholder="미정이면 비워 두세요" value={registrant} onChange={(e) => setRegistrant(e.target.value)} className={`${input} w-full`} />
            </div>
            {canEdit && (
              <div>
                <label className={label} htmlFor="yv-insp">
                  검사유효기간 <span className="font-normal text-slate-400">만료일</span>
                </label>
                <input id="yv-insp" type="date" value={inspectionUntil} onChange={(e) => setInspectionUntil(e.target.value)} className={`${input} w-full`} />
              </div>
            )}
            {canEdit && (
              <div>
                <label className={label} htmlFor="yv-ins">
                  보험기간 <span className="font-normal text-slate-400">만료일</span>
                </label>
                <input id="yv-ins" type="date" value={insuranceUntil} onChange={(e) => setInsuranceUntil(e.target.value)} className={`${input} w-full`} />
              </div>
            )}
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
          {!canEdit && (
            <p className="mt-2 text-[11px] text-slate-400">
              차량 등록자만 고칠 수 있습니다. 차량 추가·서류 교체·만료일 입력은 관리자에게 요청해 주세요.
            </p>
          )}
        </div>
        )}

        {/* 휴대폰 — 차량 카드. 표를 옆으로 밀지 않고 그대로 읽을 수 있게 한다 */}
        <div className="mt-4 space-y-2 md:hidden">
          {shown.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-300">
              {mode === 'loading' ? '불러오는 중…' : `등록된 ${tab}이 없습니다.`}
            </p>
          )}
          {shown.map((v) => {
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
                  <span className={v.registrant ? 'text-xs text-slate-600' : 'text-xs text-slate-300'}>
                    {v.registrant || '등록자 미정'}
                  </span>
                  {v.regDate && <span className="font-mono text-[11px] text-slate-400">{v.regDate}</span>}
                  {/* 접혀 있어도 교체가 필요한 차량은 바로 눈에 띄어야 한다 */}
                  {alertOf(v) && <ExpiryBadge status={alertOf(v)!} />}
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
                          plate={v.plate}
                          canEdit={canEdit}
                          uploading={uploading === `${v.id}:regCertFile`}
                          inputId={`yv-m-reg-${v.id}`}
                          fullscreen
                          onFile={(f) => void attach(v, 'regCertFile', f)}
                        />
                        <ExpiryLine status={certStatus('inspection', v.inspectionUntil)} />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">보험증권</p>
                        <CertView
                          label="보험증권"
                          url={v.insuranceCertFile}
                          plate={v.plate}
                          canEdit={canEdit}
                          uploading={uploading === `${v.id}:insuranceCertFile`}
                          inputId={`yv-m-ins-${v.id}`}
                          fullscreen
                          onFile={(f) => void attach(v, 'insuranceCertFile', f)}
                        />
                        <ExpiryLine status={certStatus('insurance', v.insuranceUntil)} />
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
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-300">
                    {mode === 'loading' ? '불러오는 중…' : `등록된 ${tab}이 없습니다. 위 입력창에서 차량을 등록해 주세요.`}
                  </td>
                </tr>
              )}
              {shown.map((v) => (
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
                  <td className="px-4 py-2.5 text-slate-700">
                    {v.registrant || <span className="text-slate-300">미정</span>}
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <CertView
                      label="자동차등록증"
                      url={v.regCertFile}
                      plate={v.plate}
                      canEdit={canEdit}
                      uploading={uploading === `${v.id}:regCertFile`}
                      inputId={`yv-reg-${v.id}`}
                      onFile={(f) => void attach(v, 'regCertFile', f)}
                    />
                    <ExpiryLine status={certStatus('inspection', v.inspectionUntil)} />
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <CertView
                      label="보험증권"
                      url={v.insuranceCertFile}
                      plate={v.plate}
                      canEdit={canEdit}
                      uploading={uploading === `${v.id}:insuranceCertFile`}
                      inputId={`yv-ins-${v.id}`}
                      onFile={(f) => void attach(v, 'insuranceCertFile', f)}
                    />
                    <ExpiryLine status={certStatus('insurance', v.insuranceUntil)} />
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
          있고, 인쇄가 필요하면 [원본 PDF]를 쓰면 됩니다. 서류 밑의 날짜는 검사유효기간·보험기간이 끝나는 날이며,
          한 달 전부터 D-Day가, 지나면 [교체 필요]가 뜹니다.
          {canEdit
            ? ' 차량번호는 고정이고 등록일자·차량 등록자만 수시로 갱신됩니다. 표에서 차량을 클릭하면 위 입력창으로 불러와 갱신할 수 있고, 서류는 [교체]로 바꿀 수 있습니다. 만료일은 서류를 올릴 때 자동으로 읽지만, 스캔 서류는 글자가 없어 못 읽으므로 [만료일 확인]이 뜨면 직접 넣어 주세요.'
            : ' 내용 수정과 서류 교체는 관리자만 할 수 있습니다.'}
        </p>
      </div>
    </div>
  );
}
