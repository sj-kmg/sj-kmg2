'use client';

import { useEffect, useState } from 'react';
import { flushOutbox, onOutboxChange, outboxCount, startOutboxWatcher } from '@/lib/outbox';

/** beforeinstallprompt — 안드로이드 크롬 계열에서만 제공된다 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __sjInstall?: InstallEvent | null;
  }
}

type Browser = 'ios' | 'samsung' | 'android' | 'desktop';

/** 브라우저별 설치 방법 — 자동 설치가 안 되는 경우 직접 안내한다 */
const GUIDE: Record<Browser, { title: string; steps: string[] }> = {
  ios: {
    title: '아이폰 (Safari)',
    steps: ['화면 아래 공유 버튼 ⎙ 을 누릅니다', '목록을 내려 [홈 화면에 추가]를 누릅니다', '오른쪽 위 [추가]를 누르면 끝'],
  },
  samsung: {
    title: '갤럭시 (삼성 인터넷)',
    steps: [
      '화면 아래 메뉴 ☰ 를 누릅니다',
      '[현재 페이지 추가] 를 누릅니다',
      '[홈 화면] 을 고르고 [추가]를 누르면 끝',
    ],
  },
  android: {
    title: '안드로이드 (크롬)',
    steps: ['오른쪽 위 메뉴 ⋮ 를 누릅니다', '[앱 설치] 또는 [홈 화면에 추가]를 누릅니다', '[설치]를 누르면 끝'],
  },
  desktop: {
    title: 'PC (크롬·엣지)',
    steps: ['주소창 오른쪽 끝의 설치 아이콘 ⊕ 을 누릅니다', '[설치]를 누르면 끝'],
  },
};

function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * 앱 설치·오프라인 준비.
 *  - 서비스워커를 등록해 신호가 없어도 앱이 열리게 한다
 *  - 인터넷이 돌아오면 미전송 기록을 자동으로 보낸다
 *  - 설치 전이면 [앱 설치] 버튼을 항상 띄운다 (자동 설치가 안 되는 기기는 방법을 안내)
 */
export default function PwaSetup() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [browser, setBrowser] = useState<Browser>('desktop');
  const [standalone, setStandalone] = useState(true);
  const [pending, setPending] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setStandalone(installed);
    setBrowser(detectBrowser());
    setCanPrompt(!!window.__sjInstall);
    try {
      setHidden(installed || localStorage.getItem('sj-install-hint') === 'off');
    } catch {
      setHidden(installed);
    }

    // 화면이 뜨기 전에 잡아 둔 설치 안내가 뒤늦게 도착할 수도 있다
    const onReady = () => setCanPrompt(true);
    window.addEventListener('sj-install-ready', onReady);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // 등록 실패해도 앱 기능 자체에는 지장이 없다
      });
      navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
        if ((e.data as { type?: string })?.type === 'flush-outbox') void flushOutbox();
      });
    }

    setPending(outboxCount());
    const offCount = onOutboxChange(setPending);
    const stopWatch = startOutboxWatcher();

    const onInstalled = () => {
      setStandalone(true);
      setHidden(true);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      offCount();
      stopWatch();
      window.removeEventListener('sj-install-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem('sj-install-hint', 'off');
    } catch {
      // ignore
    }
  };

  /** 자동 설치가 가능하면 바로 띄우고, 아니면 방법을 안내한다 */
  const install = async () => {
    const evt = window.__sjInstall;
    if (!evt) {
      setGuideOpen(true);
      return;
    }
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      window.__sjInstall = null;
      setCanPrompt(false);
      if (outcome === 'accepted') setHidden(true);
      else setGuideOpen(true); // 취소했으면 수동 방법이라도 알려 준다
    } catch {
      setGuideOpen(true);
    }
  };

  const showInstall = !hidden && !standalone;
  const guide = GUIDE[browser];

  if (pending === 0 && !showInstall && !guideOpen) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3 sm:items-end">
        {/* 미전송 기록 알림 — 신호가 없을 때 작성한 내용 */}
        {pending > 0 && (
          <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg">
            <span aria-hidden className="text-base">📡</span>
            <p className="min-w-0 flex-1 text-xs font-semibold text-amber-800">
              아직 전송하지 못한 기록 {pending}건
              <span className="block font-normal text-amber-700">
                인터넷이 연결되면 자동으로 올라갑니다. 앱을 지우지 말아 주세요.
              </span>
            </p>
            <button
              onClick={() => void flushOutbox()}
              className="shrink-0 rounded-lg border border-amber-400 px-2.5 py-1 text-xs font-bold text-amber-800"
            >
              지금 전송
            </button>
          </div>
        )}

        {/* 앱 설치 — 기기·브라우저와 무관하게 항상 보인다 */}
        {showInstall && (
          <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-cyan-300 bg-white px-3 py-2 shadow-lg">
            <span aria-hidden className="text-base">📱</span>
            <p className="min-w-0 flex-1 text-xs text-slate-600">
              <b className="text-slate-800">휴대폰에 앱으로 설치</b>
              <span className="block">홈 화면 아이콘으로 바로 열 수 있습니다.</span>
            </p>
            <button
              onClick={() => void install()}
              className="shrink-0 rounded-lg bg-[#1f3864] px-3 py-1.5 text-xs font-bold text-white"
            >
              {canPrompt ? '설치' : '설치 방법'}
            </button>
            <button onClick={dismiss} aria-label="안내 닫기" className="shrink-0 px-1 text-slate-400">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 설치 방법 안내 */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-800">앱 설치 방법 — {guide.title}</h3>
            <ol className="mt-3 space-y-2">
              {guide.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1f3864] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              설치하면 주소를 매번 입력할 필요 없이 홈 화면 아이콘으로 바로 열립니다. 다른 브라우저를 쓰고 있다면
              메뉴에서 [홈 화면에 추가]를 찾으면 됩니다.
            </p>
            <button
              onClick={() => setGuideOpen(false)}
              className="mt-3 w-full rounded-lg bg-[#1f3864] py-2.5 text-sm font-bold text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
