/*
 * 안전관리 앱 서비스워커 — 오프라인에서도 앱이 열리도록 화면 파일을 캐시한다.
 *
 * 원칙
 *  - /api/* 는 절대 캐시하지 않는다 (기록은 항상 최신이어야 하고, 캐시에 남기면 안 된다)
 *  - 화면 이동: 네트워크 우선, 실패하면 캐시된 마지막 화면으로 연다
 *  - 정적 파일(_next/static, 아이콘): 캐시 우선 (해시가 붙어 있어 갱신 걱정 없음)
 *
 * 무엇보다, **브라우저의 "This page couldn't load" 화면은 절대 나오지 않게 한다.**
 * 앱을 켠 직후에는 아직 랜·와이파이가 안 붙어 있는 경우가 흔한데, 예전에는 그 한 번의
 * 실패를 그대로 오류로 돌려줘(`Response.error()`) 앱이 열리지 않았다. 이제는 한 번 더
 * 기다렸다 시도하고, 그래도 안 되면 캐시본을, 그것도 없으면 우리 안내 화면을 띄운다.
 */
const VERSION = 'sj-v2';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

/** 앱 껍데기로 미리 받아 두는 것들 */
const PRECACHE = ['/', '/icon-192.png', '/apple-touch-icon.png'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 한 건씩 따로 담는다 — `addAll`은 하나만 실패해도 전부 버려서, 아이콘 하나 때문에 껍데기가 통째로 비었다 */
async function fillCache(cache, urls) {
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res && res.ok) await cache.put(u, res);
      } catch {
        // 이 파일은 다음 기회에 — 나머지는 그대로 담긴다
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await fillCache(cache, PRECACHE);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
      // 새로 배포되면 화면 파일 이름(해시)이 바뀐다. 껍데기를 지금 한 번 새로 받아 두어야
      // 다음에 오프라인으로 열었을 때 없는 파일을 찾지 않는다.
      try {
        const cache = await caches.open(SHELL);
        await fillCache(cache, ['/']);
      } catch {
        // 실패해도 화면 이동 때 다시 담긴다
      }
    })(),
  );
});

/** 인터넷이 아직 안 붙었을 때 보여 줄 안내 — 파일을 따로 받지 않도록 글자만으로 만든다 */
function offlinePage() {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>신정개발 안전관리</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#d9e3f4;color:#1f3864;font-family:"맑은 고딕","Malgun Gothic",system-ui,sans-serif;padding:24px}
  .box{max-width:22rem;text-align:center}
  h1{font-size:1.05rem;margin:0 0 .5rem}
  p{font-size:.85rem;line-height:1.6;color:#41546f;margin:0 0 1.25rem}
  button{width:100%;padding:.85rem;border:0;border-radius:.75rem;background:#1f3864;color:#fff;
         font-size:.9rem;font-weight:700;cursor:pointer}
  .wait{margin-top:.75rem;font-size:.75rem;color:#7286a3}
</style></head><body>
<div class="box">
  <h1>인터넷 연결을 기다리는 중입니다</h1>
  <p>앱을 켠 직후에는 연결이 늦게 잡히기도 합니다.<br>연결되면 자동으로 열립니다.</p>
  <button onclick="location.reload()">지금 다시 열기</button>
  <p class="wait" id="w">잠시 후 자동으로 다시 시도합니다…</p>
</div>
<script>
  // 연결이 돌아오면 바로, 아니면 3초마다 스스로 다시 시도한다
  addEventListener('online', () => location.reload());
  setInterval(() => { if (navigator.onLine) location.reload(); }, 3000);
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/**
 * 화면 이동 — 네트워크 우선.
 *
 * 한 번 실패했다고 곧바로 포기하지 않는다. 앱을 켜자마자면 아직 연결이 안 잡혔을 뿐이라
 * 잠깐 쉬었다 다시 해 보면 대개 열린다. 그래도 안 되면 마지막으로 열렸던 화면을 쓰고,
 * 그것마저 없을 때만 안내 화면을 띄운다.
 */
async function handleNavigate(req) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(req);
      // 서버가 낸 오류 화면(500 등)은 그대로 보여 주되 캐시에는 남기지 않는다.
      // 예전에는 이걸 껍데기로 저장해, 한 번 실패하면 그 오류 화면이 계속 나왔다.
      if (res && res.ok) {
        const copy = res.clone();
        caches
          .open(SHELL)
          .then((c) => c.put('/', copy))
          .catch(() => {});
      }
      if (res) return res;
    } catch {
      // 아직 연결 전 — 한 번 더 기다려 본다
    }
    if (attempt === 0) await sleep(1500);
  }

  try {
    const cached = await caches.match('/', { ignoreSearch: true });
    if (cached) return cached;
  } catch {
    // 캐시를 못 읽는 기기도 있다 — 안내 화면으로 간다
  }
  return offlinePage();
}

/** 정적 파일 — 캐시 우선. 어떤 경우에도 예외를 밖으로 던지지 않는다 */
async function handleAsset(req) {
  try {
    const hit = await caches.match(req);
    if (hit) return hit;
  } catch {
    // 캐시를 못 읽으면 그냥 받아 온다
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const copy = res.clone();
      caches
        .open(ASSETS)
        .then((c) => c.put(req, copy))
        .catch(() => {});
    }
    return res;
  } catch {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 기록 API·업로드는 항상 네트워크로 (캐시 금지)
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(handleAsset(req));
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
