'use client';

/**
 * Firebase 클라이언트 SDK — 구글 로그인 전용.
 *
 * 여기 값들은 공개되어도 되는 설정이다(웹 API 키는 비밀이 아니다).
 * 실제 접근 통제는 서버가 ID 토큰을 검증해서 한다.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';

const CONFIG = {
  apiKey: 'AIzaSyBtAIJZJW3jF9yqjNXcrYV2W4EpPzFIlss',
  authDomain: 'sj-kmg-deploy2.firebaseapp.com',
  projectId: 'sj-kmg-deploy2',
  storageBucket: 'sj-kmg-deploy2.firebasestorage.app',
  messagingSenderId: '211086944748',
  appId: '1:211086944748:web:e06a3c25f4652352e1b8c9',
};

let appCached: FirebaseApp | null = null;

function app(): FirebaseApp {
  if (!appCached) appCached = getApps()[0] ?? initializeApp(CONFIG);
  return appCached;
}

export function auth(): Auth {
  return getAuth(app());
}

/** 구글 계정으로 로그인 — 실패 원인을 사람이 읽을 수 있는 문구로 돌려준다 */
export async function signInWithGoogle(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const a = auth();
    // 새로고침해도 로그인이 유지되도록
    await setPersistence(a, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(a, provider);
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { ok: false, message: '' }; // 사용자가 창을 닫은 것 — 조용히 넘어간다
    }
    if (code === 'auth/operation-not-allowed') {
      return {
        ok: false,
        message: 'Firebase 콘솔에서 구글 로그인이 아직 켜져 있지 않습니다. 관리자에게 문의해 주세요.',
      };
    }
    if (code === 'auth/unauthorized-domain') {
      return {
        ok: false,
        message: '이 주소는 로그인 허용 목록에 없습니다. 관리자에게 문의해 주세요.',
      };
    }
    if (code === 'auth/popup-blocked') {
      return { ok: false, message: '팝업이 차단됐습니다. 주소창의 팝업 차단을 풀고 다시 시도해 주세요.' };
    }
    return { ok: false, message: `로그인에 실패했습니다. (${code || '알 수 없는 오류'})` };
  }
}

export function signOutGoogle(): Promise<void> {
  return fbSignOut(auth());
}

export function watchUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth(), cb);
}

/** 현재 로그인 사용자의 ID 토큰 — API 호출 헤더에 싣는다 */
export async function idToken(force = false): Promise<string> {
  const u = auth().currentUser;
  if (!u) return '';
  try {
    return await u.getIdToken(force);
  } catch {
    return '';
  }
}
