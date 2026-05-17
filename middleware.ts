// Vercel Edge Middleware — SEO prerender for public Lotexpo routes.
// Runs at the edge, fetches the static index.html, then injects head tags
// (title / description / canonical / OG / JSON-LD) and a static body block
// (#seo-prerender) with real content fetched from Supabase REST (anon key only).
//
// IMPORTANT:
//  - No service_role key here. Only SUPABASE_URL + SUPABASE_ANON_KEY (public).
//  - All Supabase requests honor RLS.
//  - Visual rendering is unchanged: #seo-prerender is hidden visually by CSS
//    once React hydrates and renders equivalent content. Same HTML is served
//    to all visitors (no cloaking).
//  - Toggle with env SEO_EDGE_ENABLED=false to fall back to current behavior.

export const config = {
  // Exclude assets, API, auth & private app routes. SPA + SEO routes pass through.
  matcher: [
    '/((?!_next|_vercel|api|assets|logos|favicon|admin|auth|profile|agenda|notifications|favorites|crm-integrations|.*\\.(?:js|css|png|jpe?g|svg|gif|webp|avif|ico|xml|txt|map|woff2?|ttf|otf|json)).*)',
  ],
};

const SUPABASE_URL =
  (globalThis as any).process?.env?.SUPABASE_URL ||
  (globalThis as any).process?.env?.VITE_SUPABASE_URL ||
  'https://vxivdvzzhebobveedxbj.supabase.co';
const SUPABASE_ANON_KEY =
  (globalThis as any).process?.env?.SUPABASE_ANON_KEY ||
  (globalThis as any).process?.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aXZkdnp6aGVib2J2ZWVkeGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTY5NTEsImV4cCI6MjA2NDc5Mjk1MX0.s1P0Hj1u1g1BtAczv_gkippD9wTwkUj2pwxKchkZ8Hw';
const SEO_EDGE_ENABLED =
  ((globalThis as any).process?.env?.SEO_EDGE_ENABLED ?? 'true') !== 'false';

const SITE_ORIGIN = 'https://lotexpo.com';

// ---------- helpers ----------

function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(s: unknown): string {
  if (!s) return '';
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n).trimEnd() + '…';
}

function safeJsonLd(obj: unknown): string {
  // Escape </script and U+2028/U+2029 to prevent script breakout.
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function sb<T = any>(path: string): Promise<T[] | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
      // Edge cache: 1h fresh, 24h SWR
      cf: { cacheTtl: 3600 } as any,
    });
    if (!res.ok) {
      console.warn('[seo-edge] supabase non-200', path, res.status);
      return null;
    }
    return (await res.json()) as T[];
  } catch (e) {
    console.warn('[seo-edge] supabase fetch failed', path, (e as Error).message);
    return null;
  }
}

function firstSector(secteur: unknown): string | null {
  if (!secteur) return null;
  if (Array.isArray(secteur)) return secteur[0] ? String(secteur[0]) : null;
  if (typeof secteur === 'string') {
    try {
      const j = JSON.parse(secteur);
      if (Array.isArray(j) && j[0]) return String(j[0]);
    } catch {}
    return secteur;
  }
  return null;
}

function fmtDateRange(start?: string, end?: string): string {
  const f = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const s = f(start);
  const e = f(end);
  if (s && e && s !== e) return `${s} au ${e}`;
  return s || e || '';
}

// ---------- HTML injection ----------

const HIDE_CSS = `<style id="seo-prerender-style">#seo-prerender{position:absolute;left:-99999px;top:auto;width:1px;height:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);clip-path:inset(50%);white-space:nowrap}</style>`;

function injectIntoHead(html: string, headInject: string): string {
  return html.replace(/<\/head>/i, `${headInject}\n${HIDE_CSS}\n</head>`);
}

function injectBeforeRoot(html: string, bodyInject: string): string {
  if (html.includes('<div id="root">')) {
    return html.replace('<div id="root">', `${bodyInject}\n<div id="root">`);
  }
  return html.replace(/<body([^>]*)>/i, `<body$1>\n${bodyInject}\n`);
}

function rewriteTitleAndDesc(html: string, title: string, desc: string): string {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(desc)}" />`,
  );
  // og:title / og:description / og:url replacements happen via additional head inject
  return out;
}

// ---------- route handlers ----------

interface BuildResult {
  title: string;
  description: string;
  canonical: string;
  headExtra: string;
  body: string;
}

