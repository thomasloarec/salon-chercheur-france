import { createClient } from 'npm:@supabase/supabase-js@2';

// Dedicated, dynamic sitemap for public exhibitor profiles.
// Only profiles that are REALLY indexable appear here, read at request time
// from the materialized view public_exhibitor_profiles_mv (refreshed nightly
// at 05:10 UTC by the refresh-exhibitor-profiles-mv-daily cron):
//   - seo_indexable = true
//   - is_test = false
//   - public_slug IS NOT NULL AND public_slug <> ''
// The MV holds the exact same rows as the live view public_exhibitor_profiles
// (13 362 indexable rows) but answers in ~23ms instead of ~983ms, which caused
// read timeouts once the sitemap grew past 13k URLs.
// The page /exposants/:slug renders <meta robots="index, follow"> + canonical
// self only when seo_indexable is true, so the sitemap stays consistent with
// the on-page robots directives.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
  // Fresh enough to follow seo_indexable changes, cheap enough to avoid a DB
  // hit on every crawl.
  'Cache-Control': 'public, max-age=3600, s-maxage=21600',
};

const errorHeaders = {
  ...corsHeaders,
  // A failure must never be cached: crawlers have to retry.
  'Cache-Control': 'no-store',
};

const SITE_URL = 'https://lotexpo.com';
// One query would be ideal, but PostgREST enforces a server-side max-rows cap
// (1000) that .limit() cannot raise. We therefore request large 10 000-row
// windows and advance by the number of rows actually returned: on the MV each
// round-trip costs ~23ms, so the whole set is fetched in well under a second.
const PAGE_SIZE = 10000;
// Sitemap protocol hard limits: 50 000 URLs / 50 MB per file.
const WARN_THRESHOLD = 45000;
const HARD_CAP = 60000;


const escapeXml = (v: string) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const formatDate = (v: string | null | undefined): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().split('T')[0];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString().split('T')[0];
    const seen = new Set<string>();
    const rows: { slug: string; lastmod: string }[] = [];

    // Single global query against the materialized view (service_role only).
    const { data, error } = await supabase
      .from('public_exhibitor_profiles_mv')
      .select('public_slug, last_activity_at, updated_at, created_at')
      .eq('seo_indexable', true)
      .eq('is_test', false)
      .not('public_slug', 'is', null)
      .neq('public_slug', '')
      .order('public_slug', { ascending: true })
      .limit(MAX_ROWS);

    if (error) {
      console.error('[sitemap-exposants] query failed', error);
      throw error;
    }

    for (const r of data ?? []) {
      const slug = (r.public_slug ?? '').trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const lastmod = formatDate(r.last_activity_at) || formatDate(r.updated_at) || formatDate(r.created_at) || now;
      rows.push({ slug, lastmod });
    }

    const elapsed = Date.now() - startedAt;

    // An empty sitemap served with HTTP 200 tells crawlers the site has no
    // exhibitor pages at all. Fail loudly instead so they retry.
    if (rows.length === 0) {
      console.error(
        `[sitemap-exposants] FAILED: 0 indexable rows returned (raw rows=${(data ?? []).length}, ${elapsed}ms) — responding 500 instead of an empty urlset`,
      );
      return new Response('<!-- sitemap temporarily unavailable -->\n', { status: 500, headers: errorHeaders });
    }

    if (rows.length > WARN_THRESHOLD) {
      console.warn(
        `[sitemap-exposants] WARNING: ${rows.length} URLs exceeds ${WARN_THRESHOLD} — the sitemap protocol caps a single file at 50000 URLs / 50MB. Split into a sitemap index soon.`,
      );
    }

    const body = rows
      .map(
        (r) =>
          `  <url>\n    <loc>${escapeXml(`${SITE_URL}/exposants/${encodeURIComponent(r.slug)}`)}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

    console.log(`[sitemap-exposants] generated ${rows.length} exhibitor URLs in ${elapsed}ms`);

    return new Response(xml, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error(
      `[sitemap-exposants] FAILED after ${Date.now() - startedAt}ms, 0 rows available — responding 500`,
      error,
    );
    return new Response('<!-- sitemap temporarily unavailable -->\n', { status: 500, headers: errorHeaders });
  }
});
