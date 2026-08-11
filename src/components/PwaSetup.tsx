'use client';

import { useEffect, useState } from 'react';
import { flushOutbox, onOutboxChange, outboxCount, startOutboxWatcher } from '@/lib/outbox';

/** beforeinstallprompt — 안드로이드·크롬에서만 제공된다 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * 앱 설치·오프라인 준비.
 *  - 서비스워커를 등록해 신호가 없어도 앱이 열리게 한다
 *  - 인터넷이 돌아오면 미전송 기록을 자동으로 보낸다
 *  - 아직 설치 전이면 [홈 화면에 추가] 안내를 띄운다
 */
export default function PwaSetup() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [pending, setPending] = useState(0);
  const [hideHint, setHideHint] = useState(true);

  useEffect(() => {
    // 설치 여부·기기 판별
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsIOS(ios);
    setStandalone(installed);
    try {
      setHideHint(installed || localStorage.getItem('sj-install-hint') === 'off');
    } catch {
      setHideHint(installed);
    }

    // 서비스워커 등록 (HTTPS 또는 localhost에서만 동작)
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

    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    const onInstalled = () => setStandalone(true);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      offCount();
      stopWatch();
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHideHint(true);
    try {
      localStorage.setItem('sj-install-hint', 'off');
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const showHint = !hideHint && !standalone && (isIOS || !!installEvent);

  if (pending === 0 && !showHint) return null;

  return (
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

      {/* 홈 화면에 추가 안내 */}
      {showHint && (
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-cyan-300 bg-white px-3 py-2 shadow-lg">
          <span aria-hidden className="text-base">📱</span>
          <p className="min-w-0 flex-1 text-xs text-slate-600">
            <b className="text-slate-800">휴대폰 앱으로 설치</b>
            {isIOS ? (
              <span className="block">
                아래 <b>공유 ⎙</b> → <b>홈 화면에 추가</b>를 누르면 앱처럼 쓸 수 있습니다.
              </span>
            ) : (
              <span className="block">홈 화면에 추가하면 앱처럼 바로 열 수 있습니다.</span>
            )}
          </p>
          {installEvent && (
            <button
              onClick={() => void install()}
              className="shrink-0 rounded-lg bg-[#1f3864] px-2.5 py-1 text-xs font-bold text-white"
            >
              설치
            </button>
          )}
          <button onClick={dismiss} aria-label="안내 닫기" className="shrink-0 px-1 text-slate-400">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
