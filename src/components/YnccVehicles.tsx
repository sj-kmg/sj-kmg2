'use client';

import { useEffect, useRef, useState } from 'react';
import { certPhoto, fileHref } from '@/lib/ids';
import { extractDocFields, readCertPeriod, SyncError, uploadDatedCert } from '@/lib/sync';
import { samePlate } from '@/lib/docDates';
import { CERT_FILE_LABEL, certStatus, type CertKind } from '@/lib/certExpiry';
import { useCertPhoto } from '@/lib/useCertPhoto';
import { modeBadge, useSyncedLog } from '@/lib/useSyncedLog';
import { useRole } from '@/lib/useRole';
import { YNCC_VEHICLES_KEY, type YnccVehicle } from '@/lib/yncc';
import { categoryOfPlate, VEHICLE_CATEGORIES, type VehicleCategory } from '@/lib/vehicleCheck';
import { useSortable } from '@/lib/useSortable';
import SheetExport from './SheetExport';
import type { ExportSpec } from '@/lib/sheetExport';
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
  expired,
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
  /** 검사유효기간·보험기간이 지난 서류 — [교체]를 빨갛게 해 눈에 걸리게 한다 */
  expired?: boolean;
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
              className={`cursor-pointer rounded border px-1.5 py-1 text-[11px] whitespace-nowrap ${
                expired
                  ? 'border-red-600 bg-red-600 font-semibold text-white hover:bg-red-700'
                  : 'border-dashed border-slate-300 text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]'
              }`}
              title={expired ? `${label} 기간이 지났습니다 — 새 서류로 교체해 주세요` : `${label} 첨부·교체`}
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

/**
 * 서류의 유효기간 한 칸 — 지났으면 빨갛게, 없으면 흐리게.
 * 날짜만 보여 주고 별도 문구는 붙이지 않는다 (표가 어지러워진다).
 */
function PeriodCell({ until, expired }: { until: string | undefined; expired: boolean }) {
  if (!until) return <span className="text-slate-300">미확인</span>;
  return <span className={`font-mono text-xs ${expired ? 'font-semibold text-red-600' : 'text-slate-600'}`}>{until}</span>;
}

/**
 * 원본 문서를 반영해 둔 차량 — 최초 1회, **비어 있는 칸에만** 채워 넣는다.
 *
 * 만료일은 서류를 직접 읽어 옮긴 값이다 (802소3632 검사유효기간만 사용자 확인).
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
    // 손으로 덧쓴 글씨라 판독이 안 돼 사용자가 확인해 준 값 (2026-09-03)
    inspectionUntil: '2027-12-08',
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

/**
 * 서류를 직접 읽어 옮긴 유효기간 — 차량번호 → [검사유효기간, 보험기간] 만료일.
 *
 * 자동차등록증 29건은 모두 스캔본이라 글자층이 없어 기계로는 못 읽는다.
 * 검사유효기간 표의 **마지막 줄**(손으로 덧쓴 갱신분)을 눈으로 확인해 옮겼다.
 * 보험증권은 글자층이 있는 13건은 문서에서 그대로, 나머지는 마찬가지로 읽어 옮겼다.
 *
 * 802소3625·802소3635는 손글씨 연도가 인쇄된 숫자 위에 겹쳐 있어 확정하지 못했다.
 * 넘겨짚어 넣으면 지난 서류를 유효한 것처럼 보여 주게 되므로 비워 둔다.
 * 비어 있는 칸만 채우므로, 사람이 넣은 값은 덮어쓰지 않는다.
 */
