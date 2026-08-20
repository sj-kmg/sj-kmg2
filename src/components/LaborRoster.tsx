'use client';

import { useEffect, useRef, useState } from 'react';
import { HEALTH_KEY, type HealthCheck } from '@/lib/health';
import { LABOR_ROSTER_KEY, LABOR_TABS, UNASSIGNED, blankWorker, type LaborWorker } from '@/lib/laborRoster';
import { formatPhone } from '@/lib/format';
import { fileHref } from '@/lib/ids';
import { SyncError, extractDocFields, listEntriesSilently, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { useRole } from '@/lib/useRole';
import { CHEM_WORKERS_KEY, YNCC_WORKERS_KEY, type EduSheetWorker } from '@/lib/yncc';
import { LABOR_CATEGORIES, laborColor } from '@/lib/workforce';
import { useSortable } from '@/lib/useSortable';
import { CELL, SortButton } from './SheetUI';

/**
 * 롯데케미칼 #1 H-NC Effluent Line 작업(26.04.06) 인력업체 원본 서류 반영.
 * 유해화학물질 이수증·수료증, 배치전건강진단(특수검진) 확인서를 인원별로 나눠 붙였다.
 */
const DEFAULT_WORKERS: {
  name: string;
  category: string;
  birth: string;
  phone?: string;
  chemDate: string;
  chemCert: string;
  chemCertCompletion?: string;
  specialHealthDate?: string;
  specialHealthCert?: string;
}[] = [
  { name: '이형일', category: '개미인력', birth: '1976-12-15', chemDate: '2025-08-25', chemCert: '/certs/labor-roster/개미인력/이형일_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/이형일_수료증.jpg' },
  { name: '곽철호', category: '개미인력', birth: '1969-08-19', chemDate: '2024-03-05', chemCert: '/certs/labor-roster/개미인력/곽철호_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/곽철호_수료증.jpg' },
  { name: '김상민', category: '개미인력', birth: '1982-11-28', chemDate: '2026-04-03', chemCert: '/certs/labor-roster/개미인력/김상민_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김상민_수료증.jpg' },
  { name: '김영순', category: '개미인력', birth: '1975-12-19', chemDate: '2026-03-30', chemCert: '/certs/labor-roster/개미인력/김영순_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김영순_수료증.jpg' },
  { name: '김재식', category: '개미인력', birth: '1966-05-23', chemDate: '2025-01-31', chemCert: '/certs/labor-roster/개미인력/김재식_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김재식_수료증.jpg' },
  { name: '김재호', category: '개미인력', birth: '1969-07-12', chemDate: '2025-04-03', chemCert: '/certs/labor-roster/개미인력/김재호_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김재호_수료증.jpg' },
  { name: '신지훈', category: '개미인력', birth: '1994-05-01', chemDate: '2024-03-13', chemCert: '/certs/labor-roster/개미인력/신지훈_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/신지훈_수료증.jpg' },
  { name: '유승일', category: '개미인력', birth: '1987-04-24', chemDate: '2024-06-13', chemCert: '/certs/labor-roster/개미인력/유승일_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/유승일_수료증.jpg' },
  { name: '이상현', category: '개미인력', birth: '1971-06-20', chemDate: '2025-03-04', chemCert: '/certs/labor-roster/개미인력/이상현_이수증.jpg' },
  { name: '이성현', category: '개미인력', birth: '1983-07-07', chemDate: '2025-02-11', chemCert: '/certs/labor-roster/개미인력/이성현_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/이성현_수료증.jpg' },
  { name: '임채갑', category: '개미인력', birth: '1965-02-02', chemDate: '2026-01-08', chemCert: '/certs/labor-roster/개미인력/임채갑_이수증.jpg' },
  { name: '정재수', category: '개미인력', birth: '1987-02-15', chemDate: '2026-02-11', chemCert: '/certs/labor-roster/개미인력/정재수_이수증.jpg' },
  { name: '정현종', category: '개미인력', birth: '1969-08-14', chemDate: '2024-02-24', chemCert: '/certs/labor-roster/개미인력/정현종_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/정현종_수료증.jpg' },
  { name: '최준규', category: '개미인력', birth: '1979-01-12', chemDate: '2026-04-17', chemCert: '/certs/labor-roster/개미인력/최준규_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/최준규_수료증.jpg' },
  { name: '하장훈', category: '개미인력', birth: '1973-06-01', chemDate: '2026-03-23', chemCert: '/certs/labor-roster/개미인력/하장훈_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/하장훈_수료증.jpg' },
  { name: '김경식', category: '공영인력', birth: '1964-01-10', chemDate: '2024-03-21', chemCert: '/certs/labor-roster/공영인력/김경식_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/김경식_수료증.pdf' },
  { name: '김광춘', category: '공영인력', birth: '1981-03-24', chemDate: '2026-01-24', chemCert: '/certs/labor-roster/공영인력/김광춘_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/김광춘_수료증.pdf' },
  { name: '김학판', category: '공영인력', birth: '1959-11-15', chemDate: '2026-01-10', chemCert: '/certs/labor-roster/공영인력/김학판_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/김학판_수료증.pdf' },
  { name: '오재정', category: '공영인력', birth: '1978-05-12', chemDate: '2024-01-18', chemCert: '/certs/labor-roster/공영인력/오재정_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/오재정_수료증.pdf' },
  { name: '이진호', category: '공영인력', birth: '1975-11-21', chemDate: '2024-08-05', chemCert: '/certs/labor-roster/공영인력/이진호_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/이진호_수료증.pdf' },
  { name: '임복수', category: '공영인력', birth: '1974-06-15', chemDate: '2025-02-14', chemCert: '/certs/labor-roster/공영인력/임복수_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/임복수_수료증.pdf' },
  { name: '조운용', category: '공영인력', birth: '1964-01-02', chemDate: '2024-03-21', chemCert: '/certs/labor-roster/공영인력/조운용_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/조운용_수료증.pdf' },
  { name: '김우영', category: '당근인력', birth: '1972-01-19', phone: '010-8244-4302', chemDate: '2026-01-28', chemCert: '/certs/labor-roster/당근인력/김우영_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/김우영_수료증.pdf' },
  { name: '김효종', category: '당근인력', birth: '1975-10-30', phone: '010-8531-5641', chemDate: '2026-02-19', chemCert: '/certs/labor-roster/당근인력/김효종_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/김효종_수료증.pdf', specialHealthDate: '2026-04-30', specialHealthCert: '/certs/labor-roster/당근인력/김효종_특검확인서.jpg' },
  { name: '문기영', category: '당근인력', birth: '1981-01-19', phone: '010-7334-1016', chemDate: '2026-03-25', chemCert: '/certs/labor-roster/당근인력/문기영_이수증.pdf', specialHealthDate: '2026-05-02', specialHealthCert: '/certs/labor-roster/당근인력/문기영_특검확인서.jpg' },
  { name: '문병곤', category: '당근인력', birth: '1962-03-27', chemDate: '2024-08-01', chemCert: '/certs/labor-roster/당근인력/문병곤_이수증.pdf', specialHealthDate: '2026-04-30', specialHealthCert: '/certs/labor-roster/당근인력/문병곤_특검확인서.jpg' },
  { name: '박은식', category: '당근인력', birth: '1986-03-15', phone: '010-4181-4440', chemDate: '2025-10-16', chemCert: '/certs/labor-roster/당근인력/박은식_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/박은식_수료증.pdf', specialHealthDate: '2026-05-04', specialHealthCert: '/certs/labor-roster/당근인력/박은식_특검확인서.jpg' },
  { name: '박종훈', category: '당근인력', birth: '1986-10-08', phone: '010-6409-5860', chemDate: '2026-01-16', chemCert: '/certs/labor-roster/당근인력/박종훈_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/박종훈_수료증.pdf', specialHealthDate: '2026-04-30', specialHealthCert: '/certs/labor-roster/당근인력/박종훈_특검확인서.jpg' },
  { name: '박준영', category: '당근인력', birth: '1962-10-19', chemDate: '2025-10-15', chemCert: '/certs/labor-roster/당근인력/박준영_이수증.pdf', specialHealthDate: '2026-04-30', specialHealthCert: '/certs/labor-roster/당근인력/박준영_특검확인서.jpg' },
  { name: '박창환', category: '당근인력', birth: '1973-01-20', phone: '010-8210-3935', chemDate: '2025-02-12', chemCert: '/certs/labor-roster/당근인력/박창환_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/박창환_수료증.pdf' },
  { name: '백두재', category: '당근인력', birth: '1971-04-03', phone: '010-5936-1190', chemDate: '2025-11-11', chemCert: '/certs/labor-roster/당근인력/백두재_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/백두재_수료증.pdf', specialHealthDate: '2026-05-02', specialHealthCert: '/certs/labor-roster/당근인력/백두재_특검확인서.jpg' },
  { name: '서광철', category: '당근인력', birth: '1970-11-17', phone: '010-6697-1056', chemDate: '2025-05-16', chemCert: '/certs/labor-roster/당근인력/서광철_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/서광철_수료증.pdf', specialHealthDate: '2026-05-02', specialHealthCert: '/certs/labor-roster/당근인력/서광철_특검확인서.jpg' },
  { name: '이정동', category: '당근인력', birth: '1969-02-07', phone: '010-6223-6033', chemDate: '2025-01-15', chemCert: '/certs/labor-roster/당근인력/이정동_이수증.pdf', specialHealthDate: '2026-04-30', specialHealthCert: '/certs/labor-roster/당근인력/이정동_특검확인서.jpg' },
  { name: '홍덕현', category: '당근인력', birth: '1988-01-15', chemDate: '2024-02-19', chemCert: '/certs/labor-roster/당근인력/홍덕현_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/홍덕현_수료증.pdf', specialHealthDate: '2026-05-02', specialHealthCert: '/certs/labor-roster/당근인력/홍덕현_특검확인서.jpg' },
  { name: '황성만', category: '당근인력', birth: '1981-01-23', chemDate: '2026-02-07', chemCert: '/certs/labor-roster/당근인력/황성만_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/황성만_수료증.pdf', specialHealthDate: '2026-05-02', specialHealthCert: '/certs/labor-roster/당근인력/황성만_특검확인서.jpg' },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 인력 명단 엑셀(명단서식)에서 뽑은 신규 인원 — 이름·생년월일·연락처만 반영한다.
 * 주민등록번호 전체는 민감정보라 저장하지 않고, 앞 6자리에서 생년월일만 뽑아 쓴다.
 * 이름이 이미 있는 사람은 아예 건너뛴다 (기존 기록을 건드리지 않는다).
 */
const DEFAULT_ROSTER: { category: string; name: string; birth: string; phone: string }[] = [
  // 배영일·이진호는 이미 등록돼 있어 넣지 않는다 (이름이 겹치면 건너뛴다)
  { category: '공영인력', name: '김광모', birth: '1978-09-25', phone: '010-2767-4098' },
];

/**
 * 첨부파일 이름에서 이수년도를 뽑는다 — 파일명에 20xx가 있으면 그 해로,
 * 없으면 올린 시점의 연도로 본다 (예: "2026 취급자 안전교육.pdf" → 2026).
 */
function yearFromFileName(fileName: string): number {
  const now = new Date().getFullYear();
  const found = fileName.match(/20\d{2}/g);
  if (!found) return now;
  // 미래 연도(스캔 오인식 등)는 버리고 가장 최근 연도를 쓴다
  const years = found.map(Number).filter((y) => y >= 2000 && y <= now + 1);
  return years.length ? Math.max(...years) : now;
}

/** 값이 비어 있을 때만 채운다 — 이미 입력된 값은 덮어쓰지 않는다 */
function fillBlank<T extends object>(base: T, patch: Partial<T>): { next: T; changed: boolean } {
  let changed = false;
  const next = { ...base };
  for (const k of Object.keys(patch) as (keyof T)[]) {
    const v = patch[k];
    if (v && !next[k]) {
      next[k] = v;
      changed = true;
    }
  }
  return { next, changed };
}

/**
 * 공무관리 › 인력관리 — 공영·개미·여수·여천·당근인력 5개 분류별 인원 관리.
 * 인원별로 특수검진 첨부파일·유해화학물질 첨부파일·YNCC 교육기간·일반검진일자를 한곳에서 본다.
 */
export default function LaborRoster() {
  const { rows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<LaborWorker>(
    'labor-roster',
    LABOR_ROSTER_KEY,
    {
      isBlank: (r) => !r.name.trim(),
      sort: (a, b) => a.name.localeCompare(b.name, 'ko'),
    },
  );

  const { role } = useRole();
  const [tab, setTab] = useState<string>(LABOR_CATEGORIES[0]);
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateNote, setMigrateNote] = useState('');
  const seq = useRef(0);
  const seededRef = useRef(false);
  const sortCtl = useSortable<LaborWorker>();
  // 최초 반영 처리에서 최신 목록을 보기 위한 참조 (state는 그 시점에 아직 비어 있을 수 있다)
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const shown = sortCtl.apply(
    rows.filter((r) => (tab === UNASSIGNED ? !r.category : r.category === tab)),
    { name: (r) => r.name, chem: (r) => r.chemDate ?? '' },
  );

  /*
   * 원본 자료 최초 반영 — 이미 있는 사람은 절대 다시 만들지 않는다.
   *
   * 예전에는 여기서 화면 상태(rows)를 그대로 봤는데, 목록이 채워지는 것보다
   * 이 처리가 먼저 돌아 "아무도 없다"고 판단해 이미 있는 사람을 또 만들었다.
   * 그래서 (1) 항상 최신 목록을 가리키는 ref를 쓰고, (2) 목록이 채워진 뒤에
   * 돌도록 한 박자 미루고, (3) 이번 처리 중에 새로 만든 이름도 기억해
   * 뒤 단계에서 중복으로 만들지 않게 한다.
   */
  useEffect(() => {
    if (seededRef.current || mode === 'loading' || role === 'viewer') return;
    seededRef.current = true;

    const timer = setTimeout(() => {
      const norm = (s: string) => s.replace(/\s/g, '');
      const added = new Set<string>();
      const findByName = (name: string) =>
        rowsRef.current.find((r) => norm(r.name) === norm(name));
      let seq2 = 0;

      for (const d of DEFAULT_WORKERS) {
        if (added.has(norm(d.name))) continue;
        const existing = findByName(d.name);
        if (existing) {
          const { next, changed } = fillBlank(existing, {
            category: existing.category || d.category,
            birth: d.birth,
            phone: d.phone,
            chemDate: d.chemDate,
            chemCert: d.chemCert,
            chemCertCompletion: d.chemCertCompletion,
            specialHealthDate: d.specialHealthDate,
            specialHealthCert: d.specialHealthCert,
          });
          if (changed) setRow(existing.id, next);
        } else {
          seq2 += 1;
          added.add(norm(d.name));
          addRow({
            id: `LW-seed-${Date.now()}-${seq2}`,
            category: d.category,
            name: d.name,
            birth: d.birth,
            phone: d.phone,
            chemDate: d.chemDate,
            chemCert: d.chemCert,
            chemCertCompletion: d.chemCertCompletion,
            specialHealthDate: d.specialHealthDate,
            specialHealthCert: d.specialHealthCert,
            updatedAt: '',
          });
        }
      }

      // 엑셀 명단 — 이름이 겹치면 건너뛰고, 신규 인원만 이름·생년월일·연락처로 등록한다
      for (const d of DEFAULT_ROSTER) {
        if (added.has(norm(d.name)) || findByName(d.name)) continue;
        seq2 += 1;
        added.add(norm(d.name));
        addRow({
          id: `LW-seed-${Date.now()}-r${seq2}`,
          category: d.category,
          name: d.name,
          birth: d.birth,
          phone: d.phone,
          updatedAt: '',
        });
      }
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, role]);

  const add = () => {
    seq.current += 1;
    const id = `LW-${Date.now()}-${seq.current}`;
    addRow({ id, ...blankWorker(tab), updatedAt: '' });
    setOpen(id);
  };

  const del = (r: LaborWorker) => {
    if (r.name.trim() && !confirm(`[${r.name}] 인력 기록을 삭제할까요? 되돌리기로 복구할 수 있습니다.`)) return;
    void removeRow(r.id);
  };

  const attachFile = async (
    row: LaborWorker,
    field: 'specialHealthCert' | 'chemCert' | 'chemCertCompletion' | 'generalHealthCert',
    file: File | undefined,
  ) => {
    if (!file) return;
    if (file.size > 8_000_000) {
      alert('파일이 너무 큽니다. 8MB 이하 PDF·이미지를 첨부해 주세요.');
      return;
    }
    setUploading(`${row.id}-${field}`);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadCert(dataUrl, `${row.name || '첨부'}`);
      setRow(row.id, { [field]: url } as Partial<LaborWorker>);

      // 서류를 읽어 비어 있는 칸을 채운다 — 사람이 적어 둔 값은 건드리지 않는다
      const HINT: Record<typeof field, string> = {
        chemCert: '유해화학물질 안전교육 이수증',
        chemCertCompletion: '유해화학물질 안전교육 수료증',
        specialHealthCert: '특수건강진단 확인서',
        generalHealthCert: 'LG화학 일반건강진단 결과표',
      };
      const f = await extractDocFields(dataUrl, HINT[field]);
      // 판독 중 사용자가 직접 고쳤을 수 있으므로 최신 값을 다시 확인한다
      const cur = rowsRef.current.find((x) => x.id === row.id) ?? row;
      const auto: Partial<LaborWorker> = {};
      if (f?.birth && !cur.birth) auto.birth = f.birth;
      if (field === 'chemCert' || field === 'chemCertCompletion') {
        // 이수년도 — 서류에서 읽은 이수일자를 쓰고, 못 읽으면 파일명의 연도로 대신한다
        if (!cur.chemDate) auto.chemDate = f?.issuedAt ?? `${yearFromFileName(file.name)}-01-01`;
      }
      if (field === 'specialHealthCert' && f?.issuedAt && !cur.specialHealthDate) {
        auto.specialHealthDate = f.issuedAt;
      }
      if (field === 'generalHealthCert' && f?.issuedAt && !cur.generalHealthDate) {
        auto.generalHealthDate = f.issuedAt;
      }
      if (Object.keys(auto).length > 0) setRow(row.id, auto);

      // 서류의 이름이 다르면 사람이 확인하도록 알린다 (값은 바꾸지 않는다)
      if (f?.personName && cur.name.trim() && f.personName.replace(/\s/g, '') !== cur.name.replace(/\s/g, '')) {
        alert(`첨부한 서류의 이름은 "${f.personName}"입니다.\n지금 기록은 "${cur.name}"이니 확인해 주세요.`);
      }
    } catch (e) {
      if (e instanceof SyncError && (e.status === 503 || e.status === 401)) {
        alert('첨부파일 업로드는 배포된 사이트에서 동기화 암호를 입력한 뒤 사용할 수 있습니다.');
      } else {
        alert('업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setUploading(null);
    }
  };

  /**
   * 기존 인력 데이터 불러오기 — 건강검진(일반·특수)·유해화학물질·YNCC출입 메뉴의
   * "인력" 그룹 항목을 이름 기준으로 병합해 채워 넣는다. 이미 입력된 값은 건드리지 않는다.
   */
  const migrate = async () => {
    setMigrating(true);
    setMigrateNote('');
    try {
      const [health, chem, yncc] = await Promise.all([
        listEntriesSilently<HealthCheck>('health', HEALTH_KEY),
        listEntriesSilently<EduSheetWorker>('chem-workers', CHEM_WORKERS_KEY),
        listEntriesSilently<EduSheetWorker>('yncc-workers', YNCC_WORKERS_KEY),
      ]);

      const patchByName = new Map<string, Partial<LaborWorker>>();
      const merge = (name: string, patch: Partial<LaborWorker>) => {
        const key = name.trim();
        if (!key) return;
        patchByName.set(key, { ...patchByName.get(key), ...patch });
      };

      for (const h of health.filter((h) => h.group === '인력')) {
        if (h.kind === 'special') merge(h.name, { specialHealthDate: h.checkDate, specialHealthCert: h.certFile, birth: h.birth });
        else merge(h.name, { generalHealthDate: h.checkDate, birth: h.birth });
      }
      for (const c of chem.filter((c) => c.group === '인력')) {
        merge(c.name, { chemCert: c.certFile, chemDate: c.offlineDate || c.onlineDate, birth: c.birth });
      }
      for (const y of yncc.filter((y) => y.group === '인력')) {
        merge(y.name, { ynccStart: y.offlineDate || y.lastEdu, ynccEnd: y.eduExpire, birth: y.birth });
      }

      let added = 0;
      let filled = 0;
      const batchStamp = Date.now();
      for (const [name, patch] of patchByName) {
        const existing = rows.find((r) => r.name.trim() === name);
        if (existing) {
          const { next, changed } = fillBlank(existing, patch);
          if (changed) {
            setRow(existing.id, next);
            filled++;
          }
        } else {
          seq.current += 1;
          addRow({ id: `LW-${batchStamp}-${seq.current}`, category: '', name, updatedAt: '', ...patch });
          added++;
        }
      }
      setMigrateNote(
        added === 0 && filled === 0
          ? '새로 불러올 인력 항목이 없습니다.'
          : `${added}명 새로 추가, ${filled}명 정보 보완 완료. "${UNASSIGNED}" 탭에서 분류를 지정해 주세요.`,
      );
      if (added > 0) setTab(UNASSIGNED);
    } finally {
      setMigrating(false);
    }
  };

  const badge = saveBadge(status, mode);
  const label = 'mb-1 block text-[11px] font-semibold text-slate-500';

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          👷 인력관리
          <span className="ml-1.5 font-normal text-slate-400">전체 {rows.length}명</span>
        </h3>
        {badge && <span className={`text-xs ${badge.className}`}>{badge.text}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => void migrate()}
            disabled={migrating}
            title="건강검진·유해화학물질·YNCC출입 메뉴의 인력 항목을 이름 기준으로 가져옵니다 (이미 입력된 값은 유지)"
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864] disabled:opacity-40"
          >
            {migrating ? '불러오는 중…' : '⇩ 기존 인력 데이터 불러오기'}
          </button>
          <button
            onClick={() => void undo()}
            disabled={!canUndo}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864] disabled:opacity-40"
          >
            ↩ 되돌리기
          </button>
          <span className="flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500">
            이름<SortButton ctl={sortCtl} col="name" label="이름" />
            <span className="mx-1.5 text-slate-300">|</span>
            유해화학물질<SortButton ctl={sortCtl} col="chem" label="유해화학물질 이수일자" />
          </span>
          <button
            onClick={add}
            className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
          >
            ＋ 인원 추가
          </button>
        </div>
      </div>

      {migrateNote && (
        <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">{migrateNote}</p>
      )}

      {/* 분류 탭 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {LABOR_TABS.map((t) => {
          const count = rows.filter((r) => (t === UNASSIGNED ? !r.category : r.category === t)).length;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                active ? 'bg-[#1f3864] text-white' : 'border border-slate-200 text-slate-600 hover:border-[#1f3864]'
              }`}
            >
              {t !== UNASSIGNED && (
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: active ? '#fff' : laborColor(t) }} />
              )}
              {t}
              <span className={`font-mono ${active ? 'text-white/80' : 'text-slate-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
          {mode === 'loading'
            ? '기록을 불러오는 중…'
            : `${tab}에 등록된 인원이 없습니다. [＋ 인원 추가]로 등록하거나 [기존 인력 데이터 불러오기]를 눌러 보세요.`}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const isOpen = open === r.id;
            const statusChips = [
              { label: '특수검진', ok: !!r.specialHealthCert },
              { label: '유해화학물질', ok: !!r.chemCert },
              { label: 'YNCC', ok: !!r.ynccStart || !!r.ynccEnd },
              { label: '일반검진', ok: !!r.generalHealthDate },
            ];
            return (
              <article key={r.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-bold text-slate-800">{r.name || '(이름 없음)'}</span>
                  {r.birth && <span className="font-mono text-[11px] text-slate-400">{r.birth}</span>}
                  <span className="flex flex-wrap items-center gap-1">
                    {statusChips.map((c) => (
                      <span
                        key={c.label}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          c.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {c.ok ? '✓' : '·'} {c.label}
                      </span>
                    ))}
                  </span>
                  <span aria-hidden className="ml-auto shrink-0 text-[10px] text-slate-400">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    {/* 인적사항 — 칸 폭을 내용에 맞춰 좁게 잡는다 */}
                    <div className="flex flex-wrap gap-2.5">
                      <div className="w-28">
                        <label className={label} htmlFor={`lw-name-${r.id}`}>이름</label>
                        <input id={`lw-name-${r.id}`} placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} className={CELL} />
                      </div>
                      <div className="w-32">
                        <label className={label} htmlFor={`lw-cat-${r.id}`}>분류</label>
                        <select
                          id={`lw-cat-${r.id}`}
                          value={r.category}
                          onChange={(e) => setRow(r.id, { category: e.target.value })}
                          className={CELL}
                        >
                          <option value="">{UNASSIGNED}</option>
                          {LABOR_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-36">
                        <label className={label} htmlFor={`lw-birth-${r.id}`}>생년월일</label>
                        <input id={`lw-birth-${r.id}`} type="date" value={r.birth ?? ''} onChange={(e) => setRow(r.id, { birth: e.target.value })} className={CELL} />
                      </div>
                      <div className="w-36">
                        <label className={label} htmlFor={`lw-phone-${r.id}`}>휴대폰</label>
                        <input
                          id={`lw-phone-${r.id}`}
                          type="tel"
                          inputMode="tel"
                          placeholder="010-0000-0000"
                          value={r.phone ?? ''}
                          onChange={(e) => setRow(r.id, { phone: formatPhone(e.target.value) })}
                          className={`${CELL} font-mono`}
                        />
                      </div>
                    </div>

                    {/* 검진·교육 4종 — LG화학 일반검진 · 특수검진 · 유해화학물질 · YNCC */}
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {/* LG화학 일반검진 — 일자 + 결과표 첨부 */}
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-1.5 text-xs font-bold text-slate-600">LG화학 일반검진</p>
                        <div className="mb-2 w-36">
                          <input
                            type="date"
                            aria-label="LG화학 일반검진 일자"
                            value={r.generalHealthDate ?? ''}
                            onChange={(e) => setRow(r.id, { generalHealthDate: e.target.value })}
                            className={`${CELL} bg-white`}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-12 shrink-0 text-[11px] text-slate-500">결과표</span>
                          <AttachButtons
                            url={r.generalHealthCert}
                            uploading={uploading === `${r.id}-generalHealthCert`}
                            inputId={`lw-general-${r.id}`}
                            onFile={(file) => void attachFile(r, 'generalHealthCert', file)}
                          />
                        </div>
                      </div>

                      {/* 특수검진 첨부파일 — 일자 없이 확인서만 */}
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-1.5 text-xs font-bold text-slate-600">특수검진 첨부파일</p>
                        <div className="flex items-center gap-1.5">
                          <span className="w-12 shrink-0 text-[11px] text-slate-500">확인서</span>
                          <AttachButtons
                            url={r.specialHealthCert}
                            uploading={uploading === `${r.id}-specialHealthCert`}
                            inputId={`lw-special-${r.id}`}
                            onFile={(file) => void attachFile(r, 'specialHealthCert', file)}
                          />
                        </div>
                      </div>

                      {/* 유해화학물질 — 이수년도(4자리) + 이수증·수료증 */}
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="whitespace-nowrap text-xs font-bold text-slate-600">유해화학물질 첨부파일</p>
                          <label className="whitespace-nowrap text-[11px] text-slate-500" htmlFor={`lw-chemyear-${r.id}`}>
                            이수년도
                          </label>
                          <div className="w-16">
                            <input
                              id={`lw-chemyear-${r.id}`}
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="0000"
                              value={r.chemDate ? r.chemDate.slice(0, 4) : ''}
                              onChange={(e) => {
                                const y = e.target.value.replace(/\D/g, '').slice(0, 4);
                                // 연도만 바꾸고 월·일은 원래 값을 유지한다
                                setRow(r.id, { chemDate: y ? `${y}${(r.chemDate ?? '').slice(4) || '-01-01'}` : '' });
                              }}
                              className={`${CELL} bg-white text-center`}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-12 shrink-0 text-[11px] text-slate-500">이수증</span>
                            <AttachButtons
                              url={r.chemCert}
                              uploading={uploading === `${r.id}-chemCert`}
                              inputId={`lw-chem-${r.id}`}
                              onFile={(file) => void attachFile(r, 'chemCert', file)}
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-12 shrink-0 text-[11px] text-slate-500">수료증</span>
                            <AttachButtons
                              url={r.chemCertCompletion}
                              uploading={uploading === `${r.id}-chemCertCompletion`}
                              inputId={`lw-chem-comp-${r.id}`}
                              onFile={(file) => void attachFile(r, 'chemCertCompletion', file)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* YNCC 교육기간 */}
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-1.5 text-xs font-bold text-slate-600">YNCC 교육기간</p>
                        <div className="flex items-center gap-1.5">
                          <div className="w-36">
                            <input
                              type="date"
                              aria-label="YNCC 교육기간 시작"
                              value={r.ynccStart ?? ''}
                              onChange={(e) => setRow(r.id, { ynccStart: e.target.value })}
                              className={`${CELL} bg-white`}
                            />
                          </div>
                          <span className="shrink-0 text-slate-400">~</span>
                          <div className="w-36">
                            <input
                              type="date"
                              aria-label="YNCC 교육기간 종료"
                              value={r.ynccEnd ?? ''}
                              onChange={(e) => setRow(r.id, { ynccEnd: e.target.value })}
                              className={`${CELL} bg-white`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button onClick={() => del(r)} className="text-xs text-slate-300 hover:text-red-500">
                        이 인력 기록 삭제
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        건강검진·유해화학물질·YNCC출입 메뉴의 &ldquo;인력&rdquo; 탭에 입력된 내용은 [⇩ 기존 인력 데이터 불러오기]로 이름 기준
        병합해 가져올 수 있습니다 (이미 입력된 값은 덮어쓰지 않습니다). 분류가 없는 인원은 &ldquo;{UNASSIGNED}&rdquo; 탭에서 확인할 수 있습니다.
      </p>
    </div>
  );
}

/** 첨부 파일 보기·첨부·교체 버튼 한 줄 */
function AttachButtons({
  url,
  uploading,
  inputId,
  onFile,
}: {
  url?: string;
  uploading: boolean;
  inputId: string;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {url && (
        <a
          href={fileHref(url)}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
        >
          📄 보기
        </a>
      )}
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded border border-dashed border-slate-300 bg-white px-2 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:border-[#1f3864] hover:text-[#1f3864]"
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
    </div>
  );
}
