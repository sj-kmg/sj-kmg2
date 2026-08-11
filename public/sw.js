/*
 * 안전관리 앱 서비스워커 — 오프라인에서도 앱이 열리도록 화면 파일을 캐시한다.
 *
 * 원칙
 *  - /api/* 는 절대 캐시하지 않는다 (기록은 항상 최신이어야 하고, 캐시에 남기면 안 된다)
 *  - 화면 이동: 네트워크 우선, 실패하면 캐시된 마지막 화면으로 연다
 *  - 정적 파일(_next/static, 아이콘): 캐시 우선 (해시가 붙어 있어 갱신 걱정 없음)
 */
const VERSION = 'sj-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(['/', '/icon-192.png', '/apple-touch-icon.png'])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 기록 API·업로드는 항상 네트워크로 (캐시 금지)
  if (url.pathname.startsWith('/api/')) return;

  // 화면 이동 — 네트워크 우선, 끊기면 캐시본
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/', { ignoreSearch: true }).then((r) => r || Response.error())),
    );
    return;
  }

  // 정적 파일 — 캐시 우선
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          }),
      ),
    );
  }
});

/** 앱에서 "지금 대기열 전송해" 신호를 받으면 열려 있는 창에 알린다 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sj-outbox') {
    event.waitUntil(
      self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage({ type: 'flush-outbox' }))),
    );
  }
});
