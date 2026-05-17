#!/usr/bin/env node
// Raw-HTML smoke test for the static prerender output.
// Local:  npx serve dist --listen 4000 ; BASE=http://localhost:4000 node scripts/test-prerender.mjs
// Prod:   BASE=https://lotexpo.com node scripts/test-prerender.mjs
const BASE = process.env.BASE || 'http://localhost:4000';

const TARGETS = [
  { url: '/', kind: 'home' },
  { url: '/blog', kind: 'blog-index' },
  { url: '/blog/salons-sante-medical-juin-2026', kind: 'blog-article' },
  { url: '/events/global-industrie', kind: 'event-with-exhibitors' },
  { url: '/events/ideobain', kind: 'event-without-exhibitors' },
  { url: '/secteur/agroalimentaire-boissons', kind: 'sector' },
  { url: '/ville/paris', kind: 'city' },
];

const baseChecks = {
  'title spécifique (≠ shell)': (h) =>
    /<title>([^<]+)<\/title>/i.test(h) &&
    !/<title>Lotexpo \| Tous les salons professionnels en France<\/title>/i.test(h),
  'meta description présente': (h) => /<meta\s+name="description"\s+content="[^"]+"/i.test(h),
  'canonical présent': (h) => /<link\s+rel="canonical"\s+href="https:\/\/lotexpo\.com[^"]*"/i.test(h),
  'pas de "Chargement…" en title': (h) => !/<title>[^<]*Chargement/i.test(h),
  'H1 présent dans le HTML brut': (h) => /<h1[\s>]/i.test(h),
};

const perKind = {
  'event-with-exhibitors': {
    'JSON-LD Event': (h) => /"@type"\s*:\s*"Event"/.test(h),
    'lien interne /secteur/': (h) => /<a[^>]+href="\/secteur\/[^"]+"/i.test(h),
    'lien interne /ville/': (h) => /<a[^>]+href="\/ville\/[^"]+"/i.test(h),
    'bloc exposants': (h) => /Entreprises exposantes référencées/i.test(h),
    'au moins 1 nom <li>': (h) =>
      (h.match(/Entreprises exposantes référencées[\s\S]*?<ul>([\s\S]*?)<\/ul>/i)?.[1] || '').match(/<li>[^<]{2,}<\/li>/g)?.length >= 1,
  },
  'event-without-exhibitors': {
    'JSON-LD Event': (h) => /"@type"\s*:\s*"Event"/.test(h),
    'pas de bloc exposants vide': (h) => !/Entreprises exposantes référencées[\s\S]*?<ul>\s*<\/ul>/i.test(h),
  },
  sector: {
    'JSON-LD CollectionPage': (h) => /"@type"\s*:\s*"CollectionPage"/.test(h),
    '≥ 5 liens /events/ si dispo': (h) =>
      (h.match(/<a[^>]+href="\/events\/[^"]+"/gi)?.length || 0) >= 5 ||
      /Lotexpo référence 0 salon|référence [1-4] salon/i.test(h),
  },
  city: {
    'JSON-LD CollectionPage': (h) => /"@type"\s*:\s*"CollectionPage"/.test(h),
    '≥ 5 liens /events/ si dispo': (h) =>
      (h.match(/<a[^>]+href="\/events\/[^"]+"/gi)?.length || 0) >= 5 ||
      /recense 0 salon|recense [1-4] salon/i.test(h),
  },
  'blog-article': { 'JSON-LD Article': (h) => /"@type"\s*:\s*"Article"/.test(h) },
  'blog-index': { 'au moins 1 lien /blog/': (h) => (h.match(/<a[^>]+href="\/blog\/[^"]+"/gi)?.length || 0) >= 1 },
  home: { 'paragraphe éditorial': (h) => /centralise les salons professionnels/i.test(h) },
};

let pass = 0, fail = 0;
const rows = await Promise.all(TARGETS.map(async (t) => {
  try {
    const res = await fetch(BASE + t.url, { redirect: 'follow', headers: { 'user-agent': 'lotexpo-prerender-test' } });
    const html = await res.text();
    const results = [];
    for (const [n, fn] of Object.entries(baseChecks)) results.push([n, !!fn(html)]);
    for (const [n, fn] of Object.entries(perKind[t.kind] || {})) results.push([n, !!fn(html)]);
    return { ...t, status: res.status, len: html.length, results };
  } catch (e) { return { ...t, error: e.message }; }
}));

for (const r of rows) {
  console.log(`\n=== ${r.url}  [${r.kind}]  status=${r.status}  size=${r.len}`);
  if (r.error) { console.log('  ERROR', r.error); fail++; continue; }
  for (const [n, ok] of r.results) { console.log('  ' + (ok ? '✓' : '✗') + ' ' + n); ok ? pass++ : fail++; }
}
console.log(`\n──── total: ${pass} OK, ${fail} KO ────`);
process.exit(fail > 0 ? 1 : 0);
