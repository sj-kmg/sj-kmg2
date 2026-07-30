/**
 * Firebase Admin SDK 초기화 (서버 전용).
 *
 * Firebase App Hosting에서는 런타임이 FIREBASE_CONFIG·GCLOUD_PROJECT 환경변수와
 * 애플리케이션 기본 자격증명(ADC)을 자동으로 주입하므로 별도 키 파일이 필요 없다.
 * 로컬 개발에서는 `gcloud auth application-default login` 또는
 * GOOGLE_APPLICATION_CREDENTIALS(서비스 계정 JSON 경로)를 설정해야 하며,
 * 설정돼 있지 않으면 API가 503을 돌려주고 클라이언트는 로컬 저장으로 폴백한다.
 */
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/** 배포 대상 프로젝트 ID — App Hosting이 자동 주입, 로컬은 .env.local로 지정 */
export function projectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const cfg = process.env.FIREBASE_CONFIG;
    if (cfg) return (JSON.parse(cfg) as { projectId?: string }).projectId ?? '';
  } catch {
    // FIREBASE_CONFIG 형식 오류는 미설정으로 취급
  }
  return '';
}

/** 기본 스토리지 버킷 이름 (신규 프로젝트는 {id}.firebasestorage.app) */
export function bucketName(): string {
  return process.env.FIREBASE_STORAGE_BUCKET || (projectId() ? `${projectId()}.firebasestorage.app` : '');
}

/** Firebase 자격증명·프로젝트가 준비됐는가 — 아니면 API는 503으로 응답한다 */
export function firebaseReady(): boolean {
  return !!projectId();
}

let cached: App | null = null;

function app(): App {
  if (cached) return cached;
  cached = getApps()[0] ?? initializeApp({ projectId: projectId(), storageBucket: bucketName() });
  return cached;
}

let dbCached: Firestore | null = null;

export function db(): Firestore {
  if (dbCached) return dbCached;
  dbCached = getFirestore(app());
  // 클라이언트가 보내지 않은 선택 필드(undefined)를 오류 대신 무시하고 저장
  dbCached.settings({ ignoreUndefinedProperties: true });
  return dbCached;
}

export function bucket() {
  return getStorage(app()).bucket(bucketName());
}
