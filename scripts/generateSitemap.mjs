import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SITE_URL = 'https://lotexpo.com';
const OUTPUT_PATH = path.resolve('public', 'sitemap.xml');
const ENV_PATH = path.resolve('.env');

async function loadEnvFile() {
  try {
    const content = await readFile(ENV_PATH, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing .env and rely on runtime environment variables.
  }
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

const formatDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
};

const escapeXml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const addUrl = (items, entry) => {
  items.push(entry);
};

const now = new Date().toISOString().split('T')[0];
const urls = [];
const counters = {
  home: 1,
  static: 0,
  events: 0,
  blog: 0,
  hubs: 0,
};

addUrl(urls, {
  loc: `${SITE_URL}/`,
  lastmod: now,
  changefreq: 'daily',
  priority: '1.0',
});

const staticPages = [
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

for (const page of staticPages) {
  addUrl(urls, {
    loc: `${SITE_URL}${page.path}`,
    lastmod: now,
    changefreq: page.changefreq,
    priority: page.priority,
  });
  counters.static += 1;
}

const [{ data: events, error: eventsError }, { data: blogArticles, error: blogError }] = await Promise.all([
  supabase
    .from('events')
    .select('slug, updated_at, date_debut')
    .eq('visible', true)
    .eq('is_test', false)
    .not('slug', 'is', null)
    .order('date_debut', { ascending: false }),
  supabase
    .from('blog_articles')
    .select('slug, updated_at, published_at')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('published_at', { ascending: false }),
]);

if (eventsError) {
  console.error('[sitemap:build] Failed to fetch events', eventsError);
  process.exit(1);
}

if (blogError) {
  console.error('[sitemap:build] Failed to fetch blog articles', blogError);
  process.exit(1);
}

for (const event of events ?? []) {
  if (!event.slug) continue;
  const eventDate = event.date_debut ? new Date(event.date_debut) : null;
  const isUpcoming = eventDate && eventDate >= new Date();

  addUrl(urls, {
    loc: `${SITE_URL}/events/${encodeURIComponent(event.slug)}`,
    lastmod: formatDate(event.updated_at) ?? now,
    changefreq: isUpcoming ? 'daily' : 'monthly',
    priority: isUpcoming ? '0.8' : '0.5',
  });
  counters.events += 1;
}

for (const article of blogArticles ?? []) {
  if (!article.slug) continue;
  addUrl(urls, {
    loc: `${SITE_URL}/blog/${encodeURIComponent(article.slug)}`,
    lastmod: formatDate(article.updated_at ?? article.published_at) ?? now,
    changefreq: 'weekly',
    priority: '0.8',
  });
  counters.blog += 1;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map(
    (url) => `  <url>\n    <loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ''}\n    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`
  )
  .join('\n')}\n</urlset>\n`;

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, xml, 'utf8');

console.log(`[sitemap:build] Generated ${urls.length} URLs`);
console.log(`[sitemap:build] Categories: home=${counters.home}, static=${counters.static}, events=${counters.events}, blog=${counters.blog}, hubs=${counters.hubs}`);