function commonHead(canonical: string, title: string, desc: string, ogImage?: string): string {
  const og = `
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
  return og;
}

async function buildEventPage(slug: string): Promise<BuildResult | null> {
  const fields =
    'id,nom_event,slug,ville,nom_lieu,date_debut,date_fin,secteur,description_event,meta_description_gen,url_image,updated_at,url_site_officiel';
  const events = await sb<any>(
    `events?slug=eq.${encodeURIComponent(slug)}&visible=eq.true&is_test=eq.false&select=${fields}&limit=1`,
  );
  if (!events || events.length === 0) return null;
  const ev = events[0];

  const year = ev.date_debut ? new Date(ev.date_debut).getFullYear() : new Date().getFullYear();
  const city = ev.ville || 'France';
  const title = truncate(`${ev.nom_event} ${year} | Salon professionnel à ${city} – Lotexpo`, 70);

  const cleanDesc = stripHtml(ev.description_event);
  let description: string;
  if (ev.meta_description_gen) {
    description = truncate(String(ev.meta_description_gen), 160);
  } else if (cleanDesc) {
    description = truncate(cleanDesc, 160);
  } else {
    description = `Retrouvez les informations clés sur ${ev.nom_event}, salon professionnel organisé à ${city}, sur Lotexpo.`;
  }

  const canonical = `${SITE_ORIGIN}/events/${ev.slug}`;
  const sector = firstSector(ev.secteur);
  const sectorSlug = sector ? slugify(sector) : null;
  const citySlug = ev.ville ? slugify(ev.ville) : null;

  // Exhibitors (best-effort; non-blocking on failure)
  let exhibitors: { name: string; website?: string }[] = [];
  const parts = await sb<any>(
    `participations_with_exhibitors?id_event=eq.${encodeURIComponent(ev.id)}&select=name_final,exhibitor_name,legacy_name,website_final,website_exposant&limit=20`,
  );
  if (parts && parts.length > 0) {
    exhibitors = parts
      .map((p) => ({
        name: p.name_final || p.exhibitor_name || p.legacy_name || '',
        website: p.website_final || p.website_exposant || undefined,
      }))
      .filter((p) => p.name && p.name.trim().length > 1);
  }

  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.nom_event,
    startDate: ev.date_debut || undefined,
    endDate: ev.date_fin || undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: ev.nom_lieu || ev.ville || 'France',
      address: { '@type': 'PostalAddress', addressLocality: ev.ville, addressCountry: 'FR' },
    },
    description: cleanDesc ? truncate(cleanDesc, 500) : description,
    image: ev.url_image || undefined,
    url: canonical,
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Salons', item: `${SITE_ORIGIN}/events` },
      { '@type': 'ListItem', position: 3, name: ev.nom_event, item: canonical },
    ],
  };

  const headExtra =
    commonHead(canonical, title, description, ev.url_image) +
    `<script type="application/ld+json">${safeJsonLd(eventSchema)}</script>` +
    `<script type="application/ld+json">${safeJsonLd(breadcrumb)}</script>`;

  const dateLine = fmtDateRange(ev.date_debut, ev.date_fin);
  const bodyDesc = truncate(cleanDesc || String(ev.meta_description_gen || ''), 300);

  const exhibitorsBlock =
    exhibitors.length > 0
      ? `<section><h2>Entreprises exposantes référencées</h2>
          <p>Lotexpo recense actuellement ${exhibitors.length} entreprise${exhibitors.length > 1 ? 's' : ''} associée${exhibitors.length > 1 ? 's' : ''} à cet événement.</p>
          <ul>${exhibitors.map((e) => `<li>${escapeHtml(e.name)}</li>`).join('')}</ul>
        </section>`
      : '';

  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>${escapeHtml(ev.nom_event)} ${escapeHtml(String(year))} – ${escapeHtml(city)}</h1>
    ${bodyDesc ? `<p>${escapeHtml(bodyDesc)}</p>` : ''}
    ${dateLine ? `<p>Dates : ${escapeHtml(dateLine)}${ev.nom_lieu ? ' – ' + escapeHtml(ev.nom_lieu) : ''}${ev.ville ? ', ' + escapeHtml(ev.ville) : ''}</p>` : ''}
    ${sectorSlug ? `<p><a href="/secteur/${encodeURIComponent(sectorSlug)}">Voir les salons ${escapeHtml(sector!)}</a></p>` : ''}
    ${citySlug ? `<p><a href="/ville/${encodeURIComponent(citySlug)}">Voir les salons professionnels à ${escapeHtml(ev.ville)}</a></p>` : ''}
    ${exhibitorsBlock}
  </div>`;

  return { title, description, canonical, headExtra, body };
}

