/*
 * 안전관리 앱 서비스워커 — 앱이 **언제나 곧바로 열리게** 하는 것이 가장 큰 목적이다.
 *
 * 원칙
 *  - /api/* 는 절대 캐시하지 않는다 (기록은 항상 최신이어야 하고, 캐시에 남기면 안 된다)
 *  - 화면 이동: 네트워크를 잠깐만 기다리고, 늦으면 지난번 화면을 먼저 띄운다
 *  - 정적 파일(_next/static, 아이콘): 캐시 우선 (해시가 붙어 있어 갱신 걱정 없음)
 *
 * ── 왜 이렇게 만들었나
 * PC를 켜자마자 앱을 열면 랜이 아직 안 붙어 있는 때가 있다. 이때 서버는 "안 된다"고
 * 답해 주지 않고 **아무 말도 없이 붙들고 있는다**(이름풀이가 늘어지는 상황). 그래서
 * `fetch`를 그냥 기다리면 30초든 1분이든 매달려 있게 되고, 그동안 화면에는 아무것도
 * 못 띄운다. 결국 브라우저가 먼저 포기하고 "This page couldn't load"를 낸다.
 *
 * 그러니 **네트워크를 무한정 기다리지 않는다.** 잠깐(NET_WAIT) 기다려 보고 답이 없으면
 * 지난번에 받아 둔 화면을 먼저 보여 준다. 받아 오던 것은 뒤에서 계속 돌려 다음 번을
 * 위해 캐시만 갱신한다. 기록은 어차피 화면이 뜬 뒤 /api로 따로 받아오므로,
 * 연결이 늦게 붙어도 자료는 제때 채워진다.
 */
const VERSION = 'sj-v2';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

/**
 * 서버를 기다려 주는 시간.
 * 평소 응답은 0.2초, 서버가 잠들었다 깨는 경우도 3초 안쪽이라 넉넉하다.
 * 이보다 늦으면 "지금 연결이 안 되는 상황"으로 보고 지난 화면을 띄운다.
 */
const NET_WAIT = 4000;
/** 보여 줄 캐시본이 아예 없을 때만 조금 더 기다린다 (그래도 여기서 반드시 끝낸다) */
const NET_WAIT_COLD = 12000;

/** 앱 껍데기로 미리 받아 두는 것들 */
const PRECACHE = ['/', '/icon-192.png', '/apple-touch-icon.png'];

/** 정해진 시간이 지나면 undefined로 끝나는 약속 — 네트워크와 경주시킨다 */
const after = (ms) => new Promise((resolve) => setTimeout(resolve, ms, undefined));

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
      try {
        const cache = await caches.open(SHELL);
        // 설치가 네트워크 때문에 늘어지지 않게 여기서도 시간을 끊는다
        await Promise.race([fillCache(cache, PRECACHE), after(15000)]);
      } catch {
        // 못 담아도 첫 화면 이동에서 다시 담긴다
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      } catch {
        // 지우지 못해도 동작에는 지장 없다
      }
      await self.clients.claim();
      // 새로 배포되면 화면 파일 이름(해시)이 바뀐다. 껍데기를 새로 받아 두어야
      // 다음에 연결이 늦을 때 없는 파일을 찾지 않는다.
      try {
        const cache = await caches.open(SHELL);
        await Promise.race([fillCache(cache, ['/']), after(15000)]);
      } catch {
        // 화면 이동 때 다시 담긴다
      }
    })(),
  );
});

/** 연결이 아직 안 붙었을 때 보여 줄 안내 — 파일을 따로 받지 않도록 글자만으로 만든다 */
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
  <p class="wait">잠시 후 자동으로 다시 시도합니다…</p>
</div>
<script>
  addEventListener('online', () => location.reload());
  setInterval(() => { if (navigator.onLine) location.reload(); }, 3000);
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** 지난번에 받아 둔 화면 */
async function shell() {
  try {
    return (await caches.match('/', { ignoreSearch: true })) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 서버에서 받아 오고, 잘 받았으면 껍데기를 갱신한다.
 * **절대 예외를 내지 않는다** — 실패는 undefined로 알린다. 화면 이동을 맡은 약속이
 * 거부되면 그 순간 브라우저가 자기 오류 화면을 내기 때문이다.
 */
async function fetchAndCache(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const copy = res.clone();
      try {
        const cache = await caches.open(SHELL);
        await cache.put('/', copy);
      } catch {
        // 캐시에 못 담아도 이번 화면을 보여 주는 데는 지장 없다
      }
    }
    return res || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 화면 이동 — 네트워크를 **잠깐만** 기다린다.
 *
 * 답이 제때 오면 그걸 쓰고, 늦으면 지난 화면을 먼저 띄운다.
 * 어느 쪽이든 몇 초 안에 반드시 무언가를 돌려주므로, 브라우저가 먼저 포기하는 일이 없다.
 */
async function handleNavigate(fresh) {
  const cached = await shell();

  if (cached) {
    const res = await Promise.race([fresh, after(NET_WAIT)]);
    // 서버가 오류를 냈을 때도 지난 화면을 쓴다 — 앱은 열려 있어야 한다
    return res && res.ok ? res : cached;
  }

  // 처음 여는 경우 — 보여 줄 게 없으니 조금 더 기다리되, 여기서 반드시 끝낸다
  const res = await Promise.race([fresh, after(NET_WAIT_COLD)]);
  return res || offlinePage();
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
    const res = await Promise.race([fetch(req), after(20000)]);
    if (!res) return new Response('', { status: 504, statusText: 'timeout' });
    if (res.ok) {
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
    const fresh = fetchAndCache(req);
    // 화면을 먼저 띄운 뒤에도 받아 오던 것을 끝까지 돌려 캐시를 갱신한다
    event.waitUntil(fresh);
    event.respondWith(handleNavigate(fresh));
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
