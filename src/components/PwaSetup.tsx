'use client';

import { useEffect, useState } from 'react';
import { chromeIntentUrl, detectEnv, kakaoExternalUrl, type Platform } from '@/lib/install';
import { flushOutbox, onOutboxChange, outboxCount, startOutboxWatcher } from '@/lib/outbox';

/** beforeinstallprompt — 크롬·삼성인터넷 계열에서 제공된다 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __sjInstall?: InstallEvent | null;
  }
}

/** 자동 설치가 안 되는 브라우저용 최후 안내 */
const GUIDE: Record<Platform, string[]> = {
  ios: ['화면 아래 공유 버튼 ⎙ 을 누릅니다', '목록을 내려 [홈 화면에 추가]를 누릅니다', '오른쪽 위 [추가]를 누르면 끝'],
  android: ['오른쪽 위 메뉴 ⋮ 를 누릅니다', '[앱 설치] 또는 [홈 화면에 추가]를 누릅니다', '[설치]를 누르면 끝'],
  desktop: ['주소창 오른쪽 끝의 설치 아이콘 ⊕ 을 누릅니다', '[설치]를 누르면 끝'],
};

/**
 * 앱 설치·오프라인 준비.
 *
 * 설치 버튼은 상황에 따라 하는 일이 달라진다.
 *  - 크롬·삼성인터넷 : 누르면 바로 설치창 (한 번에 설치)
 *  - 카카오톡 등 인앱 : 설치가 불가능하므로 크롬으로 다시 열어 준다
 *  - 아이폰 사파리    : 공유 → 홈 화면에 추가 안내 (애플 정책상 자동 설치 불가)
 */
export default function PwaSetup() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [inApp, setInApp] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [pending, setPending] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const env = detectEnv();
    setPlatform(env.platform);
    setInApp(env.inApp);
    setStandalone(env.standalone);
    setCanPrompt(!!window.__sjInstall);
    try {
      setHidden(env.standalone || localStorage.getItem('sj-install-hint') === 'off');
    } catch {
      setHidden(env.standalone);
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

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  /** 인앱 브라우저 → 크롬(또는 기본 브라우저)으로 다시 열기 */
  const openInBrowser = () => {
    if (platform === 'android') {
      // 카카오톡은 전용 방식이 더 확실하다
      if (inApp === '카카오톡') {
        window.location.href = kakaoExternalUrl();
        setTimeout(() => {
          window.location.href = chromeIntentUrl();
        }, 700);
        return;
      }
      window.location.href = chromeIntentUrl();
      return;
    }
    // 아이폰 인앱은 강제로 옮길 수 없다 — 주소를 복사해 사파리에서 열도록
    void copyUrl();
    setGuideOpen(true);
  };

  /** 설치 버튼 — 상황에 맞는 동작 하나만 한다 */
  const onInstallClick = () => {
    if (inApp) {
      openInBrowser();
      return;
    }
    const evt = window.__sjInstall;
    if (evt) {
      void (async () => {
        try {
          await evt.prompt();
          const { outcome } = await evt.userChoice;
          window.__sjInstall = null;
          setCanPrompt(false);
          if (outcome === 'accepted') setHidden(true);
        } catch {
          setGuideOpen(true);
        }
      })();
      return;
    }
    setGuideOpen(true);
  };

  const showInstall = !hidden && !standalone;
  if (pending === 0 && !showInstall && !guideOpen) return null;

  /** 버튼 문구 — 지금 누르면 무슨 일이 일어나는지 그대로 쓴다 */
  const label = inApp
    ? platform === 'android'
      ? '크롬으로 열기'
      : 'Safari로 열기'
    : canPrompt
      ? '설치'
      : '설치 방법';

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

        {showInstall && (
          <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-cyan-300 bg-white px-3 py-2 shadow-lg">
            <span aria-hidden className="text-base">📱</span>
            <p className="min-w-0 flex-1 text-xs text-slate-600">
              <b className="text-slate-800">
                {inApp ? `${inApp}에서는 설치할 수 없습니다` : '휴대폰에 앱으로 설치'}
              </b>
              <span className="block">
                {inApp
                  ? platform === 'android'
                    ? '크롬으로 열면 바로 설치할 수 있습니다.'
                    : 'Safari로 열면 설치할 수 있습니다.'
                  : '홈 화면 아이콘으로 바로 열 수 있습니다.'}
              </span>
            </p>
            <button
              onClick={onInstallClick}
              className="shrink-0 rounded-lg bg-[#1f3864] px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white"
            >
              {label}
            </button>
            <button onClick={dismiss} aria-label="안내 닫기" className="shrink-0 px-1 text-slate-400">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 최후 안내 — 자동 설치가 막힌 경우 */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={() => setGuideOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800">
              {inApp ? `${inApp}에서는 설치가 안 됩니다` : '앱 설치 방법'}
            </h3>

            {inApp ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  주소를 복사해 뒀습니다. <b>{platform === 'ios' ? 'Safari' : '크롬'}</b>을 열고 주소창에 붙여넣은 뒤,
                  아래 방법으로 설치해 주세요.
                </p>
                <ol className="mt-3 space-y-2">
                  {GUIDE[platform].map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1f3864] text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{s}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <ol className="mt-3 space-y-2">
                {GUIDE[platform].map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1f3864] text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{s}</span>
                  </li>
                ))}
              </ol>
            )}

            <button
              onClick={() => void copyUrl()}
              className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-xs font-bold text-slate-600"
            >
              {copied ? '주소가 복사되었습니다 ✓' : '주소 복사'}
            </button>
            <button
              onClick={() => setGuideOpen(false)}
              className="mt-2 w-full rounded-lg bg-[#1f3864] py-2.5 text-sm font-bold text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
