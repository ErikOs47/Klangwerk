// Service Worker der Web-App. scripts/build.js setzt Version, App-Hülle und die Sound-Liste ein.
const VERSION = __VERSION__, SHELL = __SHELL__, SAMPLES = __SAMPLES__;
const SHELL_CACHE = 'sg-shell-' + VERSION, SMP_CACHE = 'sg-samples';
const scope = new URL(self.registration.scope);
const rel = url => { const u = new URL(url); return u.origin === scope.origin && u.pathname.startsWith(scope.pathname) ? decodeURIComponent(u.pathname.slice(scope.pathname.length)) : null; };
const smpKey = f => new URL(f + '?h=' + SAMPLES[f], scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL.map(f => new Request(new URL(f, scope), { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('sg-shell-') && k !== SHELL_CACHE) await caches.delete(k);
    // Sounds, die es nicht mehr gibt oder die sich geändert haben, aufräumen
    const c = await caches.open(SMP_CACHE), keep = new Set(Object.keys(SAMPLES).map(smpKey));
    for (const r of await c.keys()) if (!keep.has(r.url)) await c.delete(r);
    await self.clients.claim();
  })());
});

async function sample(f) {
  const c = await caches.open(SMP_CACHE), key = smpKey(f), hit = await c.match(key);
  if (hit) return hit;
  const res = await fetch(new URL(f, scope), { cache: 'no-cache' });
  if (res.ok) await c.put(key, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  let f = rel(r.url); if (f === null) return;
  if (r.mode === 'navigate' || f === '') f = 'index.html';
  if (f in SAMPLES) { e.respondWith(sample(f)); return; }
  if (SHELL.includes(f)) e.respondWith(caches.match(new URL(f, scope).href, { cacheName: SHELL_CACHE }).then(hit => hit || fetch(r)));
});

self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type === 'skip') self.skipWaiting();
  // Alle Sounds auf einmal speichern, damit die App ohne Netz vollständig läuft
  if (m.type === 'cache-all') e.waitUntil((async () => {
    const files = Object.keys(SAMPLES), c = await caches.open(SMP_CACHE);
    let done = 0, failed = 0;
    const tell = msg => e.source?.postMessage(msg);
    const work = async () => {
      while (files.length) {
        const f = files.shift();
        try { if (!(await c.match(smpKey(f)))) { const res = await sample(f); if (!res.ok) failed++; } } catch (err) { failed++; }
        tell({ type: 'cache-progress', done: ++done, total: Object.keys(SAMPLES).length });
      }
    };
    await Promise.all([work(), work(), work(), work()]);
    tell({ type: 'cache-done', failed });
  })());
  if (m.type === 'cache-status') e.waitUntil((async () => {
    const c = await caches.open(SMP_CACHE), have = new Set((await c.keys()).map(r => r.url));
    e.source?.postMessage({ type: 'cache-status', have: Object.keys(SAMPLES).filter(f => have.has(smpKey(f))).length, total: Object.keys(SAMPLES).length });
  })());
});
