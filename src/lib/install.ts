/**
 * 앱 설치 환경 판별.
 *
 * 카카오톡·네이버 같은 「인앱 브라우저」에서는 홈 화면 설치 자체가 불가능하다.
 * (설치 기능이 없고 브라우저 메뉴도 없다)
 * 그래서 인앱이면 먼저 크롬·사파리로 열도록 안내한다.
 */
export type Platform = 'ios' | 'android' | 'desktop';

/** 설치가 불가능한 인앱 브라우저 목록 — 카톡으로 링크를 받아 열었을 때가 대부분이다 */
const IN_APP: [RegExp, string][] = [
  [/KAKAOTALK/i, '카카오톡'],
  [/NAVER\(inapp|NAVER /i, '네이버'],
  [/DaumApps|DaumDevice/i, '다음'],
  [/Instagram/i, '인스타그램'],
  [/FBAN|FBAV|FB_IAB/i, '페이스북'],
  [/Line\//i, '라인'],
  [/BAND\//i, '밴드'],
  [/everytimeApp/i, '에브리타임'],
  [/KAKAOSTORY/i, '카카오스토리'],
  [/wv\)/i, '앱 내 브라우저'], // 안드로이드 웹뷰 일반
];

export interface InstallEnv {
  platform: Platform;
  /** 인앱 브라우저면 그 앱 이름, 아니면 null */
  inApp: string | null;
  /** 이미 홈 화면 앱으로 실행 중인가 */
  standalone: boolean;
}

export function detectEnv(): InstallEnv {
  const ua = navigator.userAgent;
  const platform: Platform = /iPad|iPhone|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';

  let inApp: string | null = null;
  for (const [re, name] of IN_APP) {
    if (re.test(ua)) {
      inApp = name;
      break;
    }
  }
  // 삼성 인터넷·크롬은 웹뷰 패턴에 걸려도 정상 브라우저다
  if (inApp && /SamsungBrowser|CriOS|FxiOS|EdgA/.test(ua)) inApp = null;

  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  return { platform, inApp, standalone };
}

/**
 * 안드로이드에서 지금 주소를 크롬으로 다시 여는 주소.
 * 인앱 브라우저에서 이 주소로 이동하면 크롬이 실행된다.
 */
export function chromeIntentUrl(): string {
  const { host, pathname, search } = window.location;
  const target = `${host}${pathname}${search}`;
  const fallback = encodeURIComponent(window.location.href);
  return `intent://${target}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/** 카카오톡 인앱 브라우저 전용 — 기본 브라우저로 열기 */
export function kakaoExternalUrl(): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
}
