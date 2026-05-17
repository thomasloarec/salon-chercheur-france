#!/usr/bin/env node
// Quick raw-HTML smoke test for the SEO edge middleware.
// Usage: BASE=https://lotexpo.com node scripts/test-seo-edge.mjs
const BASE = process.env.BASE || 'https://lotexpo.com';
const URLS = [
  '/',
  '/blog',
  '/events/architect-work-bordeaux',
  '/events/enviropro-sud-ouest-2027',
  '/secteur/agroalimentaire',
  '/ville/paris',
];

const checks = [
  ['has <title> non générique', (h) => /<title>(?!Lotexpo \| Tous les salons)[^<]+<\/title>/i.test(h)],
  ['has canonical', (h) => /<link rel="canonical"/i.test(h)],
  ['has meta description', (h) => /<meta name="description"/i.test(h)],
  ['has #seo-prerender H1', (h) => /<div id="seo-prerender"[^>]*>[\s\S]*?<h1/i.test(h)],
  ['no Chargement title', (h) => !/<title>[^<]*Chargement/i.test(h)],
];

const r = await Promise.all(URLS.map(async (p) => {
  try {
    const res = await fetch(BASE + p, { redirect: 'follow' });
    const html = await res.text();
    const results = checks.map(([n, f]) => [n, f(html)]);
    return { p, status: res.status, len: html.length, results, edge: res.headers.get('x-seo-edge') };
  } catch (e) {
    return { p, error: e.message };
  }
}));

for (const row of r) {
  console.log('\n=== ' + row.p + ' === [' + row.status + '] ' + (row.len || 0) + 'b edge=' + (row.edge || 'no'));
  if (row.error) { console.log('  ERROR', row.error); continue; }
  for (const [n, ok] of row.results) console.log(' ', ok ? '✓' : '✗', n);
}