const DEFAULT_PERIODS: Record<string, { inspection?: string; insurance?: string }> = {
  '93너7439': { inspection: '2026-10-09', insurance: '2026-10-10' },
  '854가9555': { inspection: '2028-08-09', insurance: '2027-08-29' },
  '86주6774': { inspection: '2027-04-28', insurance: '2027-04-29' },
  '83마2628': { inspection: '2026-08-31', insurance: '2027-02-27' },
  '96머0525': { inspection: '2026-09-04', insurance: '2026-10-04' },
  '86조6489': { inspection: '2026-12-04', insurance: '2026-11-27' },
  '95우6541': { inspection: '2026-11-02', insurance: '2026-11-03' },
  '83로6699': { inspection: '2026-12-07', insurance: '2027-06-08' },
  '83두2898': { inspection: '2026-12-19', insurance: '2027-07-26' },
  '95러9793': { inspection: '2026-10-02', insurance: '2026-09-19' },
  '91오8390': { inspection: '2027-02-14', insurance: '2027-01-04' },
  '85루1418': { inspection: '2027-06-24', insurance: '2027-06-25' },
  '95어6296': { inspection: '2027-01-28', insurance: '2026-09-26' },
  '89도8997': { inspection: '2026-09-14', insurance: '2027-09-07' },
  '81러0891': { inspection: '2026-09-07', insurance: '2027-01-23' },
  '97소1434': { inspection: '2026-09-27', insurance: '2027-04-25' },
  '802소3625': { insurance: '2027-08-29' }, // 검사유효기간 판독 불가
  '802소3635': { insurance: '2027-08-29' }, // 검사유효기간 판독 불가
  '83너0462': { inspection: '2026-10-30', insurance: '2026-10-30' },
  '986버1690': { inspection: '2027-01-06', insurance: '2026-12-15' },
  '986버1665': { inspection: '2026-09-06', insurance: '2027-03-07' },
  '815너8465': { inspection: '2027-08-31', insurance: '2026-10-21' },
  '816도5194': { inspection: '2028-05-26', insurance: '2026-12-30' },
  '986버1667': { inspection: '2026-11-19', insurance: '2026-09-25' },
  '전남04바2827': { inspection: '2026-08-01', insurance: '2027-08-06' },
  '전남04라3482': { inspection: '2027-01-15', insurance: '2027-02-22' },
  '전남03나3645': { inspection: '2027-01-31' }, // 보험증권 미첨부
  '02마1168': { inspection: '2026-09-02', insurance: '2027-09-03' },
};

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
  /** 이미 붙어 있는 서류를 다시 읽는 중 — '3/8' 같은 진행 표시 */
  const [rereading, setRereading] = useState('');
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
    /*
     * 차량을 새로 만드는 건 **목록이 통째로 비어 있을 때만** 한다.
     * 이미 쓰고 있는 목록에 없는 차량은 사람이 지운 것이므로 되살리지 않는다
     * (지운 항목이 새로고침마다 돌아오던 문제).
     */
    const firstRun = entries.length === 0;
    for (const d of DEFAULT_ATTACHMENTS) {
      const existing = entries.find((e) => norm(e.plate) === norm(d.plate));
      if (!existing && !firstRun) continue;
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

    // 서류에서 읽어 둔 유효기간 — 비어 있는 칸만 채운다
    for (const v of entries) {
      const period = DEFAULT_PERIODS[norm(v.plate)];
      if (!period) continue;
      const patch: Partial<YnccVehicle> = {};
      if (!v.inspectionUntil && period.inspection) patch.inspectionUntil = period.inspection;
      if (!v.insuranceUntil && period.insurance) patch.insuranceUntil = period.insurance;
      if (Object.keys(patch).length === 0) continue;
      void add({ ...v, ...patch, updatedAt: new Date().toISOString() });
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

  /** 기간이 지난 서류는 [교체]를 빨갛게 — 목록을 훑다 바로 눈에 걸리게 한다 */
  const isExpired = (kind: CertKind, until: string | undefined) => certStatus(kind, until).level === 'expired';

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
      // 사진으로 바꾸고 만료일·차량번호를 읽는 일은 서버가 한다 — 어느 기기에서 올리든 결과가 같다
      const first = await uploadDatedCert(dataUrl, `${v.plate || '차량'}_${label}`, kind);
      const url = first.url;
      let until = first.expiresAt;
      let docPlate = first.plate;

      /*
       * 글자층이 없는 스캔본이면 한 번 더 — AI 판독으로 기간과 차량번호를 읽는다.
       * (AI 키가 없으면 조용히 빈손으로 돌아오고, 만료일은 사람이 넣게 된다)
       */
      if (!until) {
        const f = await extractDocFields(dataUrl, label);
        until = f?.periodEnd ?? null;
        docPlate = docPlate ?? f?.plate ?? null;
      }

      /*
       * 새 서류를 붙였으면 기간도 새 서류 것으로 바꾼다.
       * 다만 읽어 내지 못했을 때 예전 날짜를 지우지는 않는다 —
       * 사람이 넣어 둔 값을 없애 버리는 게 더 나쁘다.
       */
      const untilField = reg ? 'inspectionUntil' : 'insuranceUntil';
      await add({
        ...v,
        [field]: url,
        ...(until ? { [untilField]: until } : {}),
        updatedAt: new Date().toISOString(),
      });

      // 다른 차량 서류를 잘못 붙인 경우만 알린다 — 흔한 일이 아니라 알릴 값어치가 있다
      if (docPlate && !samePlate(docPlate, v.plate)) {
        alert(`서류에 적힌 차량번호는 ${docPlate}인데 ${v.plate}에 첨부했습니다. 파일을 확인해 주세요.`);
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
  /**
   * 기간이 '미확인'인 서류를 서버에 다시 읽힌다.
   *
   * 기간 읽기는 파일을 올리는 순간에만 돌아서, 그 전에 붙여 둔 서류는 계속 비어 있다.
   * 파일을 다시 올리게 하는 대신 저장된 파일을 서버가 열어 읽는다.
   */
  const rereadPeriods = async () => {
    const jobs: { v: YnccVehicle; kind: CertKind; src: string; field: 'inspectionUntil' | 'insuranceUntil' }[] = [];
    for (const v of entries) {
      if (v.regCertFile && !v.inspectionUntil) {
        jobs.push({ v, kind: 'inspection', src: v.regCertFile, field: 'inspectionUntil' });
      }
      if (v.insuranceCertFile && !v.insuranceUntil) {
        jobs.push({ v, kind: 'insurance', src: v.insuranceCertFile, field: 'insuranceUntil' });
      }
    }
    if (jobs.length === 0) {
      alert('다시 읽을 서류가 없습니다. 기간이 비어 있는 서류만 대상입니다.');
      return;
    }

    let filled = 0;
    const failed: string[] = [];
    const patched: Record<string, YnccVehicle> = {};
    // 한 건씩 — 서버에서 AI가 읽는 데 시간이 걸려 한꺼번에 보내면 밀린다
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      setRereading(`${i + 1}/${jobs.length}`);
      const got = await readCertPeriod(job.src, job.kind);
      if (got?.expiresAt) {
        // 같은 차량의 두 서류를 잇달아 채울 수 있어, 방금 채운 값을 잃지 않게 모아 둔다
        patched[job.v.id] = { ...(patched[job.v.id] ?? job.v), [job.field]: got.expiresAt };
        await add({ ...patched[job.v.id], updatedAt: new Date().toISOString() });
        filled += 1;
      } else {
        failed.push(`${job.v.plate} ${CERT_FILE_LABEL[job.kind]}`);
      }
    }
    setRereading('');
    alert(
      `${jobs.length}건 중 ${filled}건을 읽었습니다.` +
        (failed.length ? ` 못 읽은 서류: ${failed.join(', ')}` : ''),
    );
  };

  /** 엑셀·인쇄에 넘길 표 — 지금 보고 있는 분류 탭 기준 */
  const exportSpec = (): ExportSpec<YnccVehicle> => ({
    title: `YNCC 작업차량 등록 현황 (${tab})`,
    columns: [
      { label: '차량번호', value: (v) => v.plate, width: 14 },
      { label: '등록일자', value: (v) => v.regDate, width: 12 },
      { label: '차량 등록자', value: (v) => v.registrant || '미정', width: 12 },
      { label: '검사유효기간', value: (v) => v.inspectionUntil || '미확인', width: 13 },
      { label: '보험기간', value: (v) => v.insuranceUntil || '미확인', width: 13 },
      { label: '차량등록증', value: (v) => (v.regCertFile ? '첨부됨' : '없음'), width: 11 },
      { label: '보험증권', value: (v) => (v.insuranceCertFile ? '첨부됨' : '없음'), width: 11 },
    ],
    rows: shown,
  });

  const label = 'mb-1 block text-xs font-semibold text-slate-500';

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">🚚 YNCC 작업차량 등록 현황</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
          <SheetExport spec={exportSpec} className="ml-auto" />
        </div>

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
              {/* 붙일 때 못 읽고 넘어간 서류를 나중에 채운다 — 파일을 다시 올릴 필요가 없다 */}
              {canEdit && (
                <button
                  onClick={() => void rereadPeriods()}
                  disabled={!!rereading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium whitespace-nowrap text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864] disabled:opacity-50"
                  title="기간이 비어 있는 서류를 서버가 다시 읽어 채웁니다"
                >
                  {rereading ? `읽는 중 ${rereading}` : '미확인 기간 읽기'}
                </button>
              )}
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
                  <span className="ml-auto text-slate-300">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-3 py-2.5">
                    {/* 두 기간을 한 줄로 — 서류를 열지 않아도 남은 기간을 알 수 있다 */}
                    <div className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                      <span className="text-slate-500">
                        검사 <PeriodCell until={v.inspectionUntil} expired={isExpired('inspection', v.inspectionUntil)} />
                      </span>
                      <span className="text-slate-500">
                        보험 <PeriodCell until={v.insuranceUntil} expired={isExpired('insurance', v.insuranceUntil)} />
                      </span>
                    </div>
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
                          expired={isExpired('inspection', v.inspectionUntil)}
                          fullscreen
                          onFile={(f) => void attach(v, 'regCertFile', f)}
                        />
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
                          expired={isExpired('insurance', v.insuranceUntil)}
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
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">검사유효기간</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">보험기간</th>
                <th className="w-28 px-2 py-2.5 text-center font-semibold">차량등록증</th>
                <th className="w-28 px-2 py-2.5 text-center font-semibold">보험증권</th>
                <th className="px-4 py-2.5 font-semibold">최근 변경</th>
                <th className="w-10 px-2 py-2.5" aria-label="삭제" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-300">
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
                  <td className="px-4 py-2.5">
                    <PeriodCell until={v.inspectionUntil} expired={isExpired('inspection', v.inspectionUntil)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <PeriodCell until={v.insuranceUntil} expired={isExpired('insurance', v.insuranceUntil)} />
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <CertView
                      label="자동차등록증"
                      url={v.regCertFile}
                      plate={v.plate}
                      canEdit={canEdit}
                      uploading={uploading === `${v.id}:regCertFile`}
                      inputId={`yv-reg-${v.id}`}
                      expired={isExpired('inspection', v.inspectionUntil)}
                      onFile={(f) => void attach(v, 'regCertFile', f)}
                    />
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <CertView
                      label="보험증권"
                      url={v.insuranceCertFile}
                      plate={v.plate}
                      canEdit={canEdit}
                      uploading={uploading === `${v.id}:insuranceCertFile`}
                      inputId={`yv-ins-${v.id}`}
                      expired={isExpired('insurance', v.insuranceUntil)}
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
          있고, 인쇄가 필요하면 [원본 PDF]를 쓰면 됩니다. [교체]가 빨갛게 보이면 검사유효기간이나 보험기간이 지난
          서류이니 새 서류로 바꿔 주세요.
          {canEdit
            ? ' 차량번호는 고정이고 등록일자·차량 등록자만 수시로 갱신됩니다. 표에서 차량을 클릭하면 위 입력창으로 불러와 갱신할 수 있고, 서류는 [교체]로 바꿀 수 있습니다. 만료일은 서류를 올릴 때 자동으로 읽지만, 스캔 서류는 글자가 없어 못 읽으므로 직접 넣어 주세요.'
            : ' 차량 등록자만 고칠 수 있고, 서류 교체는 관리자에게 요청해 주세요.'}
        </p>
      </div>
    </div>
  );
}
