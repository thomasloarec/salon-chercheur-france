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
import { CITY_ALIASES } from './cityAliases.mjs';

const t0 = Date.now();
const DIST = path.resolve('dist');
const SITE_ORIGIN = 'https://lotexpo.com';
const ENV_PATH = path.resolve('.env');
// Dedicated landscape OG card for exhibitor pages (never the company logo).
const OG_EXHIBITOR_FALLBACK = 'https://lotexpo.com/og-exhibitor-default.png';

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
// Satellite communes mapped onto a parent city hub (Chassieu→Lyon, etc).
function cityHubSlug(s) {
  const raw = slugify(s);
  if (!raw) return '';
  return (CITY_ALIASES[raw] && CITY_ALIASES[raw].slug) || raw;
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

// Paged REST fetch (anon key, RLS-honoring).
// NOTE: we deliberately DO NOT send `Prefer: count=exact`. On heavy views like
// public_exhibitor_profiles a server-side exact COUNT triggers a statement
// timeout (Postgres 57014) → HTTP 500. We never read the count header anyway:
// pagination stops when a page returns fewer rows than `pageSize`.
// Each page is retried up to 3x with exponential backoff on transient 5xx.
async function sbPaged(pathQ, pageSize = 500) {
  const all = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    let chunk = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
            Range: `${from}-${to}`,
            'Range-Unit': 'items',
          },
        });
        if (res.ok) { chunk = await res.json(); break; }
        // Retry only transient server errors (5xx); client errors are terminal.
        if (res.status >= 500 && attempt < 3) {
          const backoff = 500 * 2 ** (attempt - 1);
          console.warn(`[prerender] paged ${res.status} (attempt ${attempt}/3), retrying in ${backoff}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        console.warn('[prerender] paged non-200', res.status);
        break;
      } catch (e) {
        if (attempt < 3) {
          const backoff = 500 * 2 ** (attempt - 1);
          console.warn(`[prerender] paged threw "${e.message}" (attempt ${attempt}/3), retrying in ${backoff}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        console.warn('[prerender] paged threw', e.message);
        break;
      }
    }
    if (chunk === null) break; // page failed after retries → stop (guard will catch low volume)
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ---------- HTML injection ----------
const HIDE_CSS = `<style id="seo-prerender-style">#seo-prerender{position:absolute;left:-99999px;top:auto;width:1px;height:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);clip-path:inset(50%);white-space:nowrap}</style>`;

