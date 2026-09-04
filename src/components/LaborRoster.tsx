'use client';

import { useEffect, useRef, useState } from 'react';
import { HEALTH_KEY, type HealthCheck } from '@/lib/health';
import { LABOR_ROSTER_KEY, LABOR_TABS, UNASSIGNED, autoFillFromDoc, blankWorker, type LaborWorker } from '@/lib/laborRoster';
import { formatPhone } from '@/lib/format';
import { NOTICE_STYLE } from '@/lib/education';
import {
  HAZARD_CYCLE_MONTHS,
  WATCHED_HAZARDS,
  applyHazardCheck,
  hazardStatuses,
  type HazardWatch,
} from '@/lib/hazardWatch';
import { fileHref, nameId } from '@/lib/ids';
import { SyncError, extractDocFields, listEntriesSilently, uploadCert } from '@/lib/sync';
import { saveBadge, useSheetLog } from '@/lib/useSheetLog';
import { useRole } from '@/lib/useRole';
import { CHEM_WORKERS_KEY, YNCC_WORKERS_KEY, type EduSheetWorker } from '@/lib/yncc';
import { LABOR_CATEGORIES, laborColor } from '@/lib/workforce';
import { useSortable } from '@/lib/useSortable';
import SheetExport from './SheetExport';
import type { ExportSpec } from '@/lib/sheetExport';
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
  /** 유해화학물질 서류가 아직 없는 인원도 있어 선택값으로 둔다 */
  chemDate?: string;
  chemCert?: string;
  chemCertCompletion?: string;
  specialHealthDate?: string;
  specialHealthCert?: string;
}[] = [
  { name: '이형일', category: '개미인력', birth: '1976-12-15', chemDate: '2025-08-25', chemCert: '/certs/labor-roster/개미인력/이형일_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/이형일_수료증.jpg' },
  { name: '곽철호', category: '개미인력', birth: '1969-08-19', chemDate: '2024-03-05', chemCert: '/certs/labor-roster/개미인력/곽철호_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/곽철호_수료증.jpg' },
  { name: '김상민', category: '개미인력', birth: '1982-11-28', chemDate: '2026-04-03', chemCert: '/certs/labor-roster/개미인력/김상민_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김상민_수료증.jpg', specialHealthDate: '2026-04-04', specialHealthCert: '/certs/labor-roster/개미인력/김상민_특검확인서.pdf' },
  { name: '김영순', category: '개미인력', birth: '1975-12-19', chemDate: '2026-03-30', chemCert: '/certs/labor-roster/개미인력/김영순_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김영순_수료증.jpg', specialHealthDate: '2026-04-03', specialHealthCert: '/certs/labor-roster/개미인력/김영순_특검확인서.pdf' },
  { name: '김재식', category: '개미인력', birth: '1966-05-23', chemDate: '2025-01-31', chemCert: '/certs/labor-roster/개미인력/김재식_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김재식_수료증.jpg', specialHealthDate: '2026-04-04', specialHealthCert: '/certs/labor-roster/개미인력/김재식_특검확인서.pdf' },
  { name: '김재호', category: '개미인력', birth: '1969-07-12', chemDate: '2025-04-03', chemCert: '/certs/labor-roster/개미인력/김재호_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/김재호_수료증.jpg', specialHealthDate: '2026-04-03', specialHealthCert: '/certs/labor-roster/개미인력/김재호_특검확인서.pdf' },
  { name: '신지훈', category: '개미인력', birth: '1994-05-01', chemDate: '2024-03-13', chemCert: '/certs/labor-roster/개미인력/신지훈_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/신지훈_수료증.jpg', specialHealthDate: '2026-04-01', specialHealthCert: '/certs/labor-roster/개미인력/신지훈_특검확인서.pdf' },
  { name: '유승일', category: '개미인력', birth: '1987-04-24', chemDate: '2024-06-13', chemCert: '/certs/labor-roster/개미인력/유승일_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/유승일_수료증.jpg', specialHealthDate: '2026-04-04', specialHealthCert: '/certs/labor-roster/개미인력/유승일_특검확인서.pdf' },
  { name: '이상현', category: '개미인력', birth: '1971-06-20', chemDate: '2025-03-04', chemCert: '/certs/labor-roster/개미인력/이상현_이수증.jpg', specialHealthDate: '2026-04-04', specialHealthCert: '/certs/labor-roster/개미인력/이상현_특검확인서.pdf' },
  { name: '이성현', category: '개미인력', birth: '1983-07-07', chemDate: '2025-02-11', chemCert: '/certs/labor-roster/개미인력/이성현_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/이성현_수료증.jpg' },
  { name: '이태곤', category: '개미인력', birth: '1966-03-13', phone: '010-7145-4215', chemDate: '2026-01-08', chemCert: '/certs/labor-roster/개미인력/이태곤_이수증.jpg', specialHealthDate: '2026-03-07', specialHealthCert: '/certs/labor-roster/개미인력/이태곤_특검확인서.pdf' },
  { name: '임채갑', category: '개미인력', birth: '1965-02-02', chemDate: '2026-01-08', chemCert: '/certs/labor-roster/개미인력/임채갑_이수증.jpg', specialHealthDate: '2026-03-07', specialHealthCert: '/certs/labor-roster/개미인력/임채갑_특검확인서.pdf' },
  { name: '정재수', category: '개미인력', birth: '1987-02-15', chemDate: '2026-02-11', chemCert: '/certs/labor-roster/개미인력/정재수_이수증.jpg', specialHealthDate: '2026-04-03', specialHealthCert: '/certs/labor-roster/개미인력/정재수_특검확인서.pdf' },
  { name: '정현종', category: '개미인력', birth: '1969-08-14', chemDate: '2024-02-24', chemCert: '/certs/labor-roster/개미인력/정현종_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/정현종_수료증.jpg', specialHealthDate: '2026-04-04', specialHealthCert: '/certs/labor-roster/개미인력/정현종_특검확인서.pdf' },
  { name: '최준규', category: '개미인력', birth: '1979-01-12', chemDate: '2026-04-17', chemCert: '/certs/labor-roster/개미인력/최준규_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/최준규_수료증.jpg', specialHealthDate: '2026-04-04', specialHealthCert: '/certs/labor-roster/개미인력/최준규_특검확인서.pdf' },
  { name: '하장훈', category: '개미인력', birth: '1973-06-01', chemDate: '2026-03-23', chemCert: '/certs/labor-roster/개미인력/하장훈_이수증.jpg', chemCertCompletion: '/certs/labor-roster/개미인력/하장훈_수료증.jpg', specialHealthDate: '2026-04-14', specialHealthCert: '/certs/labor-roster/개미인력/하장훈_특검확인서.pdf' },
  { name: '김경식', category: '공영인력', birth: '1964-01-10', chemDate: '2024-03-21', chemCert: '/certs/labor-roster/공영인력/김경식_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/김경식_수료증.pdf', specialHealthDate: '2026-01-17', specialHealthCert: '/certs/labor-roster/공영인력/김경식_특검확인서.pdf' },
  { name: '김광춘', category: '공영인력', birth: '1981-03-24', chemDate: '2026-01-24', chemCert: '/certs/labor-roster/공영인력/김광춘_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/김광춘_수료증.pdf', specialHealthDate: '2026-04-10', specialHealthCert: '/certs/labor-roster/공영인력/김광춘_특검확인서.pdf' },
  { name: '김학판', category: '공영인력', birth: '1959-11-15', chemDate: '2026-01-10', chemCert: '/certs/labor-roster/공영인력/김학판_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/김학판_수료증.pdf', specialHealthDate: '2026-04-10', specialHealthCert: '/certs/labor-roster/공영인력/김학판_특검확인서.pdf' },
  { name: '오재정', category: '공영인력', birth: '1978-05-12', chemDate: '2024-01-18', chemCert: '/certs/labor-roster/공영인력/오재정_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/오재정_수료증.pdf', specialHealthDate: '2026-04-11', specialHealthCert: '/certs/labor-roster/공영인력/오재정_특검확인서.pdf' },
  { name: '이진호', category: '공영인력', birth: '1975-11-21', chemDate: '2024-08-05', chemCert: '/certs/labor-roster/공영인력/이진호_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/이진호_수료증.pdf', specialHealthDate: '2026-01-16', specialHealthCert: '/certs/labor-roster/공영인력/이진호_특검확인서.pdf' },
  { name: '임복수', category: '공영인력', birth: '1974-06-15', chemDate: '2025-02-14', chemCert: '/certs/labor-roster/공영인력/임복수_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/임복수_수료증.pdf', specialHealthDate: '2026-04-11', specialHealthCert: '/certs/labor-roster/공영인력/임복수_특검확인서.pdf' },
  { name: '조운용', category: '공영인력', birth: '1964-01-02', chemDate: '2024-03-21', chemCert: '/certs/labor-roster/공영인력/조운용_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/조운용_수료증.pdf', specialHealthDate: '2026-01-16', specialHealthCert: '/certs/labor-roster/공영인력/조운용_특검확인서.pdf' },
  { name: '배영일', category: '공영인력', birth: '1963-11-27', chemDate: '2024-02-13', chemCert: '/certs/labor-roster/공영인력/배영일_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/배영일_수료증.pdf', specialHealthDate: '2026-01-16', specialHealthCert: '/certs/labor-roster/공영인력/배영일_특검확인서.pdf' },
  { name: '이승훈', category: '공영인력', birth: '1976-01-05', chemDate: '2025-01-18', chemCert: '/certs/labor-roster/공영인력/이승훈_이수증.pdf', chemCertCompletion: '/certs/labor-roster/공영인력/이승훈_수료증.pdf', specialHealthDate: '2026-07-28', specialHealthCert: '/certs/labor-roster/공영인력/이승훈_특검확인서.pdf' },
  { name: '김우영', category: '당근인력', birth: '1972-01-19', phone: '010-8244-4302', chemDate: '2026-01-28', chemCert: '/certs/labor-roster/당근인력/김우영_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/김우영_수료증.pdf' },
  { name: '김효종', category: '당근인력', birth: '1975-10-30', phone: '010-8531-5641', chemDate: '2026-02-19', chemCert: '/certs/labor-roster/당근인력/김효종_이수증.pdf', chemCertCompletion: '/certs/labor-roster/당근인력/김효종_수료증.pdf' },
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
  // 여수·여천인력 — 배치전건강진단(특수검진) 확인서만 받은 상태. 유해화학물질 서류는 아직 없다.
  { name: '권경길', category: '여수인력', birth: '1959-03-02', specialHealthDate: '2026-04-24', specialHealthCert: '/certs/labor-roster/여수인력/권경길_특검확인서.pdf' },
  { name: '김명동', category: '여수인력', birth: '1972-02-29', specialHealthDate: '2026-04-25', specialHealthCert: '/certs/labor-roster/여수인력/김명동_특검확인서.pdf' },
  { name: '김병식', category: '여수인력', birth: '1961-08-11', specialHealthDate: '2026-04-25', specialHealthCert: '/certs/labor-roster/여수인력/김병식_특검확인서.pdf' },
  { name: '이진홍', category: '여수인력', birth: '1964-05-26', specialHealthDate: '2026-04-25', specialHealthCert: '/certs/labor-roster/여수인력/이진홍_특검확인서.pdf' },
  { name: '임상하', category: '여수인력', birth: '1992-10-27', specialHealthDate: '2026-04-25', specialHealthCert: '/certs/labor-roster/여수인력/임상하_특검확인서.pdf' },
  { name: '한옥수', category: '여수인력', birth: '1959-01-26', specialHealthDate: '2026-04-29', specialHealthCert: '/certs/labor-roster/여수인력/한옥수_특검확인서.pdf' },
  { name: '김도만', category: '여천인력', birth: '1960-08-16', specialHealthDate: '2026-04-29', specialHealthCert: '/certs/labor-roster/여천인력/김도만_특검확인서.pdf' },
  { name: '김야곤', category: '여천인력', birth: '1955-03-14', specialHealthDate: '2026-04-29', specialHealthCert: '/certs/labor-roster/여천인력/김야곤_특검확인서.pdf' },
  { name: '박래현', category: '여천인력', birth: '1985-03-12', specialHealthDate: '2026-04-29', specialHealthCert: '/certs/labor-roster/여천인력/박래현_특검확인서.pdf' },
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
/**
 * 지금 반영해야 할 초기 자료 묶음 이름.
 * 이 표식이 붙은 기록이 하나라도 있으면 아래 대장은 이미 깔린 것이므로 건너뛴다 —
 * 지운 인원이 새로고침마다 되살아나지 않게 하려는 것이다.
 * 대장에 사람을 새로 넣을 때는 이 이름을 바꿔 준다.
 */
const ROSTER_SEED_TAG = '2026-09-04-공영';

const DEFAULT_ROSTER: { category: string; name: string; birth: string; phone: string }[] = [
  // 배영일·이진호는 이미 등록돼 있어 넣지 않는다 (이름이 겹치면 건너뛴다)
  { category: '공영인력', name: '김광모', birth: '1978-09-25', phone: '010-2767-4098' },

  /*
   * 공영인력 — 「인력 신상명세표.xlsx」 인력명단 시트에서 옮김 (2026-09-04).
   * 이미 등록돼 있던 7명(길현민·류정민·배영일·오재정·유정환·이승훈·이진호)은 뺐다.
   * 생년월일은 주민번호 앞 6자리와 성별코드로만 만들고, 뒷자리는 어디에도 남기지 않는다.
   */
  { category: '공영인력', name: '고병연', birth: '1990-08-26', phone: '010-7486-6008' },
  { category: '공영인력', name: '권용빈', birth: '1994-04-07', phone: '010-4976-0322' },
  { category: '공영인력', name: '김경식', birth: '1976-01-05', phone: '010-4588-8265' },
  { category: '공영인력', name: '김광춘', birth: '1981-03-24', phone: '010-5436-0550' },
  { category: '공영인력', name: '김기환', birth: '1966-03-18', phone: '010-8406-0880' },
  { category: '공영인력', name: '김명호', birth: '1964-06-13', phone: '010-6899-3005' },
  { category: '공영인력', name: '김민철', birth: '1980-01-15', phone: '010-4967-5545' },
  { category: '공영인력', name: '김성룡', birth: '1966-01-24', phone: '010-3628-6221' },
  { category: '공영인력', name: '김은영', birth: '1978-11-10', phone: '010-8181-0111' },
  { category: '공영인력', name: '김인수', birth: '1957-11-05', phone: '010-4635-2362' },
  { category: '공영인력', name: '김정식', birth: '1967-03-28', phone: '010-9342-9207' },
  { category: '공영인력', name: '김철영', birth: '1962-02-01', phone: '010-9460-0969' },
  { category: '공영인력', name: '김치웅', birth: '1993-11-10', phone: '010-8173-2362' },
  { category: '공영인력', name: '김학찬', birth: '1966-01-25', phone: '010-2977-9543' },
  { category: '공영인력', name: '박금례', birth: '1961-03-27', phone: '010-5667-9423' },
  { category: '공영인력', name: '박미숙', birth: '1966-05-11', phone: '010-6220-9556' },
  { category: '공영인력', name: '박선자', birth: '1960-09-07', phone: '010-9036-0511' },
  { category: '공영인력', name: '박용덕', birth: '1970-04-01', phone: '010-2490-6160' },
  { category: '공영인력', name: '박홍철', birth: '1977-01-28', phone: '010-4232-1345' },
  { category: '공영인력', name: '배서준', birth: '1990-01-29', phone: '010-9760-6455' },
  { category: '공영인력', name: '신윤성', birth: '1997-09-19', phone: '010-8925-0047' },
  { category: '공영인력', name: '양재덕', birth: '1961-02-24', phone: '010-3623-0679' },
  { category: '공영인력', name: '엄성현', birth: '1965-08-19', phone: '010-2733-4407' },
  { category: '공영인력', name: '이정식', birth: '1959-08-22', phone: '010-9400-1513' },
  { category: '공영인력', name: '이현준', birth: '2002-12-23', phone: '010-4109-1223' },
  { category: '공영인력', name: '조운용', birth: '1964-01-02', phone: '010-5660-2749' },
  { category: '공영인력', name: '조진영', birth: '1971-02-28', phone: '010-4929-7772' },
  { category: '공영인력', name: '탁성호', birth: '1981-02-21', phone: '010-5558-1110' },
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

/**
 * 잘못 붙였던 첨부를 다시 거둬들이는 목록.
 * 이미 저장된 기록에도 남아 있으므로, 화면을 열 때 한 번 훑어 지운다.
 */
const RETRACTED: { name: string; cert: string }[] = [
  // 김효종 서류(건강진단 개인표)에는 검진일자가 적혀 있지 않아 보류하기로 했다
  { name: '김효종', cert: '/certs/labor-roster/당근인력/김효종_특검확인서.jpg' },
];

/**
 * 같은 사람인데 서류마다 이름이 다르게 적혀 있는 경우 — 왼쪽 이름을 오른쪽 이름으로 본다.
 * 이렇게 묶어 두지 않으면 다른 메뉴에서 이름을 불러올 때 한 사람이 두 줄로 생긴다.
 */
const NAME_ALIAS: Record<string, string> = {
  // 여수인력 — 특검확인서·건설기초는 "김명동", 유해화학물질 서류만 "진명동"으로 되어 있다
  진명동: '김명동',
};

/** 이름 비교용 — 띄어쓰기는 무시하고, 같은 사람의 다른 표기는 한쪽으로 모은다 */
function normName(s: string): string {
  const key = (s ?? '').replace(/\s/g, '');
  return NAME_ALIAS[key] ?? key;
}

/** 사람을 알아보는 값들 — 이 칸들이 채워진 정도로 "내용이 많은 기록"을 가린다 */
const CONTENT_KEYS: (keyof LaborWorker)[] = [
  'category',
  'birth',
  'phone',
  'generalHealthDate',
  'generalHealthCert',
  'specialHealthDate',
  'specialHealthCert',
  'chemDate',
  'chemCert',
  'chemCertCompletion',
  'ynccStart',
  'ynccEnd',
  'note',
];

/** 채워진 칸 수 — 중복된 기록 중 어느 쪽을 남길지 정하는 기준 */
function filledCount(r: LaborWorker): number {
  return CONTENT_KEYS.reduce((n, k) => (r[k] ? n + 1 : n), 0);
}

/**
 * 유해인자별 갱신 표시 — 물질마다 마지막 검진일과 다음 검진일(D-day).
 * 벤젠만 다시 받는 경우가 있어 물질별로 날짜를 따로 고칠 수 있게 둔다.
 */
function HazardChips({
  list,
  today,
  onChange,
  idPrefix,
  personName,
}: {
  list: HazardWatch[] | undefined;
  today: Date | null;
  onChange: (next: HazardWatch[]) => void;
  idPrefix: string;
  personName: string;
}) {
  const byName = new Map((list ?? []).map((h) => [h.name, h.checkedAt]));
  const statuses = new Map(hazardStatuses(list, today).map((s) => [s.name, s]));

  const setOne = (name: string, checkedAt: string) => {
    const rest = (list ?? []).filter((h) => h.name !== name);
    onChange(checkedAt ? [...rest, { name, checkedAt }] : rest);
  };

  return (
    <div className="space-y-1">
      {WATCHED_HAZARDS.map((name) => {
        const checkedAt = byName.get(name) ?? '';
        const s = statuses.get(name);
        return (
          <div key={name} className="flex items-center gap-1.5">
            <label
              className="w-11 shrink-0 text-[10px] font-bold text-slate-500"
              htmlFor={`${idPrefix}-${name}`}
              title={`${HAZARD_CYCLE_MONTHS[name]}개월 주기`}
            >
              {name}
            </label>
            <input
              id={`${idPrefix}-${name}`}
              type="date"
              aria-label={`${personName || '이 인원'} ${name} 검진일`}
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
    </div>
  );
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
  const { rows, getRows, mode, status, setRow, addRow, removeRow, undo, canUndo } = useSheetLog<LaborWorker>(
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
  /** 첨부서류에서 자동으로 채운 내용 안내 */
  const [autoNote, setAutoNote] = useState('');
  /** D-day 계산 기준 — 서버 렌더와 어긋나지 않도록 화면이 뜬 뒤 잡는다 */
  const [today, setToday] = useState<Date | null>(null);
  const seq = useRef(0);
  useEffect(() => setToday(new Date()), []);
  const seededRef = useRef(false);
  const sortCtl = useSortable<LaborWorker>();

  const shown = sortCtl.apply(
    rows.filter((r) => (tab === UNASSIGNED ? !r.category : r.category === tab)),
    { name: (r) => r.name, chem: (r) => r.chemDate ?? '' },
  );

  /**
   * 같은 이름이 이미 있는지 — 있으면 그 기록을 돌려준다 (자기 자신은 제외).
   * "한 사람 = 한 줄"을 지키기 위해 새로 만들기 전에 반드시 이걸로 확인한다.
   */
  const findByName = (name: string, exceptId?: string) => {
    const key = normName(name);
    if (!key) return undefined;
    return getRows().find((r) => r.id !== exceptId && normName(r.name) === key);
  };

  /**
   * 이름이 겹치는 기록 합치기.
   *
   * 남기는 쪽은 "채워진 칸이 가장 많은" 기록이고, 지우는 쪽에만 들어 있던 값은
   * 남기는 기록의 빈 칸으로 옮겨 담아 내용을 잃지 않는다.
   * 단, 생년월일이 서로 다르면 동명이인으로 보고 그대로 둔다.
   */
  const mergeDuplicates = async () => {
    const groups = new Map<string, LaborWorker[]>();
    for (const r of getRows()) {
      const key = normName(r.name);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }

    const merged: string[] = [];
    for (const list of Array.from(groups.values())) {
      if (list.length < 2) continue;
      // 생년월일이 둘 다 적혀 있는데 서로 다르면 다른 사람 — 합치지 않는다
      if (new Set(list.map((r) => r.birth).filter(Boolean)).size > 1) continue;

      const ordered = [...list].sort(
        (a, b) => filledCount(b) - filledCount(a) || a.id.localeCompare(b.id),
      );
      const [keep, ...drop] = ordered;
      let next = keep;
      for (const d of drop) {
        const patch = Object.fromEntries(CONTENT_KEYS.map((k) => [k, d[k]])) as Partial<LaborWorker>;
        next = fillBlank(next, patch).next;
      }
      if (JSON.stringify(next) !== JSON.stringify(keep)) setRow(keep.id, next);
      for (const d of drop) await removeRow(d.id);
      merged.push(keep.name);
    }

    if (merged.length > 0) {
      setMigrateNote(
        `이름이 겹쳐 두 번 이상 등록돼 있던 ${merged.length}명(${merged.join(', ')})을 한 건으로 합쳤습니다. ` +
          '내용이 적은 쪽을 지우고, 그쪽에만 있던 값은 남은 기록의 빈 칸으로 옮겼습니다. ' +
          '되돌리려면 [↩ 되돌리기]를 누르세요.',
      );
    }
  };

  /** 이름 입력을 마쳤을 때 — 이미 있는 사람이면 만들지 않고 기존 기록으로 보낸다 */
  const guardDuplicateName = (r: LaborWorker) => {
    const dup = findByName(r.name, r.id);
    if (!dup) return;
    alert(
      `"${dup.name}" 님은 이미 ${dup.category || UNASSIGNED}에 등록돼 있습니다.\n` +
        '같은 사람을 두 번 만들지 않도록 이 칸의 이름을 비웠습니다.\n기존 기록을 열어 수정해 주세요.',
    );
    setRow(r.id, { name: '' });
    setTab(dup.category || UNASSIGNED);
    setOpen(dup.id);
  };

  /*
   * 화면을 열 때 한 번 도는 정리 — 순서가 중요하다.
   *
   *  1) 거둬들일 첨부 지우기
   *  2) 원본 자료 반영 (이미 있는 사람은 새로 만들지 않고 빈 칸만 채운다)
   *  3) 이름이 겹치는 기록 합치기 (내용이 적은 쪽을 지운다)
   *
   * 중복이 생겼던 이유: 기록을 알아보는 값이 "이름"이 아니라 만들어질 때 찍힌
   * 시각 기반 ID였다. 기기가 다르거나 목록이 아직 안 들어온 순간에 만들면
   * 같은 사람이 다른 ID로 하나 더 생기고, 그 뒤로는 아무도 알아채지 못했다.
   * 그래서 (1) 새로 만드는 기록은 이름에서 뽑은 고정 ID를 쓰고,
   * (2) 이미 생긴 중복은 아래 3)에서 합치고, (3) 이름 입력칸에서 중복을 막는다.
   */
  useEffect(() => {
    if (seededRef.current || mode === 'loading' || role === 'viewer') return;
    seededRef.current = true;

    const timer = setTimeout(() => {
      // 1) 거둬들이기 — 보류한 첨부가 저장돼 있으면 지운다
      for (const t of RETRACTED) {
        const cur = findByName(t.name);
        if (cur?.specialHealthCert === t.cert) {
          setRow(cur.id, { specialHealthCert: '', specialHealthDate: '' });
        }
      }

      // 2) 원본 자료 반영 — 이미 깔린 묶음이면 건너뛴다 (지운 인원을 되살리지 않는다)
      if (getRows().some((r) => r.seedTag === ROSTER_SEED_TAG)) {
        void mergeDuplicates();
        return;
      }
      const added = new Set<string>();
      const seedRow = (d: (typeof DEFAULT_WORKERS)[number] | (typeof DEFAULT_ROSTER)[number]) => {
        if (added.has(normName(d.name))) return;
        const spDate = 'specialHealthDate' in d ? d.specialHealthDate : undefined;
        const patch: Partial<LaborWorker> = {
          birth: d.birth,
          phone: 'phone' in d ? d.phone : undefined,
          chemDate: 'chemDate' in d ? d.chemDate : undefined,
          chemCert: 'chemCert' in d ? d.chemCert : undefined,
          chemCertCompletion: 'chemCertCompletion' in d ? d.chemCertCompletion : undefined,
          specialHealthDate: spDate,
          specialHealthCert: 'specialHealthCert' in d ? d.specialHealthCert : undefined,
          // 이미 붙어 있는 특검확인서는 모두 벤젠·톨루엔·크실렌이 적힌 연간 검진이라
          // 그 검진일로 세 물질을 함께 잡는다 (벤젠만 재검하면 그때 벤젠 날짜만 바뀐다)
          hazards: spDate ? applyHazardCheck([], [...WATCHED_HAZARDS], spDate) : undefined,
          seedTag: ROSTER_SEED_TAG,
        };
        const existing = findByName(d.name);
        if (existing) {
          const { next, changed } = fillBlank(existing, {
            ...patch,
            category: existing.category || d.category,
          });
          if (changed) setRow(existing.id, next);
          return;
        }
        added.add(normName(d.name));
        // 이름에서 뽑은 고정 ID — 어느 기기에서 몇 번을 돌려도 같은 기록을 가리킨다
        addRow({ id: nameId('LW', d.name), category: d.category, name: d.name, ...patch, updatedAt: '' });
      };

      for (const d of DEFAULT_WORKERS) seedRow(d);
      // 엑셀 명단 — 이름이 겹치면 건너뛰고, 신규 인원만 이름·생년월일·연락처로 등록한다
      for (const d of DEFAULT_ROSTER) seedRow(d);

      // 3) 이미 쌓여 있던 중복 합치기
      void mergeDuplicates();
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
      const cur = getRows().find((x) => x.id === row.id) ?? row;
      const { patch, filled } = autoFillFromDoc(cur, f, field, {
        formatPhone,
        fallbackChemDate: `${yearFromFileName(file.name)}-01-01`,
        nameTaken: (n) => !!findByName(n, cur.id),
      });
      if (Object.keys(patch).length > 0) setRow(row.id, patch);
      setAutoNote(filled.length > 0 ? `📄 서류에서 읽어 자동으로 채웠습니다 — ${filled.join(' · ')}` : '');

      // 서류의 이름이 다르면 사람이 확인하도록 알린다 (값은 바꾸지 않는다)
      if (f?.personName && cur.name.trim() && normName(f.personName) !== normName(cur.name)) {
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
        const existing = findByName(name);
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

  /** 엑셀·인쇄에 넘길 표 — 지금 보고 있는 소속 탭 기준 */
  const exportSpec = (): ExportSpec<LaborWorker> => ({
    title: `인력관리 (${tab})`,
    landscape: true,
    columns: [
      { label: '소속', value: (r) => r.category || '미지정', width: 11 },
      { label: '성명', value: (r) => r.name, width: 10 },
      { label: '생년월일', value: (r) => r.birth ?? '', width: 12 },
      { label: '휴대폰', value: (r) => r.phone ?? '', width: 15 },
      { label: '일반검진', value: (r) => r.generalHealthDate ?? '', width: 12 },
      { label: '특수검진', value: (r) => r.specialHealthDate ?? '', width: 12 },
      { label: '유해화학물질', value: (r) => r.chemDate ?? '', width: 13 },
      { label: 'YNCC 시작', value: (r) => r.ynccStart ?? '', width: 12 },
      { label: 'YNCC 종료', value: (r) => r.ynccEnd ?? '', width: 12 },
      { label: '비고', value: (r) => r.note ?? '', align: 'left', width: 18 },
    ],
    rows: shown,
  });

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          👷 인력관리
          <span className="ml-1.5 font-normal text-slate-400">전체 {rows.length}명</span>
        </h3>
        {badge && <span className={`text-xs ${badge.className}`}>{badge.text}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SheetExport spec={exportSpec} />
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

      {autoNote && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <span className="flex-1">{autoNote}</span>
          <button onClick={() => setAutoNote('')} className="shrink-0 text-emerald-600 hover:text-emerald-900" aria-label="안내 닫기">
            ✕
          </button>
        </p>
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
                        <input id={`lw-name-${r.id}`} placeholder="이름" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} onBlur={() => guardDuplicateName(r)} className={CELL} />
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

                      {/* 특수검진 첨부파일 — 확인서 + 유해인자별 갱신 */}
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
                        <div className="mt-2 border-t border-slate-100 pt-2">
                          <p className="mb-1 text-[10px] font-semibold text-slate-500">
                            유해인자 갱신
                            <span className="ml-1 font-normal text-slate-400">벤젠 6개월 · 톨루엔/크실렌 1년</span>
                          </p>
                          <HazardChips
                            list={r.hazards}
                            today={today}
                            onChange={(next) => setRow(r.id, { hazards: next })}
                            idPrefix={`lw-haz-${r.id}`}
                            personName={r.name}
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
