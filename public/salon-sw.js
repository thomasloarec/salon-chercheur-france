// Service worker du mode salon : ne contrôle que /salon/. Écrit à la main, sans dépendance.
const VERSION = 'salon-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSETS_CACHE = `${VERSION}-assets`;
const SHELL_KEY = '/salon/__shell';
const MAX_ASSETS = 150;
const NAV_TIMEOUT_MS = 3000;

const isHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');

async function trimAssets() {
  const cache = await caches.open(ASSETS_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - MAX_ASSETS;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

async function precache() {
  try {
    const res = await fetch('/salon/demarrer', { cache: 'no-store' });
    if (!res.ok || !isHtml(res)) return;
    const html = await res.clone().text();
    const shell = await caches.open(SHELL_CACHE);
    await shell.put(SHELL_KEY, res);
    const urls = new Set(['/favicon.png']);
    const re = /(?:src|href)=["'](\/assets\/[^"']+)["']/g;
    let m;
    while ((m = re.exec(html))) urls.add(m[1]);
    const assets = await caches.open(ASSETS_CACHE);
    await Promise.allSettled(
      Array.from(urls).map(async (u) => {
        const r = await fetch(u);
        if (r.ok) await assets.put(u, r);
      }),
    );
    await trimAssets();
  } catch (e) {
    /* l'installation ne doit pas échouer */
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function storeShell(res) {
  if (res && res.ok && !res.redirected && isHtml(res)) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(SHELL_KEY, res.clone());
  }
}

function handleNavigation(event) {
  const network = fetch(event.request);
  event.waitUntil(network.then(storeShell).catch(() => undefined));

  return (async () => {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), NAV_TIMEOUT_MS);
    });
    let res = null;
    try {
      res = await Promise.race([network, timeout]);
    } catch (e) {
      res = null;
    }
    clearTimeout(timer);
    if (res && res.ok && !res.redirected && isHtml(res)) return res;

    const cached = await caches.match(SHELL_KEY, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    if (res) return res;
    try {
      return await network;
    } catch (e) {
      return new Response('Mode salon indisponible hors ligne : ouvrez-le une fois avec du réseau.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })();
}

async function handleAsset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    await trimAssets();
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.pathname.startsWith('/salon/')) {
    event.respondWith(handleNavigation(event));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleAsset(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data !== 'SALON_SW_DISABLE') return;
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
    })(),
  );
});
