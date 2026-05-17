#!/usr/bin/env node
// Build-time static SEO prerender for Lotexpo.
// Runs AFTER `vite build`. For each public route, reads the original dist/index.html
// shell ONCE (kept in memory as baseTemplate), injects per-route head + a hidden
// #seo-prerender body block fetched from Supabase REST (anon key, RLS-honoring),
// and writes dist/<route>/index.html. Home is written LAST so it never pollutes
// the template for other routes.
//
// Constraints:
//   - fetch() natif uniquement, pas de @supabase/supabase-js
//   - anon key uniquement (jamais service_role)
//   - aucun changement visuel React: bloc seo-prerender masqué via CSS

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const t0 = Date.now();
const DIST = path.resolve('dist');
const SITE_ORIGIN = 'https://lotexpo.com';
const ENV_PATH = path.resolve('.env');

// ---------- env loader ----------
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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[prerender] Missing SUPABASE_URL / SUPABASE_ANON_KEY. Aborting.');
  process.exit(1);
}

// ---------- helpers ----------
function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n).trimEnd() + '…';
}
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function firstSector(secteur) {
  if (!secteur) return null;
  if (Array.isArray(secteur)) return secteur[0] ? String(secteur[0]) : null;
  if (typeof secteur === 'string') {
    try { const j = JSON.parse(secteur); if (Array.isArray(j) && j[0]) return String(j[0]); } catch {}
    return secteur;
  }
  return null;
}
function fmtDateRange(start, end) {
  const f = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const s = f(start), e = f(end);
  if (s && e && s !== e) return `${s} au ${e}`;
  return s || e || '';
}

async function sb(pathQ) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) { console.warn('[prerender] sb non-200', res.status, pathQ.slice(0, 120)); return null; }
    return await res.json();
  } catch (e) {
    console.warn('[prerender] sb threw', e.message);
    return null;
  }
}

async function sbPaged(pathQ, pageSize = 1000) {
  const all = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
          Range: `${from}-${to}`,
          'Range-Unit': 'items',
          Prefer: 'count=exact',
        },
      });
      if (!res.ok) { console.warn('[prerender] paged non-200', res.status); break; }
      const chunk = await res.json();
      all.push(...chunk);
      if (chunk.length < pageSize) break;
      from += pageSize;
    } catch (e) { console.warn('[prerender] paged threw', e.message); break; }
  }
  return all;
}

// ---------- HTML injection ----------
const HIDE_CSS = `<style id="seo-prerender-style">#seo-prerender{position:absolute;left:-99999px;top:auto;width:1px;height:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);clip-path:inset(50%);white-space:nowrap}</style>`;