async function buildSectorPage(slug: string): Promise<BuildResult | null> {
  const today = new Date().toISOString().slice(0, 10);
  const events = await sb<any>(
    `events?visible=eq.true&is_test=eq.false&date_fin=gte.${today}&select=nom_event,slug,ville,date_debut,date_fin,secteur&order=date_debut.asc&limit=200`,
  );
  if (!events) return null;
  const matching = events.filter((e) => {
    const sec = e.secteur;
    const list = Array.isArray(sec) ? sec : (typeof sec === 'string' ? [sec] : []);
    return list.some((s: string) => slugify(String(s)) === slug);
  });
  const sectorLabel = matching[0] ? firstSector(matching[0].secteur) || slug : slug.replace(/-/g, ' ');
  const title = truncate(`Salons ${sectorLabel} en France | Lotexpo`, 70);
  const description = truncate(
    `Découvrez les salons professionnels du secteur ${sectorLabel} en France : ${matching.length} événement${matching.length > 1 ? 's' : ''} à venir, dates, lieux et exposants sur Lotexpo.`,
    160,
  );
  const canonical = `${SITE_ORIGIN}/secteur/${slug}`;
  const top = matching.slice(0, 5);
  const headExtra = commonHead(canonical, title, description);
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons ${escapeHtml(String(sectorLabel))} en France</h1>
    <p>Lotexpo référence ${matching.length} salon${matching.length > 1 ? 's' : ''} professionnel${matching.length > 1 ? 's' : ''} à venir dans le secteur ${escapeHtml(String(sectorLabel))}.</p>
    <ul>${top.map((e) => `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.ville ? ' – ' + escapeHtml(e.ville) : ''}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

async function buildCityPage(slug: string): Promise<BuildResult | null> {
  const today = new Date().toISOString().slice(0, 10);
  const events = await sb<any>(
    `events?visible=eq.true&is_test=eq.false&date_fin=gte.${today}&select=nom_event,slug,ville,date_debut,date_fin&order=date_debut.asc&limit=200`,
  );
  if (!events) return null;
  const matching = events.filter((e) => e.ville && slugify(e.ville) === slug);
  const cityLabel = matching[0]?.ville || slug.replace(/-/g, ' ');
  const title = truncate(`Salons professionnels à ${cityLabel} | Lotexpo`, 70);
  const description = truncate(
    `Tous les salons professionnels organisés à ${cityLabel} : ${matching.length} événement${matching.length > 1 ? 's' : ''} à venir, dates, secteurs et exposants sur Lotexpo.`,
    160,
  );
  const canonical = `${SITE_ORIGIN}/ville/${slug}`;
  const top = matching.slice(0, 5);
  const headExtra = commonHead(canonical, title, description);
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Salons professionnels à ${escapeHtml(String(cityLabel))}</h1>
    <p>Lotexpo recense ${matching.length} salon${matching.length > 1 ? 's' : ''} professionnel${matching.length > 1 ? 's' : ''} à venir à ${escapeHtml(String(cityLabel))}.</p>
    <ul>${top.map((e) => `<li><a href="/events/${encodeURIComponent(e.slug)}">${escapeHtml(e.nom_event)}${e.date_debut ? ' – ' + escapeHtml(fmtDateRange(e.date_debut, e.date_fin)) : ''}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

async function buildBlogIndex(): Promise<BuildResult> {
  const canonical = `${SITE_ORIGIN}/blog`;
  const title = 'Blog Lotexpo – Salons professionnels, secteurs & exposants';
  const description =
    'Articles, guides et analyses sur les salons professionnels en France : secteurs porteurs, calendriers, exposants à suivre et tendances B2B.';
  const articles =
    (await sb<any>(
      `blog_articles?status=eq.published&select=title,slug,intro_text,published_at&order=published_at.desc&limit=10`,
    )) || [];
  const headExtra = commonHead(canonical, title, description);
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Blog Lotexpo</h1>
    <p>${escapeHtml(description)}</p>
    <ul>${articles.map((a) => `<li><a href="/blog/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a></li>`).join('')}</ul>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

async function buildBlogArticle(slug: string): Promise<BuildResult | null> {
  const rows = await sb<any>(
    `blog_articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=title,h1_title,slug,meta_title,meta_description,intro_text,header_image_url,published_at,updated_at&limit=1`,
  );
  if (!rows || rows.length === 0) return null;
  const a = rows[0];
  const title = truncate(a.meta_title || `${a.title} | Lotexpo`, 70);
  const description = truncate(
    a.meta_description || stripHtml(a.intro_text) || `Article Lotexpo : ${a.title}.`,
    160,
  );
  const canonical = `${SITE_ORIGIN}/blog/${a.slug}`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.h1_title || a.title,
    datePublished: a.published_at || undefined,
    dateModified: a.updated_at || a.published_at || undefined,
    image: a.header_image_url || undefined,
    url: canonical,
    publisher: { '@type': 'Organization', name: 'Lotexpo', url: SITE_ORIGIN },
  };
  const headExtra =
    commonHead(canonical, title, description, a.header_image_url) +
    `<script type="application/ld+json">${safeJsonLd(articleSchema)}</script>`;
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>${escapeHtml(a.h1_title || a.title)}</h1>
    <p>${escapeHtml(truncate(stripHtml(a.intro_text), 300))}</p>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

function buildHome(): BuildResult {
  const canonical = `${SITE_ORIGIN}/`;
  const title = 'Lotexpo | Tous les salons professionnels en France';
  const description =
    'Lotexpo centralise les salons professionnels, congrès, conventions et événements B2B en France. Identifiez les événements par secteur, ville et date, puis repérez les exposants associés.';
  const headExtra = commonHead(canonical, title, description);
  const body = `<div id="seo-prerender" class="seo-prerender-fallback">
    <h1>Tous les salons professionnels en France</h1>
    <p>Lotexpo centralise les salons professionnels, congrès, conventions et événements B2B organisés en France. La plateforme permet d'identifier rapidement les événements à venir par secteur, ville, date et type de salon, puis de repérer les exposants associés lorsqu'ils sont disponibles.</p>
    <p><a href="/events">Voir tous les salons à venir</a></p>
  </div>`;
  return { title, description, canonical, headExtra, body };
}

// ---------- route dispatch ----------

async function routeBuilder(pathname: string): Promise<BuildResult | null> {
  if (pathname === '/' || pathname === '') return buildHome();

  let m: RegExpMatchArray | null;
  if ((m = pathname.match(/^\/events\/([^\/]+)\/?$/))) return buildEventPage(decodeURIComponent(m[1]));
  if ((m = pathname.match(/^\/secteur\/([^\/]+)\/?$/))) return buildSectorPage(decodeURIComponent(m[1]));
  if ((m = pathname.match(/^\/ville\/([^\/]+)\/?$/))) return buildCityPage(decodeURIComponent(m[1]));
  if (pathname === '/blog' || pathname === '/blog/') return buildBlogIndex();
  if ((m = pathname.match(/^\/blog\/([^\/]+)\/?$/))) return buildBlogArticle(decodeURIComponent(m[1]));

  return null;
}

// ---------- middleware entry ----------

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Pass-through when disabled
  if (!SEO_EDGE_ENABLED) {
    console.log('[seo-edge] disabled, passthrough', pathname);
    return fetch(req);
  }

  const builder = await routeBuilder(pathname).catch((e) => {
    console.warn('[seo-edge] builder threw', pathname, (e as Error).message);
    return null;
  });

  if (!builder) {
    // Not a SEO-eligible route, let Vercel serve normally
    return fetch(req);
  }

  // Fetch the static SPA shell from same origin
  let shell: string;
  try {
    const shellRes = await fetch(`${url.origin}/index.html`, {
      headers: { 'x-seo-edge-bypass': '1' },
    });
    if (!shellRes.ok) {
      console.warn('[seo-edge] shell fetch failed', shellRes.status, pathname);
      return fetch(req);
    }
    shell = await shellRes.text();
  } catch (e) {
    console.warn('[seo-edge] shell fetch threw', (e as Error).message);
    return fetch(req);
  }

  let html = shell;
  html = rewriteTitleAndDesc(html, builder.title, builder.description);
  html = injectIntoHead(html, builder.headExtra);
  html = injectBeforeRoot(html, builder.body);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'x-seo-edge': 'hit',
    },
  });
}
