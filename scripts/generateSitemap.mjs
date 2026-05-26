// Lotexpo sitemap generator — segmented + audit-logged.
// Generates:
//   public/sitemap.xml             (index pointing to the 4 sub-sitemaps)
//   public/sitemap-static.xml      (home + static pages)
//   public/sitemap-events.xml      (one entry per visible non-test event with slug)
//   public/sitemap-blog.xml        (published blog articles)
//   public/sitemap-hubs.xml        (canonical sector hubs + city hubs >=3 events)
// Each exclusion is logged with an explicit reason; the final report shows
// "X eligible / Y excluded" so any missing event can be explained.

import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SITE_URL = 'https://lotexpo.com';
const PUBLIC_DIR = path.resolve('public');
const ENV_PATH = path.resolve('.env');

// ----- env loader -----
async function loadEnvFile() {
  try {
    const content = await readFile(ENV_PATH, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}
await loadEnvFile();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('[sitemap:build] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----- helpers -----
const formatDate = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().split('T')[0];
};
const escapeXml = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const slugifyCity = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const now = new Date().toISOString().split('T')[0];

function urlBlock(loc, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}
function wrapUrlset(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
function wrapIndex(items) {
  const body = items
    .map((i) => `  <sitemap>\n    <loc>${escapeXml(i.loc)}</loc>\n    <lastmod>${i.lastmod}</lastmod>\n  </sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

// ----- 1. static -----
const staticPages = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/events', changefreq: 'daily', priority: '0.9' },
  { path: '/nouveautes', changefreq: 'daily', priority: '0.8' },
  { path: '/exposants', changefreq: 'weekly', priority: '0.7' },
  { path: '/blog', changefreq: 'weekly', priority: '0.7' },
  { path: '/comment-ca-marche', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/mentions-legales', changefreq: 'yearly', priority: '0.3' },
  { path: '/politique-confidentialite', changefreq: 'yearly', priority: '0.3' },
  { path: '/cgu', changefreq: 'yearly', priority: '0.3' },
];
const staticXml = wrapUrlset(staticPages.map((p) => urlBlock(`${SITE_URL}${p.path}`, now, p.changefreq, p.priority)).join('\n'));

// ----- 2. events (with full audit) -----
const { data: events, error: eventsError } = await supabase
  .from('events')
  .select('id, slug, updated_at, date_debut, secteur, ville, enrichissement_date, visible, is_test')
  .eq('visible', true)
  .eq('is_test', false)
  .order('date_debut', { ascending: false })
  .limit(5000);
if (eventsError) {
  console.error('[sitemap:build] events fetch failed', eventsError);
  process.exit(1);
}

const eventsRaw = events ?? [];
const eligibleEvents = [];
const excludedEvents = []; // { slug?, id, reason }
const seenSlugs = new Set();

for (const ev of eventsRaw) {
  if (!ev.slug || String(ev.slug).trim() === '') {
    excludedEvents.push({ id: ev.id, slug: ev.slug, reason: 'slug-missing' });
    continue;
  }
  if (seenSlugs.has(ev.slug)) {
    excludedEvents.push({ id: ev.id, slug: ev.slug, reason: 'duplicate-slug' });
    continue;
  }
  if (!ev.date_debut) {
    excludedEvents.push({ id: ev.id, slug: ev.slug, reason: 'date-missing' });
    continue;
  }
  seenSlugs.add(ev.slug);
  eligibleEvents.push(ev);
}

const eventsXml = wrapUrlset(
  eligibleEvents
    .map((ev) => {
      const lastmod = formatDate(ev.enrichissement_date) || formatDate(ev.updated_at) || now;
      const isUpcoming = new Date(ev.date_debut) >= new Date();
      return urlBlock(`${SITE_URL}/events/${encodeURIComponent(ev.slug)}`, lastmod, isUpcoming ? 'daily' : 'monthly', isUpcoming ? '0.8' : '0.5');
    })
    .join('\n'),
);

// ----- 3. blog -----
const { data: blog, error: blogError } = await supabase
  .from('blog_articles')
  .select('slug, updated_at, published_at, status')
  .in('status', ['published', 'ready', 'scheduled'])
  .not('slug', 'is', null)
  .order('published_at', { ascending: false, nullsLast: true })
  .limit(2000);
if (blogError) {
  console.error('[sitemap:build] blog fetch failed', blogError);
  process.exit(1);
}
const eligibleBlog = (blog ?? []).filter((a) => a.slug && a.status === 'published');
const blogXml = wrapUrlset(
  eligibleBlog
    .map((a) =>
      urlBlock(`${SITE_URL}/blog/${encodeURIComponent(a.slug)}`, formatDate(a.updated_at) || formatDate(a.published_at) || now, 'weekly', '0.8'),
    )
    .join('\n'),
);

// ----- 4. hubs (sectors + cities) — deduped -----
const CANONICAL_SECTORS = [
  'agroalimentaire-boissons', 'automobile-mobilite', 'btp-construction',
  'commerce-distribution', 'cosmetique-bien-etre', 'education-formation',
  'energie-environnement', 'industrie-production', 'mode-textile',
  'sante-medical', 'technologie-innovation', 'tourisme-evenementiel',
  'finance-assurance-immobilier', 'services-entreprises-rh', 'secteur-public-collectivites',
];
const uniqSectors = Array.from(new Set(CANONICAL_SECTORS));
if (uniqSectors.length !== CANONICAL_SECTORS.length) {
  console.warn('[sitemap:build] sector dedupe removed', CANONICAL_SECTORS.length - uniqSectors.length);
}

// lastmod hub: most recent updated_at of events matching that sector
function sectorLastmod(slug) {
  let max = null;
  for (const ev of eligibleEvents) {
    const list = Array.isArray(ev.secteur) ? ev.secteur : [];
    if (list.some((s) => slugifyCity(String(s)) === slug || String(s).toLowerCase() === slug.replace(/-/g, ' '))) {
      const d = ev.updated_at ? new Date(ev.updated_at) : null;
      if (d && (!max || d > max)) max = d;
    }
  }
  return max ? max.toISOString().split('T')[0] : now;
}
function cityLastmod(slug) {
  let max = null;
  for (const ev of eligibleEvents) {
    if (ev.ville && slugifyCity(ev.ville) === slug) {
      const d = ev.updated_at ? new Date(ev.updated_at) : null;
      if (d && (!max || d > max)) max = d;
    }
  }
  return max ? max.toISOString().split('T')[0] : now;
}

const cityCount = {};
for (const ev of eligibleEvents) {
  if (!ev.ville) continue;
  const s = slugifyCity(ev.ville);
  if (!s) continue;
  cityCount[s] = (cityCount[s] || 0) + 1;
}
const eligibleCities = Object.entries(cityCount).filter(([, c]) => c >= 3).map(([s]) => s).sort();

// Sector × year counts (date_debut year). Indexable if count >= 3 for that sector & year.
const SECTOR_YEAR_THRESHOLD = 3;
const sectorYearCount = {}; // { [slug]: { [year]: number } }
const sectorYearLastmod = {}; // { [slug]: { [year]: Date } }
for (const ev of eligibleEvents) {
  if (!ev.date_debut) continue;
  const year = new Date(ev.date_debut).getFullYear();
  if (!Number.isFinite(year)) continue;
  const list = Array.isArray(ev.secteur) ? ev.secteur : [];
  for (const label of list) {
    const slug = slugifyCity(String(label));
    if (!uniqSectors.includes(slug)) continue;
    sectorYearCount[slug] = sectorYearCount[slug] || {};
    sectorYearCount[slug][year] = (sectorYearCount[slug][year] || 0) + 1;
    const d = ev.updated_at ? new Date(ev.updated_at) : null;
    if (d) {
      sectorYearLastmod[slug] = sectorYearLastmod[slug] || {};
      if (!sectorYearLastmod[slug][year] || d > sectorYearLastmod[slug][year]) {
        sectorYearLastmod[slug][year] = d;
      }
    }
  }
}
const eligibleSectorYears = [];
for (const slug of uniqSectors) {
  const years = sectorYearCount[slug] || {};
  for (const [year, n] of Object.entries(years)) {
    if (n >= SECTOR_YEAR_THRESHOLD) eligibleSectorYears.push({ slug, year: Number(year), n });
  }
}
eligibleSectorYears.sort((a, b) => a.slug.localeCompare(b.slug) || a.year - b.year);

const hubItems = [
  ...uniqSectors.map((s) => urlBlock(`${SITE_URL}/secteur/${s}`, sectorLastmod(s), 'weekly', '0.7')),
  ...eligibleSectorYears.map(({ slug, year }) => {
    const d = sectorYearLastmod[slug]?.[year];
    const lastmod = d ? d.toISOString().split('T')[0] : now;
    return urlBlock(`${SITE_URL}/secteur/${slug}/${year}`, lastmod, 'weekly', '0.6');
  }),
  ...eligibleCities.map((s) => urlBlock(`${SITE_URL}/ville/${s}`, cityLastmod(s), 'weekly', '0.7')),
];
const hubsXml = wrapUrlset(hubItems.join('\n'));

// ----- 5. write files + index -----
await mkdir(PUBLIC_DIR, { recursive: true });
await writeFile(path.join(PUBLIC_DIR, 'sitemap-static.xml'), staticXml, 'utf8');
await writeFile(path.join(PUBLIC_DIR, 'sitemap-events.xml'), eventsXml, 'utf8');
await writeFile(path.join(PUBLIC_DIR, 'sitemap-blog.xml'), blogXml, 'utf8');
await writeFile(path.join(PUBLIC_DIR, 'sitemap-hubs.xml'), hubsXml, 'utf8');

const indexXml = wrapIndex([
  { loc: `${SITE_URL}/sitemap-static.xml`, lastmod: now },
  { loc: `${SITE_URL}/sitemap-events.xml`, lastmod: now },
  { loc: `${SITE_URL}/sitemap-blog.xml`, lastmod: now },
  { loc: `${SITE_URL}/sitemap-hubs.xml`, lastmod: now },
]);
await writeFile(path.join(PUBLIC_DIR, 'sitemap.xml'), indexXml, 'utf8');

// ----- 6. audit log -----
console.log('\n=== Sitemap audit ===');
console.log(`Events DB (visible=true, is_test=false): ${eventsRaw.length}`);
console.log(`Events eligible (in sitemap-events.xml):  ${eligibleEvents.length}`);
console.log(`Events excluded:                          ${excludedEvents.length}`);
if (excludedEvents.length > 0) {
  const byReason = {};
  for (const e of excludedEvents) byReason[e.reason] = (byReason[e.reason] || 0) + 1;
  for (const [reason, n] of Object.entries(byReason)) console.log(`  - ${reason}: ${n}`);
  console.log('Detail of excluded events:');
  for (const e of excludedEvents) console.log(`    [${e.reason}] id=${e.id} slug=${e.slug ?? '(null)'}`);
}
console.log(`Blog articles included:                   ${eligibleBlog.length}`);
console.log(`Sector hubs (deduped):                    ${uniqSectors.length}`);
console.log(`Sector×year pages (>=${SECTOR_YEAR_THRESHOLD} events):           ${eligibleSectorYears.length}`);
for (const sy of eligibleSectorYears) console.log(`  - /secteur/${sy.slug}/${sy.year}  (${sy.n} events)`);
console.log(`City hubs (>=3 events):                   ${eligibleCities.length}`);
console.log('=====================\n');
console.log('[sitemap:build] index + 4 segmented sitemaps written to public/');