function applyToShell(baseTemplate, { title, description, headExtra, body }) {
  let html = baseTemplate;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  } else {
    html = html.replace(/<\/head>/i, `<meta name="description" content="${escapeHtml(description)}" />\n</head>`);
  }
  // Strip any pre-existing canonical to avoid duplicates
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '');
  html = html.replace(/<\/head>/i, `${headExtra}\n${HIDE_CSS}\n</head>`);
  if (html.includes('<div id="root">')) {
    html = html.replace('<div id="root">', `${body}\n<div id="root">`);
  } else {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${body}\n`);
  }
  return html;
}

function commonHead(canonical, title, desc, ogImage) {
  return `
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Lotexpo" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" /><meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}
    <link rel="canonical" href="${escapeHtml(canonical)}" />
  `;
}

// ---------- builders ----------
function buildEvent(ev, exhibitors) {
  const year = ev.date_debut ? new Date(ev.date_debut).getFullYear() : new Date().getFullYear();
  const city = ev.ville || 'France';
  const title = truncate(`${ev.nom_event} ${year} | Salon professionnel à ${city} – Lotexpo`, 70);
  const cleanDesc = stripHtml(ev.description_event);
  let description;
  if (ev.meta_description_gen) description = truncate(String(ev.meta_description_gen), 160);
  else if (cleanDesc) description = truncate(cleanDesc, 160);
  else description = `Retrouvez les informations clés sur ${ev.nom_event}, salon professionnel organisé à ${city}, sur Lotexpo.`;
  const canonical = `${SITE_ORIGIN}/events/${ev.slug}`;
  const sector = firstSector(ev.secteur);
  const sectorSlug = sector ? slugify(sector) : null;
  const citySlug = ev.ville ? slugify(ev.ville) : null;

  const eventSchema = {
    '@context': 'https://schema.org', '@type': 'Event',
    name: ev.nom_event,
    startDate: ev.date_debut || undefined,
    endDate: ev.date_fin || undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: ev.nom_lieu || ev.ville || 'France',
      address: { '@type': 'PostalAddress', addressLocality: ev.ville, addressCountry: 'FR' } },
    description: cleanDesc ? truncate(cleanDesc, 500) : description,
    image: ev.url_image || undefined,
    url: canonical,
  };
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Salons', item: `${SITE_ORIGIN}/events` },
      { '@type': 'ListItem', position: 3, name: ev.nom_event, item: canonical },
    ],
  };

  const headExtra = commonHead(canonical, title, description, ev.url_image)
    + `<script type="application/ld+json">${safeJsonLd(eventSchema)}</script>`
    + `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`;

  const dateLine = fmtDateRange(ev.date_debut, ev.date_fin);
  const bodyDesc = truncate(cleanDesc || String(ev.meta_description_gen || ''), 300);
  const exhibitorsBlock = (exhibitors && exhibitors.length > 0)
    ? `<section><h2>Entreprises exposantes référencées</h2>
        <p>Lotexpo recense actuellement ${exhibitors.length} entreprise${exhibitors.length > 1 ? 's' : ''} associée${exhibitors.length > 1 ? 's' : ''} à cet événement.</p>
        <ul>${exhibitors.map((e) => `<li>${escapeHtml(e.name)}</li>`).join('')}</ul>
      </section>`
    : '';

  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>${escapeHtml(ev.nom_event)} ${escapeHtml(String(year))} – ${escapeHtml(city)}</h1>
    ${bodyDesc ? `<p>${escapeHtml(bodyDesc)}</p>` : ''}
    ${dateLine ? `<p>Dates : ${escapeHtml(dateLine)}${ev.nom_lieu ? ' – ' + escapeHtml(ev.nom_lieu) : ''}${ev.ville ? ', ' + escapeHtml(ev.ville) : ''}</p>` : ''}
    ${sectorSlug ? `<p><a href="/secteur/${encodeURIComponent(sectorSlug)}">Voir les salons ${escapeHtml(sector)}</a></p>` : ''}
    ${citySlug ? `<p><a href="/ville/${encodeURIComponent(citySlug)}">Voir les salons professionnels à ${escapeHtml(ev.ville)}</a></p>` : ''}
    ${exhibitorsBlock}
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildHome() {
  const canonical = `${SITE_ORIGIN}/`;
  const title = 'Lotexpo | Tous les salons professionnels en France';
  const description = 'Lotexpo centralise les salons professionnels, congrès, conventions et événements B2B en France. Identifiez les événements par secteur, ville et date, puis repérez les exposants associés.';
  const websiteSchema = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lotexpo', url: SITE_ORIGIN };
  const orgSchema = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Lotexpo', url: SITE_ORIGIN };
  const headExtra = commonHead(canonical, title, description)
    + `<script type="application/ld+json">${safeJsonLd(websiteSchema)}</script>`
    + `<script type="application/ld+json">${safeJsonLd(orgSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Tous les salons professionnels en France</h1>
    <p>Lotexpo centralise les salons professionnels, congrès, conventions et événements B2B organisés en France. La plateforme permet d'identifier rapidement les événements à venir par secteur, ville, date et type de salon, puis de repérer les exposants associés lorsqu'ils sont disponibles.</p>
    <p><a href="/events">Voir tous les salons à venir</a></p>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildBlogIndex(articles) {
  const canonical = `${SITE_ORIGIN}/blog`;
  const title = 'Blog Lotexpo – Salons professionnels, secteurs & exposants';
  const description = 'Articles, guides et analyses sur les salons professionnels en France : secteurs porteurs, calendriers, exposants à suivre et tendances B2B.';
  const headExtra = commonHead(canonical, title, description);
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Blog Lotexpo</h1>
    <p>${escapeHtml(description)}</p>
    <ul>${articles.map((a) => `<li><a href="/blog/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildBlogArticle(a) {
  const title = truncate(a.meta_title || `${a.title} | Lotexpo`, 70);
  const description = truncate(a.meta_description || stripHtml(a.intro_text) || `Article Lotexpo : ${a.title}.`, 160);
  const canonical = `${SITE_ORIGIN}/blog/${a.slug}`;
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: a.h1_title || a.title,
    datePublished: a.published_at || undefined,
    dateModified: a.updated_at || a.published_at || undefined,
    image: a.header_image_url || undefined,
    url: canonical,
    publisher: { '@type': 'Organization', name: 'Lotexpo', url: SITE_ORIGIN },
  };
  const headExtra = commonHead(canonical, title, description, a.header_image_url)
    + `<script type="application/ld+json">${safeJsonLd(articleSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>${escapeHtml(a.h1_title || a.title)}</h1>
    <p>${escapeHtml(truncate(stripHtml(a.intro_text), 300))}</p>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildSector(slug, label, top) {
  const sectorLabel = label || slug.replace(/-/g, ' ');
  const title = truncate(`Salons ${sectorLabel} en France | Lotexpo`, 70);
  const description = truncate(`Découvrez les salons professionnels du secteur ${sectorLabel} en France : ${top.length} événement${top.length > 1 ? 's' : ''} à venir, dates, lieux et exposants sur Lotexpo.`, 160);
  const canonical = `${SITE_ORIGIN}/secteur/${slug}`;
  const collectionSchema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: title, url: canonical, description,
    hasPart: top.slice(0, 5).map((e) => ({ '@type': 'Event', name: e.nom_event, url: `${SITE_ORIGIN}/events/${e.slug}`, startDate: e.date_debut || undefined })),
  };
  const headExtra = commonHead(canonical, title, description) + `<script type="application/ld+json">${safeJsonLd(collectionSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons ${escapeHtml(String(sectorLabel))} en France</h1>
    <p>Lotexpo référence ${top.length} salon${top.length > 1 ? 's' : ''} professionnel${top.length > 1 ? 's' : ''} à venir dans le secteur ${escapeHtml(String(sectorLabel))}.</p>
    <ul>${top.slice(0, 5).map((e) => `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.ville ? ' – ' + escapeHtml(e.ville) : ''}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildCity(slug, label, top) {
  const cityLabel = label || slug.replace(/-/g, ' ');
  const title = truncate(`Salons professionnels à ${cityLabel} | Lotexpo`, 70);
  const description = truncate(`Tous les salons professionnels organisés à ${cityLabel} : ${top.length} événement${top.length > 1 ? 's' : ''} à venir, dates, secteurs et exposants sur Lotexpo.`, 160);
  const canonical = `${SITE_ORIGIN}/ville/${slug}`;
  const collectionSchema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: title, url: canonical, description,
    hasPart: top.slice(0, 5).map((e) => ({ '@type': 'Event', name: e.nom_event, url: `${SITE_ORIGIN}/events/${e.slug}`, startDate: e.date_debut || undefined })),
  };
  const headExtra = commonHead(canonical, title, description) + `<script type="application/ld+json">${safeJsonLd(collectionSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons professionnels à ${escapeHtml(String(cityLabel))}</h1>
    <p>Lotexpo recense ${top.length} salon${top.length > 1 ? 's' : ''} professionnel${top.length > 1 ? 's' : ''} à venir à ${escapeHtml(String(cityLabel))}.</p>
    <ul>${top.slice(0, 5).map((e) => `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.date_debut ? ' – ' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) : ''}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

// ---------- write helper ----------
async function writeRoute(routePath, html) {
  const isRoot = routePath === '/' || routePath === '';
  const dir = isRoot ? DIST : path.join(DIST, routePath.replace(/^\//, ''));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html, 'utf8');
}

// ---------- main ----------
async function main() {
  // 1. read base shell ONCE
  let baseTemplate;
  try {
    baseTemplate = await readFile(path.join(DIST, 'index.html'), 'utf8');
  } catch (e) {
    console.error('[prerender] dist/index.html missing. Run `vite build` first.');
    process.exit(1);
  }
  console.log(`[prerender] shell size=${baseTemplate.length}`);

  let errors = 0;
  const stats = { events: 0, eventsWithExh: 0, blog: 0, sectors: 0, cities: 0 };

  // 2. fetch events
  const eventFields = 'id,slug,nom_event,ville,nom_lieu,date_debut,date_fin,secteur,description_event,meta_description_gen,url_image,updated_at,url_site_officiel,visible,is_test';
  const events = await sbPaged(`events?visible=eq.true&is_test=eq.false&slug=not.is.null&select=${eventFields}&order=date_debut.desc`);
  console.log(`[prerender] events fetched: ${events.length}`);

  // 3. generate each event page (sequential to limit concurrent fetches)
  for (const ev of events) {
    if (!ev.slug) continue;
    try {
      const parts = await sb(`participations_with_exhibitors?id_event=eq.${encodeURIComponent(ev.id)}&select=name_final,exhibitor_name,legacy_name,website_final,website_exposant&limit=20`);
      let exhibitors = [];
      if (Array.isArray(parts) && parts.length > 0) {
        exhibitors = parts.map((p) => ({
          name: p.name_final || p.exhibitor_name || p.legacy_name || p.website_final || p.website_exposant || '',
          website: p.website_final || p.website_exposant || undefined,
        })).filter((p) => p.name && p.name.trim().length > 1);
      }
      const built = buildEvent(ev, exhibitors);
      const html = applyToShell(baseTemplate, built);
      await writeRoute(`/events/${ev.slug}`, html);
      stats.events++;
      if (exhibitors.length > 0) stats.eventsWithExh++;
    } catch (e) {
      errors++; console.warn('[prerender] event failed', ev.slug, e.message);
    }
  }

  // 4. blog
  const articles = await sb(`blog_articles?status=eq.published&slug=not.is.null&select=title,h1_title,slug,meta_title,meta_description,intro_text,header_image_url,published_at,updated_at&order=published_at.desc&limit=500`) || [];
  // blog index
  try {
    const built = buildBlogIndex(articles.slice(0, 20));
    await writeRoute('/blog', applyToShell(baseTemplate, built));
  } catch (e) { errors++; console.warn('[prerender] blog index failed', e.message); }
  for (const a of articles) {
    if (!a.slug) continue;
    try {
      const built = buildBlogArticle(a);
      await writeRoute(`/blog/${a.slug}`, applyToShell(baseTemplate, built));
      stats.blog++;
    } catch (e) { errors++; console.warn('[prerender] blog failed', a.slug, e.message); }
  }

  // 5. sectors (canonical list, aligned with sitemap)
  const CANONICAL_SECTORS = [
    'agroalimentaire-boissons', 'automobile-mobilite', 'btp-construction',
    'commerce-distribution', 'cosmetique-bien-etre', 'education-formation',
    'energie-environnement', 'industrie-production', 'mode-textile',
    'sante-medical', 'technologie-innovation', 'tourisme-evenementiel',
    'finance-assurance-immobilier', 'services-entreprises-rh', 'secteur-public-collectivites',
  ];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date_fin && e.date_fin >= today || (!e.date_fin && e.date_debut && e.date_debut >= today));
  for (const slug of CANONICAL_SECTORS) {
    try {
      const matches = upcoming.filter((e) => {
        const sec = e.secteur;
        const list = Array.isArray(sec) ? sec : (typeof sec === 'string' ? [sec] : []);
        return list.some((s) => slugify(String(s)) === slug);
      }).sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''));
      const label = matches[0] ? firstSector(matches[0].secteur) : slug.replace(/-/g, ' ');
      const built = buildSector(slug, label, matches);
      await writeRoute(`/secteur/${slug}`, applyToShell(baseTemplate, built));
      stats.sectors++;
    } catch (e) { errors++; console.warn('[prerender] sector failed', slug, e.message); }
  }

  // 6. cities (>=3 events upcoming OR overall)
  const cityCount = {};
  const cityLabel = {};
  for (const e of events) {
    if (!e.ville) continue;
    const s = slugify(e.ville); if (!s) continue;
    cityCount[s] = (cityCount[s] || 0) + 1;
    if (!cityLabel[s]) cityLabel[s] = e.ville;
  }
  const eligibleCities = Object.keys(cityCount).filter((s) => cityCount[s] >= 3);
  for (const slug of eligibleCities) {
    try {
      const matches = upcoming.filter((e) => e.ville && slugify(e.ville) === slug)
        .sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''));
      const built = buildCity(slug, cityLabel[slug], matches);
      await writeRoute(`/ville/${slug}`, applyToShell(baseTemplate, built));
      stats.cities++;
    } catch (e) { errors++; console.warn('[prerender] city failed', slug, e.message); }
  }

  // 7. home — written LAST so it never pollutes the template
  try {
    const built = buildHome();
    const html = applyToShell(baseTemplate, built);
    await writeFile(path.join(DIST, 'index.html'), html, 'utf8');
  } catch (e) { errors++; console.warn('[prerender] home failed', e.message); }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n=== Prerender summary ===');
  console.log(`Events expected:   ${events.length}`);
  console.log(`Events generated:  ${stats.events}`);
  console.log(`Events w/ exh:     ${stats.eventsWithExh}`);
  console.log(`Blog articles:     ${stats.blog}`);
  console.log(`Sector hubs:       ${stats.sectors}`);
  console.log(`City hubs:         ${stats.cities}`);
  console.log(`Errors:            ${errors}`);
  console.log(`Duration:          ${dur}s`);
  console.log('=========================\n');
}

main().catch((e) => { console.error('[prerender] fatal', e); process.exit(1); });