function applyToShell(baseTemplate, { title, description, headExtra, body, robots }) {
  let html = baseTemplate;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  } else {
    html = html.replace(/<\/head>/i, `<meta name="description" content="${escapeHtml(description)}" />\n</head>`);
  }
  // Strip any pre-existing canonical to avoid duplicates
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '');
  // When a builder dictates robots (exhibitor pages), strip any pre-existing
  // robots meta and write the decision HARD into the HTML (crawler-visible
  // without JS). Other builders leave robots untouched (default = indexable).
  if (robots) {
    html = html.replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '');
  }
  const robotsTag = robots ? `<meta name="robots" content="${escapeHtml(robots)}" />\n` : '';
  html = html.replace(/<\/head>/i, `${robotsTag}${headExtra}\n${HIDE_CSS}\n</head>`);
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
function buildEvent(ev, exhibitors, novelties) {
  const year = ev.date_debut ? new Date(ev.date_debut).getFullYear() : new Date().getFullYear();
  const city = ev.ville || 'France';
  const title = truncate(`${ev.nom_event} ${year} | Salon professionnel à ${city} – Lotexpo`, 70);
  // Description publiable : description_enrichie UNIQUEMENT si statut='valide'
  const enrichedValid =
    ev.enrichissement_statut === 'valide' && ev.description_enrichie
      ? stripHtml(ev.description_enrichie)
      : '';
  const cleanDescRaw = stripHtml(ev.description_event);
  const cleanDesc = enrichedValid || cleanDescRaw;
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
        <ul>${exhibitors.map((e) => e.slug
          ? `<li><a href="/exposants/${encodeURIComponent(e.slug)}">${escapeHtml(e.name)}</a></li>`
          : `<li>${escapeHtml(e.name)}</li>`).join('')}</ul>
      </section>`
    : '';

  // Inbound maillage → novelty detail pages (model = exhibitorsBlock above).
  // Only indexable novelties reach this list (filtered upstream). No empty section.
  const noveltiesBlock = (novelties && novelties.length > 0)
    ? `<section><h2>Nouveautés de cet événement</h2>
        <p>Découvrez ${novelties.length} nouveauté${novelties.length > 1 ? 's' : ''} présentée${novelties.length > 1 ? 's' : ''} par les exposants de cet événement.</p>
        <ul>${novelties.map((n) =>
          `<li><a href="/nouveautes/${encodeURIComponent(n.slug)}">${escapeHtml(n.title)}${n.exhibitor_display_name ? ' – ' + escapeHtml(n.exhibitor_display_name) : ''}</a></li>`).join('')}</ul>
      </section>`
    : '';

  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>${escapeHtml(ev.nom_event)} ${escapeHtml(String(year))} – ${escapeHtml(city)}</h1>
    ${bodyDesc ? `<p>${escapeHtml(bodyDesc)}</p>` : ''}
    ${dateLine ? `<p>Dates : ${escapeHtml(dateLine)}${ev.nom_lieu ? ' – ' + escapeHtml(ev.nom_lieu) : ''}${ev.ville ? ', ' + escapeHtml(ev.ville) : ''}</p>` : ''}
    ${sectorSlug ? `<p><a href="/secteur/${encodeURIComponent(sectorSlug)}">Voir les salons ${escapeHtml(sector)}</a></p>` : ''}
    ${citySlug ? `<p><a href="/ville/${encodeURIComponent(citySlug)}">Voir les salons professionnels à ${escapeHtml(ev.ville)}</a></p>` : ''}
    ${exhibitorsBlock}
    ${noveltiesBlock}
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildHome() {
  const canonical = `${SITE_ORIGIN}/`;
  const title = 'Salons professionnels en France | Lotexpo';
  const description = "Retrouvez les salons professionnels à venir en France, classés par secteur, ville et période. Calendrier B2B complet, dates, lieux et exposants sur Lotexpo.";
  const websiteSchema = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lotexpo', url: SITE_ORIGIN };
  const orgSchema = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Lotexpo', url: SITE_ORIGIN };
  const headExtra = commonHead(canonical, title, description)
    + `<script type="application/ld+json">${safeJsonLd(websiteSchema)}</script>`
    + `<script type="application/ld+json">${safeJsonLd(orgSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons professionnels en France</h1>
    <p>Retrouvez les salons professionnels à venir en France, classés par secteur, ville et période. Lotexpo centralise les salons, congrès, conventions et événements B2B avec leurs dates, lieux et exposants associés.</p>
    <p><a href="/salons-professionnels-2026">Voir les salons professionnels 2026</a> · <a href="/events">Calendrier complet</a> · <a href="/nouveautes">Nouveautés des exposants</a></p>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildAnnualHub(year, eventsFuture, sectors, cities, monthGroups) {
  const canonical = `${SITE_ORIGIN}/salons-professionnels-${year}`;
  const title = `Salons professionnels ${year} en France | Lotexpo`;
  const description = `Découvrez les salons professionnels ${year} en France : dates, villes, secteurs d'activité, lieux et événements référencés sur Lotexpo.`;
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Salons professionnels', item: `${SITE_ORIGIN}/events` },
      { '@type': 'ListItem', position: 3, name: `Salons professionnels ${year}`, item: canonical },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title,
    numberOfItems: eventsFuture.length,
    itemListElement: eventsFuture.slice(0, 50).map((e, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_ORIGIN}/events/${encodeURIComponent(e.slug)}`,
      name: e.nom_event,
    })),
  };
  const headExtra = commonHead(canonical, title, description)
    + `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`
    + `<script type="application/ld+json">${safeJsonLd(itemList)}</script>`;

  const sectorsLis = sectors.map(s => {
    const cities = (s.topCities && s.topCities.length) ? ` — ${s.topCities.join(', ')}` : '';
    return `<li><a href="/secteur/${s.slug}/${year}">Salons ${escapeHtml(s.label)} ${year}</a> (${s.count} salon${s.count > 1 ? 's' : ''})${escapeHtml(cities)}</li>`;
  }).join('');
  const citiesLis = cities.map(c => {
    const sec = (c.topSectors && c.topSectors.length) ? ` — ${c.topSectors.join(', ')}` : '';
    return `<li><a href="/ville/${c.slug}/${year}">Salons professionnels à ${escapeHtml(c.name)} en ${year}</a> (${c.count} salon${c.count > 1 ? 's' : ''})${escapeHtml(sec)}</li>`;
  }).join('');
  const upcomingLis = eventsFuture.slice(0, 12).map(e =>
    `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.ville ? ' – ' + escapeHtml(e.ville) : ''}${e.date_debut ? ' (' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) + ')' : ''}</a></li>`
  ).join('');
  const monthsBlocks = monthGroups.map(g => {
    const evLis = (g.events || []).map(e =>
      `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.ville ? ' – ' + escapeHtml(e.ville) : ''}${e.date_debut ? ' (' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) + ')' : ''}</a></li>`
    ).join('');
    return `<section><h3>${escapeHtml(g.label)} – ${g.total} salon${g.total > 1 ? 's' : ''}</h3>${evLis ? `<ul>${evLis}</ul>` : ''}</section>`;
  }).join('');

  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons professionnels ${year} en France</h1>
    <p>Retrouvez les ${eventsFuture.length} salons professionnels programmés en France en ${year}. Explorez les événements par secteur, ville ou période, puis accédez aux fiches détaillées des salons référencés sur Lotexpo.</p>
    ${sectorsLis ? `<h2>Explorer par secteur</h2><ul>${sectorsLis}</ul>` : ''}
    ${citiesLis ? `<h2>Explorer par ville</h2><ul>${citiesLis}</ul>` : ''}
    ${upcomingLis ? `<h2>Prochains salons professionnels ${year}</h2><ul>${upcomingLis}</ul>` : ''}
    ${monthsBlocks ? `<h2>Calendrier ${year} mois par mois</h2>${monthsBlocks}` : ''}
    <p><a href="/">Tous les salons à venir</a> · <a href="/events">Calendrier complet</a></p>
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
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: top.slice(0, 5).map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: e.nom_event,
        url: `${SITE_ORIGIN}/events/${e.slug}`,
      })),
    },
  };
  const headExtra = commonHead(canonical, title, description) + `<script type="application/ld+json">${safeJsonLd(collectionSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons ${escapeHtml(String(sectorLabel))} en France</h1>
    <p>Lotexpo référence ${top.length} salon${top.length > 1 ? 's' : ''} professionnel${top.length > 1 ? 's' : ''} à venir dans le secteur ${escapeHtml(String(sectorLabel))}.</p>
    <ul>${top.slice(0, 5).map((e) => `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.ville ? ' – ' + escapeHtml(e.ville) : ''}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildSectorYear(slug, label, year, eventsOfYear, otherYears) {
  const sectorLabel = label || slug.replace(/-/g, ' ');
  const n = eventsOfYear.length;
  const title = truncate(`Salons ${sectorLabel} en France en ${year} | Lotexpo`, 70);
  const description = truncate(`${n} salons ${sectorLabel} programmés en ${year} en France. Consultez les dates, lieux, villes, exposants et informations pratiques sur Lotexpo.`, 160);
  const evergreen = `${SITE_ORIGIN}/secteur/${slug}`;
  const self = `${SITE_ORIGIN}/secteur/${slug}/${year}`;
  const canonical = self;
  // top cities for intro
  const cityCount = {};
  for (const e of eventsOfYear) { if (e.ville) cityCount[e.ville] = (cityCount[e.ville] || 0) + 1; }
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  const introCities = topCities.length ? ` Principales villes représentées : ${topCities.join(', ')}.` : '';
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Salons professionnels', item: `${SITE_ORIGIN}/events` },
      { '@type': 'ListItem', position: 3, name: `Salons ${sectorLabel}`, item: evergreen },
      { '@type': 'ListItem', position: 4, name: `Salons ${sectorLabel} ${year}`, item: self },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `Salons ${sectorLabel} en France en ${year}`,
    numberOfItems: n,
    itemListElement: eventsOfYear.slice(0, 50).map((e, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_ORIGIN}/events/${encodeURIComponent(e.slug)}`,
      name: e.nom_event,
    })),
  };
  const headExtra = commonHead(canonical, title, description)
    + `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`
    + `<script type="application/ld+json">${safeJsonLd(itemList)}</script>`;
  const eventLis = eventsOfYear.slice(0, 60).map((e) =>
    `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.ville ? ' – ' + escapeHtml(e.ville) : ''}${e.date_debut ? ' (' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) + ')' : ''}</a></li>`,
  ).join('');
  const otherYearsLis = otherYears.map((y) =>
    `<li><a href="/secteur/${slug}/${y}">Salons ${escapeHtml(sectorLabel)} ${y}</a></li>`,
  ).join('');
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons ${escapeHtml(String(sectorLabel))} en France en ${year}</h1>
    <p>Retrouvez les ${n} salons professionnels du secteur ${escapeHtml(String(sectorLabel))} programmés en France en ${year}.${escapeHtml(introCities)} Cette page regroupe les événements de l'année avec leurs dates, villes, lieux et liens vers les fiches détaillées.</p>
    <ul>${eventLis}</ul>
    <p><a href="/secteur/${slug}">Voir tous les salons ${escapeHtml(String(sectorLabel))}</a></p>
    ${otherYearsLis ? `<h2>Autres années disponibles</h2><ul>${otherYearsLis}</ul>` : ''}
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
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: top.slice(0, 5).map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: e.nom_event,
        url: `${SITE_ORIGIN}/events/${e.slug}`,
      })),
    },
  };
  const headExtra = commonHead(canonical, title, description) + `<script type="application/ld+json">${safeJsonLd(collectionSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons professionnels à ${escapeHtml(String(cityLabel))}</h1>
    <p>Lotexpo recense ${top.length} salon${top.length > 1 ? 's' : ''} professionnel${top.length > 1 ? 's' : ''} à venir à ${escapeHtml(String(cityLabel))}.</p>
    <ul>${top.slice(0, 5).map((e) => `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.date_debut ? ' – ' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) : ''}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildCityYear(slug, label, year, eventsOfYear, otherYears) {
  const cityLabel = label || slug.replace(/-/g, ' ');
  const n = eventsOfYear.length;
  const title = truncate(`Salons professionnels à ${cityLabel} en ${year} | Lotexpo`, 70);
  const description = truncate(`${n} salons professionnels programmés à ${cityLabel} en ${year}. Consultez les dates, lieux, secteurs, exposants et informations pratiques sur Lotexpo.`, 160);
  const evergreen = `${SITE_ORIGIN}/ville/${slug}`;
  const self = `${SITE_ORIGIN}/ville/${slug}/${year}`;
  const canonical = self;
  // top sectors / venues for intro
  const sectorCount = {};
  const venueCount = {};
  for (const e of eventsOfYear) {
    const sec = e.secteur;
    const list = Array.isArray(sec) ? sec : (typeof sec === 'string' ? [sec] : []);
    for (const s of list) sectorCount[s] = (sectorCount[s] || 0) + 1;
    if (e.nom_lieu) venueCount[e.nom_lieu] = (venueCount[e.nom_lieu] || 0) + 1;
  }
  const topSectors = Object.entries(sectorCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s]) => s);
  const topVenues = Object.entries(venueCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v);
  const introSectors = topSectors.length ? ` Principaux secteurs représentés : ${topSectors.join(', ')}.` : '';
  const introVenues = topVenues.length ? ` Principaux lieux d'exposition : ${topVenues.join(', ')}.` : '';
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Salons professionnels', item: `${SITE_ORIGIN}/events` },
      { '@type': 'ListItem', position: 3, name: `Salons à ${cityLabel}`, item: evergreen },
      { '@type': 'ListItem', position: 4, name: `Salons à ${cityLabel} ${year}`, item: self },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `Salons professionnels à ${cityLabel} en ${year}`,
    numberOfItems: n,
    itemListElement: eventsOfYear.slice(0, 50).map((e, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_ORIGIN}/events/${encodeURIComponent(e.slug)}`,
      name: e.nom_event,
    })),
  };
  const headExtra = commonHead(canonical, title, description)
    + `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`
    + `<script type="application/ld+json">${safeJsonLd(itemList)}</script>`;
  const eventsList = eventsOfYear.slice(0, 50).map((e) =>
    `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.nom_lieu ? ' – ' + escapeHtml(e.nom_lieu) : ''}${e.date_debut ? ' (' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) + ')' : ''}</a></li>`
  ).join('');
  const otherYearsLinks = (otherYears || []).map((y) =>
    `<a href="/ville/${slug}/${y}">${escapeHtml(String(cityLabel))} ${y}</a>`
  ).join(' · ');
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons professionnels à ${escapeHtml(String(cityLabel))} en ${year}</h1>
    <p>Retrouvez les ${n} salons professionnels programmés à ${escapeHtml(String(cityLabel))} en ${year}.${escapeHtml(introSectors)}${escapeHtml(introVenues)} Cette page regroupe les événements à venir avec leurs dates, lieux, secteurs d'activité et liens vers les fiches détaillées.</p>
    <ul>${eventsList}</ul>
    <p><a href="${evergreen}">Tous les salons à ${escapeHtml(String(cityLabel))}</a>${otherYearsLinks ? ' · ' + otherYearsLinks : ''}</p>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

// Build a static exhibitor profile page (/exposants/:slug).
// robots decision is READ from profile.seo_indexable and written HARD into the
// HTML. Templates mirror src/components/exhibitor/ExhibitorProfileSEO.tsx.
// `events` = visible non-test events the exhibitor participates in (deduped).
function buildExhibitor(profile, events, novelties) {
  const name = profile.display_name || profile.canonical_name || 'Exposant';
  const slug = profile.public_slug;
  const indexable = profile.seo_indexable === true;
  const canonical = `${SITE_ORIGIN}/exposants/${slug}`;
  const robots = indexable ? 'index, follow' : 'noindex, follow';

  const title = `${name} : salons, nouveautés et événements professionnels | Lotexpo`.slice(0, 70);
  const description = (
    profile.description
      ? `Retrouvez les salons professionnels, nouveautés et informations publiques de ${name} sur Lotexpo.`
      : `Consultez la fiche exposant de ${name} sur Lotexpo : salons professionnels associés, nouveautés et informations publiques.`
  ).slice(0, 160);

  const ogImage = OG_EXHIBITOR_FALLBACK;

  // JSON-LD only for indexable profiles (no structured signals for noindex).
  let jsonLd = '';
  if (indexable) {
    const cleanDesc = stripHtml(profile.description || profile.ai_summary || '');
    const org = {
      '@context': 'https://schema.org', '@type': 'Organization',
      '@id': canonical, name, mainEntityOfPage: canonical,
    };
    if (profile.website) org.url = profile.website;
    if (profile.logo_url) org.logo = profile.logo_url;
    if (cleanDesc) org.description = truncate(cleanDesc, 500);
    const sameAs = [profile.linkedin_url].filter((u) => !!u && u !== profile.website);
    if (sameAs.length > 0) org.sameAs = sameAs;
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Salons', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Exposants', item: `${SITE_ORIGIN}/exposants` },
        { '@type': 'ListItem', position: 3, name, item: canonical },
      ],
    };
    jsonLd = `<script type="application/ld+json">${safeJsonLd(org)}</script>`
      + `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`;
  }

  const headExtra = commonHead(canonical, title, description, ogImage) + jsonLd;

  const eventsList = (events && events.length > 0)
    ? `<section><h2>Salons et événements</h2>
        <ul>${events.slice(0, 50).map((e) =>
          `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.ville ? ' – ' + escapeHtml(e.ville) : ''}${e.date_debut ? ' (' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) + ')' : ''}</a></li>`,
        ).join('')}</ul>
      </section>`
    : '';

  // Inbound maillage → novelty detail pages (model = eventsList above).
  // Only indexable novelties reach this list (filtered upstream). No empty section.
  const noveltiesList = (novelties && novelties.length > 0)
    ? `<section><h2>Nouveautés de cet exposant</h2>
        <ul>${novelties.slice(0, 50).map((n) =>
          `<li><a href="/nouveautes/${encodeURIComponent(n.slug)}">${escapeHtml(n.title)}${n.event_name ? ' – ' + escapeHtml(n.event_name) : ''}</a></li>`,
        ).join('')}</ul>
      </section>`
    : '';

  const descPara = profile.description ? `<p>${escapeHtml(truncate(stripHtml(profile.description), 300))}</p>` : '';

  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>${escapeHtml(name)}</h1>
    ${descPara}
    ${eventsList}
    ${noveltiesList}
    <p><a href="/exposants">Tous les exposants référencés</a></p>
  </div>`;

  return { title, description, canonical, headExtra, body, robots };
}

