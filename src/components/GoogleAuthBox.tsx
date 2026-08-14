'use client';

import { useState } from 'react';
import { signInWithGoogle, signOutGoogle } from '@/lib/firebaseClient';
import type { Session } from '@/lib/useRole';

/**
 * 구글 로그인 상자 — 좌측 사이드바 하단에 놓는다.
 * 로그인하지 않아도 기존 암호 방식은 그대로 동작하므로 현장 업무는 끊기지 않는다.
 */
export default function GoogleAuthBox({ session }: { session: Session }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async () => {
    setBusy(true);
    setError('');
    const r = await signInWithGoogle();
    if (!r.ok && r.message) setError(r.message);
    setBusy(false);
    if (r.ok) session.refresh();
  };

  const signOut = async () => {
    setBusy(true);
    await signOutGoogle();
    setBusy(false);
    session.refresh();
  };

  if (session.user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#22d3ee] to-[#4b7bff] text-[11px] font-bold text-white"
          >
            {(session.user.name || session.user.email || '?').slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold text-slate-700">
              {session.user.name || session.user.email}
            </span>
            <span className="block truncate text-[9px] text-slate-400">
              {session.role === 'admin' ? '관리자' : session.role === 'viewer' ? '열람 전용' : '승인 대기'}
            </span>
          </span>
        </div>
        {session.pending && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] leading-relaxed text-amber-700">
            관리자 승인을 기다리는 중입니다. 승인되면 지정된 메뉴를 볼 수 있습니다.
          </p>
        )}
        <button
          onClick={signOut}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-800 disabled:opacity-40"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:border-slate-300 disabled:opacity-40"
      >
        <GoogleMark />
        {busy ? '로그인 중…' : '구글 계정으로 로그인'}
      </button>
      {error && <p className="mt-1.5 text-[10px] leading-relaxed text-red-600">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.4 14.4 0 0 1 9.77 24c0-1.6.28-3.15.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