// Novelty pages (/nouveautes/:slug). Mirrors buildExhibitor: robots READ from
// seo_indexable (never recomputed) and written HARD into the HTML. Real <img>
// with alt are emitted in the visible #seo-prerender block so crawlers see
// them without JS (the React carousel is a progressive enhancement on top).
function buildNovelty(n) {
  const slug = n.slug;
  const exhibitorName = n.exhibitor_display_name || 'Exposant';
  const eventName = n.event_name || '';
  const indexable = n.seo_indexable === true;
  const canonical = `${SITE_ORIGIN}/nouveautes/${slug}`;
  const robots = indexable ? 'index, follow' : 'noindex, follow';

  const title = truncate(
    `${n.title} — ${exhibitorName}${eventName ? ` à ${eventName}` : ''} | Lotexpo`,
    70,
  );

  // Description: summary → details → reasons (cleaned + truncated).
  const reasons = [n.reason_1, n.reason_2, n.reason_3].filter(Boolean).join(' ');
  const descSource = stripHtml(n.summary) || stripHtml(n.details) || stripHtml(reasons)
    || `Découvrez ${n.title}, nouveauté présentée par ${exhibitorName}${eventName ? ` au salon ${eventName}` : ''} sur Lotexpo.`;
  const description = truncate(descSource, 160);

  const media = Array.isArray(n.media_urls) ? n.media_urls.filter(Boolean) : [];
  const ogImage = media[0] || OG_EXHIBITOR_FALLBACK;

  // JSON-LD only for indexable novelties (no structured signals for noindex).
  let jsonLd = '';
  if (indexable) {
    const keywords = [
      n.type ? String(n.type) : null,
      ...(Array.isArray(n.audience_tags) ? n.audience_tags.map(String) : []),
    ].filter(Boolean);
    const creative = {
      '@context': 'https://schema.org', '@type': 'CreativeWork',
      '@id': canonical, name: n.title, url: canonical,
      mainEntityOfPage: canonical,
    };
    if (media[0]) creative.image = media[0];
    const cleanDesc = stripHtml(n.summary || n.details || reasons);
    if (cleanDesc) creative.description = truncate(cleanDesc, 500);
    if (keywords.length > 0) creative.keywords = keywords.join(', ');
    if (exhibitorName) creative.creator = { '@type': 'Organization', name: exhibitorName };
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
        { '@type': 'ListItem', position: 2, name: 'Nouveautés', item: `${SITE_ORIGIN}/nouveautes` },
        { '@type': 'ListItem', position: 3, name: n.title, item: canonical },
      ],
    };
    jsonLd = `<script type="application/ld+json">${safeJsonLd(creative)}</script>`
      + `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`;
  }

  const headExtra = commonHead(canonical, title, description, ogImage) + jsonLd;

  const imgAlt = `${n.title} – ${exhibitorName}`;
  const imagesBlock = media.length > 0
    ? `<div>${media.map((u) =>
        `<img src="${escapeHtml(u)}" alt="${escapeHtml(imgAlt)}" loading="lazy" />`).join('')}</div>`
    : '';

  const descPara = descSource ? `<p>${escapeHtml(truncate(descSource, 300))}</p>` : '';
  const detailsPara = (stripHtml(n.details) && stripHtml(n.details) !== stripHtml(n.summary))
    ? `<p>${escapeHtml(truncate(stripHtml(n.details), 500))}</p>` : '';

  const exhibitorLink = n.exhibitor_public_slug
    ? `<p><a href="/exposants/${encodeURIComponent(n.exhibitor_public_slug)}">Voir la fiche exposant : ${escapeHtml(exhibitorName)}</a></p>`
    : '';
  const eventLink = n.event_slug
    ? `<p><a href="/events/${encodeURIComponent(n.event_slug)}">${escapeHtml(eventName || 'Voir le salon')}${n.event_ville ? ' – ' + escapeHtml(n.event_ville) : ''}</a></p>`
    : '';

  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>${escapeHtml(n.title)}</h1>
    <p>${escapeHtml(exhibitorName)}${eventName ? ` — ${escapeHtml(eventName)}` : ''}</p>
    ${imagesBlock}
    ${descPara}
    ${detailsPara}
    ${exhibitorLink}
    ${eventLink}
    <p><a href="/nouveautes">Toutes les nouveautés des salons</a></p>
  </div>`;

  return { title, description, canonical, headExtra, body, robots };
}

// Novelties index (/nouveautes). Lists every INDEXABLE novelty as a crawlable
// <a href="/nouveautes/:slug"> so detail pages are discoverable beyond the
// sitemap. Always indexable (index, follow).
function buildNoveltiesIndex(novelties) {
  const canonical = `${SITE_ORIGIN}/nouveautes`;
  const title = 'Nouveautés des salons professionnels | Lotexpo';
  const description = "Découvrez les dernières nouveautés présentées par les exposants des salons professionnels en France : lancements, innovations et démonstrations sur Lotexpo.";
  const robots = 'index, follow';
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title,
    numberOfItems: novelties.length,
    itemListElement: novelties.slice(0, 100).map((n, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_ORIGIN}/nouveautes/${encodeURIComponent(n.slug)}`,
      name: n.title,
    })),
  };
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Nouveautés', item: canonical },
    ],
  };
  const headExtra = commonHead(canonical, title, description)
    + `<script type="application/ld+json">${safeJsonLd(itemList)}</script>`
    + `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`;
  const list = novelties.map((n) =>
    `<li><a href="/nouveautes/${encodeURIComponent(n.slug)}">${escapeHtml(n.title)}</a>${n.exhibitor_display_name ? ' – ' + escapeHtml(n.exhibitor_display_name) : ''}${n.event_name ? ' (' + escapeHtml(n.event_name) + ')' : ''}</li>`,
  ).join('');
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Nouveautés des salons professionnels</h1>
    <p>Retrouvez les ${novelties.length} nouveautés présentées par les exposants des salons professionnels référencés sur Lotexpo : lancements de produits, innovations, démonstrations et offres.</p>
    <ul>${list}</ul>
    <p><a href="/events">Calendrier des salons</a> · <a href="/exposants">Tous les exposants</a></p>
  </div>`;
  return { title, description, canonical, headExtra, body, robots };
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
  const stats = { events: 0, eventsWithExh: 0, blog: 0, sectors: 0, sectorYears: 0, cities: 0, cityYears: 0, exhibitors: 0, exhibitorsIndexable: 0 };
  stats.novelties = 0;
  stats.noveltiesIndexable = 0;

  // 2. fetch events
  const eventFields = 'id,slug,nom_event,ville,nom_lieu,date_debut,date_fin,secteur,description_event,description_enrichie,enrichissement_statut,meta_description_gen,url_image,updated_at,url_site_officiel,visible,is_test';
  const events = await sbPaged(`events?visible=eq.true&is_test=eq.false&slug=not.is.null&select=${eventFields}&order=date_debut.desc`);
  console.log(`[prerender] events fetched: ${events.length}`);

  // 2a. SAFETY: abort the whole build (non-zero exit) on implausibly low data
  // BEFORE writing anything, so Vercel keeps the last good deploy and we never
  // ship a partial/empty site.
  const MIN_EVENTS = 50;
  if (!Array.isArray(events) || events.length < MIN_EVENTS) {
    console.error(`[prerender] FATAL: events volume implausibly low (${Array.isArray(events) ? events.length : 'null'} < ${MIN_EVENTS}). Aborting to preserve last good build.`);
    process.exit(1);
  }

  // 2b. fetch public exhibitor profiles + participations (used by the exhibitor
  // builder AND the event→exhibitor maillage). Done up-front so the SAFETY guard
  // runs before any write.
  const profileFields = 'public_slug,display_name,canonical_name,description,ai_summary,website,logo_url,linkedin_url,exhibitor_id,legacy_exposant_id,seo_indexable,is_test';
  const profiles = (await sbPaged(`public_exhibitor_profiles?is_test=eq.false&public_slug=not.is.null&select=${profileFields}&order=public_slug.asc`))
    .filter((p) => p.public_slug && String(p.public_slug).trim());
  console.log(`[prerender] exhibitor profiles fetched: ${profiles.length}`);
  const MIN_PROFILES = 1000;
  if (profiles.length < MIN_PROFILES) {
    console.error(`[prerender] FATAL: exhibitor profiles volume implausibly low (${profiles.length} < ${MIN_PROFILES}). Aborting to preserve last good build.`);
    process.exit(1);
  }

  const participations = await sbPaged('participation?select=id_event,id_exposant,exhibitor_id');
  console.log(`[prerender] participations fetched: ${participations.length}`);

  // Build lookup maps (no N+1): event by id, public_slug by exhibitor key,
  // and the set of (visible non-test) event ids per exhibitor key.
  const eventById = new Map(events.map((e) => [e.id, e]));
  const slugByExhibitorId = new Map();
  const slugByLegacyId = new Map();
  for (const p of profiles) {
    if (p.exhibitor_id) slugByExhibitorId.set(p.exhibitor_id, p.public_slug);
    if (p.legacy_exposant_id) slugByLegacyId.set(p.legacy_exposant_id, p.public_slug);
  }
  const resolveSlug = (exhibitorId, legacyId) => {
    if (exhibitorId && slugByExhibitorId.has(exhibitorId)) return slugByExhibitorId.get(exhibitorId);
    if (legacyId && slugByLegacyId.has(legacyId)) return slugByLegacyId.get(legacyId);
    return null;
  };
  const eventsByExhibitorId = new Map();
  const eventsByLegacyId = new Map();
  for (const p of participations) {
    if (!p.id_event || !eventById.has(p.id_event)) continue;
    if (p.exhibitor_id) {
      if (!eventsByExhibitorId.has(p.exhibitor_id)) eventsByExhibitorId.set(p.exhibitor_id, new Set());
      eventsByExhibitorId.get(p.exhibitor_id).add(p.id_event);
    }
    if (p.id_exposant) {
      if (!eventsByLegacyId.has(p.id_exposant)) eventsByLegacyId.set(p.id_exposant, new Set());
      eventsByLegacyId.get(p.id_exposant).add(p.id_event);
    }
  }

  // 3. generate each event page (sequential to limit concurrent fetches)
  for (const ev of events) {
    if (!ev.slug) continue;
    try {
      const parts = await sb(`participations_with_exhibitors?id_event=eq.${encodeURIComponent(ev.id)}&select=name_final,exhibitor_name,legacy_name,website_final,website_exposant,exhibitor_id,id_exposant&limit=20`);
      let exhibitors = [];
      if (Array.isArray(parts) && parts.length > 0) {
        exhibitors = parts.map((p) => ({
          name: p.name_final || p.exhibitor_name || p.legacy_name || p.website_final || p.website_exposant || '',
          website: p.website_final || p.website_exposant || undefined,
          slug: resolveSlug(p.exhibitor_id, p.id_exposant),
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

      // 5b. sector × year pages — Option B: FUTURE events only of that year, indexable if >= 3.
      const SECTOR_YEAR_THRESHOLD = 3;
      const allForSector = upcoming.filter((e) => {
        const sec = e.secteur;
        const list = Array.isArray(sec) ? sec : (typeof sec === 'string' ? [sec] : []);
        return list.some((s) => slugify(String(s)) === slug);
      });
      const byYear = {};
      for (const ev of allForSector) {
        if (!ev.date_debut) continue;
        const y = new Date(ev.date_debut).getFullYear();
        if (!Number.isFinite(y)) continue;
        (byYear[y] = byYear[y] || []).push(ev);
      }
      const eligibleYears = Object.entries(byYear)
        .filter(([, list]) => list.length >= SECTOR_YEAR_THRESHOLD)
        .map(([y]) => Number(y))
        .sort((a, b) => a - b);
      for (const y of eligibleYears) {
        try {
          const evYear = byYear[y].sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''));
          const others = eligibleYears.filter((yy) => yy !== y);
          const built2 = buildSectorYear(slug, label, y, evYear, others);
          await writeRoute(`/secteur/${slug}/${y}`, applyToShell(baseTemplate, built2));
          stats.sectorYears++;
        } catch (e) { errors++; console.warn('[prerender] sector-year failed', slug, y, e.message); }
      }
    } catch (e) { errors++; console.warn('[prerender] sector failed', slug, e.message); }
  }

  // 6. cities (>=3 events upcoming OR overall)
  const cityCount = {};
  const cityLabel = {};
  for (const e of events) {
    if (!e.ville) continue;
    const raw = slugify(e.ville);
    const s = cityHubSlug(e.ville);
    if (!s) continue;
    cityCount[s] = (cityCount[s] || 0) + 1;
    // Prefer a direct (non-aliased) ville as the canonical label so
    // /ville/lyon stays labelled "Lyon" even if a Chassieu event is seen first.
    if (!cityLabel[s] || (raw === s && cityLabel[s] && slugify(cityLabel[s]) !== s)) {
      cityLabel[s] = e.ville;
    }
  }
  const eligibleCities = Object.keys(cityCount).filter((s) => cityCount[s] >= 3);
  for (const slug of eligibleCities) {
    try {
      const matches = upcoming.filter((e) => e.ville && cityHubSlug(e.ville) === slug)
        .sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''));
      const built = buildCity(slug, cityLabel[slug], matches);
      await writeRoute(`/ville/${slug}`, applyToShell(baseTemplate, built));
      stats.cities++;

      // 6b. city × year pages — FUTURE events only, indexable if >= 3
      const CITY_YEAR_THRESHOLD = 3;
      const byYear = {};
      for (const ev of matches) {
        if (!ev.date_debut) continue;
        const y = new Date(ev.date_debut).getFullYear();
        if (!Number.isFinite(y)) continue;
        (byYear[y] = byYear[y] || []).push(ev);
      }
      const eligibleYears = Object.entries(byYear)
        .filter(([, list]) => list.length >= CITY_YEAR_THRESHOLD)
        .map(([y]) => Number(y))
        .sort((a, b) => a - b);
      for (const y of eligibleYears) {
        try {
          const evYear = byYear[y].sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''));
          const others = eligibleYears.filter((yy) => yy !== y);
          const built2 = buildCityYear(slug, cityLabel[slug], y, evYear, others);
          await writeRoute(`/ville/${slug}/${y}`, applyToShell(baseTemplate, built2));
          stats.cityYears++;
        } catch (e) { errors++; console.warn('[prerender] city-year failed', slug, y, e.message); }
      }
    } catch (e) { errors++; console.warn('[prerender] city failed', slug, e.message); }
  }

  // 7. annual hub /salons-professionnels-2026
  try {
    const ANNUAL_YEAR = 2026;
    const ANNUAL_THRESHOLD = 3;
    const futureOfYear = upcoming.filter((e) => {
      if (!e.date_debut) return false;
      return new Date(e.date_debut).getFullYear() === ANNUAL_YEAR;
    }).sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''));

    // sectors >= threshold (canonical only)
    const sectorAcc = {};
    for (const e of futureOfYear) {
      const sec = e.secteur;
      const list = Array.isArray(sec) ? sec : (typeof sec === 'string' ? [sec] : []);
      const raw = e.ville ? slugify(e.ville) : '';
      const hubSlug = raw ? cityHubSlug(e.ville) : '';
      const hubName = hubSlug
        ? ((CITY_ALIASES[raw] && CITY_ALIASES[raw].name) || e.ville)
        : '';
      for (const lbl of list) {
        const slug = slugify(String(lbl));
        if (!CANONICAL_SECTORS.includes(slug)) continue;
        sectorAcc[slug] = sectorAcc[slug] || { label: String(lbl), count: 0, cityCounts: {} };
        sectorAcc[slug].count++;
        if (hubName) sectorAcc[slug].cityCounts[hubName] = (sectorAcc[slug].cityCounts[hubName] || 0) + 1;
      }
    }
    const annualSectors = Object.entries(sectorAcc)
      .filter(([, v]) => v.count >= ANNUAL_THRESHOLD)
      .map(([slug, v]) => ({
        slug, label: v.label, count: v.count,
        topCities: Object.entries(v.cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
      }))
      .sort((a, b) => b.count - a.count);

    // cities >= threshold (with alias merge)
    const cityAcc = {};
    for (const e of futureOfYear) {
      if (!e.ville) continue;
      const raw = slugify(e.ville);
      const hubSlug = cityHubSlug(e.ville);
      if (!hubSlug) continue;
      if (!cityAcc[hubSlug]) {
        const aliasName = CITY_ALIASES[raw] && CITY_ALIASES[raw].name;
        cityAcc[hubSlug] = { name: aliasName || e.ville, count: 0, sectorCounts: {} };
      }
      if (raw === hubSlug) cityAcc[hubSlug].name = e.ville;
      cityAcc[hubSlug].count++;
      const sec = e.secteur;
      const list = Array.isArray(sec) ? sec : (typeof sec === 'string' ? [sec] : []);
      for (const lbl of list) {
        cityAcc[hubSlug].sectorCounts[String(lbl)] = (cityAcc[hubSlug].sectorCounts[String(lbl)] || 0) + 1;
      }
    }
    const annualCities = Object.entries(cityAcc)
      .filter(([, v]) => v.count >= ANNUAL_THRESHOLD)
      .map(([slug, v]) => ({
        slug, name: v.name, count: v.count,
        topSectors: Object.entries(v.sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
      }))
      .sort((a, b) => b.count - a.count);

    // months
    const monthMap = {};
    const monthOrder = [];
    for (const e of futureOfYear) {
      if (!e.date_debut) continue;
      const d = new Date(e.date_debut);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!(key in monthMap)) { monthMap[key] = []; monthOrder.push(key); }
      monthMap[key].push(e);
    }
    const monthGroups = monthOrder.map((k) => {
      const [y, m] = k.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return { label, total: monthMap[k].length, events: monthMap[k].slice(0, 5) };
    });

    const built = buildAnnualHub(ANNUAL_YEAR, futureOfYear, annualSectors, annualCities, monthGroups);
    await writeRoute(`/salons-professionnels-${ANNUAL_YEAR}`, applyToShell(baseTemplate, built));
    console.log(`[prerender] annual hub: ${futureOfYear.length} events, ${annualSectors.length} sectors, ${annualCities.length} cities`);
  } catch (e) { errors++; console.warn('[prerender] annual hub failed', e.message); }

  // 7b. exhibitor profiles (/exposants/:slug) — robots READ from seo_indexable
  // and written HARD into the HTML. Generated for every active non-test profile.
  for (const prof of profiles) {
    if (!prof.public_slug) continue;
    try {
      const ids = new Set();
      if (prof.exhibitor_id && eventsByExhibitorId.has(prof.exhibitor_id)) {
        for (const id of eventsByExhibitorId.get(prof.exhibitor_id)) ids.add(id);
      }
      if (prof.legacy_exposant_id && eventsByLegacyId.has(prof.legacy_exposant_id)) {
        for (const id of eventsByLegacyId.get(prof.legacy_exposant_id)) ids.add(id);
      }
      const evList = [...ids].map((id) => eventById.get(id)).filter(Boolean)
        .sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || ''));
      const built = buildExhibitor(prof, evList);
      await writeRoute(`/exposants/${prof.public_slug}`, applyToShell(baseTemplate, built));
      stats.exhibitors++;
      if (prof.seo_indexable === true) stats.exhibitorsIndexable++;
    } catch (e) { errors++; console.warn('[prerender] exhibitor failed', prof.public_slug, e.message); }
  }
  console.log(`[prerender] exhibitors: ${stats.exhibitors} (${stats.exhibitorsIndexable} indexable, ${stats.exhibitors - stats.exhibitorsIndexable} noindex)`);

  // 7c. novelty pages (/nouveautes/:slug) — NON-BLOCKING. Unlike the exhibitor
  // guard (MIN_PROFILES → exit non-zero), a failure or empty fetch here only
  // logs a warning and lets the build continue (exit 0): an outage on ~42
  // novelty pages must never take the whole site down.
  try {
    const noveltyFields = 'slug,title,type,reason_1,reason_2,reason_3,audience_tags,media_urls,summary,details,seo_indexable,exhibitor_public_slug,exhibitor_display_name,event_slug,event_name,event_ville,updated_at';
    const novelties = (await sbPaged(`public_novelties?slug=not.is.null&select=${noveltyFields}&order=updated_at.desc`))
      .filter((n) => n.slug && String(n.slug).trim());
    console.log(`[prerender] novelties fetched: ${novelties.length}`);
    if (!Array.isArray(novelties) || novelties.length === 0) {
      console.warn('[prerender] WARN: 0 novelties fetched — skipping novelty pages (non-blocking, build continues).');
    } else {
      for (const n of novelties) {
        if (!n.slug) continue;
        try {
          const built = buildNovelty(n);
          await writeRoute(`/nouveautes/${n.slug}`, applyToShell(baseTemplate, built));
          stats.novelties++;
          if (n.seo_indexable === true) stats.noveltiesIndexable++;
        } catch (e) { errors++; console.warn('[prerender] novelty failed', n.slug, e.message); }
      }
      console.log(`[prerender] novelties: ${stats.novelties} (${stats.noveltiesIndexable} indexable, ${stats.novelties - stats.noveltiesIndexable} noindex)`);
    }
  } catch (e) {
    // Swallowed on purpose: novelties are non-blocking.
    console.warn('[prerender] WARN: novelty generation errored (non-blocking, build continues):', e.message);
  }

  // 8. home — written LAST so it never pollutes the template
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
  console.log(`Sector×year pages: ${stats.sectorYears}`);
  console.log(`City hubs:         ${stats.cities}`);
  console.log(`City×year pages:   ${stats.cityYears}`);
  console.log(`Exhibitor pages:   ${stats.exhibitors} (${stats.exhibitorsIndexable} index / ${stats.exhibitors - stats.exhibitorsIndexable} noindex)`);
  console.log(`Novelty pages:     ${stats.novelties} (${stats.noveltiesIndexable} index / ${stats.novelties - stats.noveltiesIndexable} noindex)`);
  console.log(`Errors:            ${errors}`);
  console.log(`Duration:          ${dur}s`);
  console.log('=========================\n');
}

main().catch((e) => { console.error('[prerender] fatal', e); process.exit(1); });
