import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Dedicated, dynamic sitemap for public exhibitor profiles.
// Only profiles that are REALLY indexable appear here, recomputed at request
// time from the public_exhibitor_profiles view:
//   - seo_indexable = true
//   - is_test = false
//   - public_slug IS NOT NULL AND public_slug <> ''
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

const SITE_URL = 'https://lotexpo.com';
const PAGE_SIZE = 1000; // Supabase max_rows

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString().split('T')[0];
    const seen = new Set<string>();
    const rows: { slug: string; lastmod: string }[] = [];

    // Paginate beyond the 1000-row API limit.
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('public_exhibitor_profiles')
        .select('public_slug, last_activity_at, updated_at, created_at')
        .eq('seo_indexable', true)
        .eq('is_test', false)
        .not('public_slug', 'is', null)
        .neq('public_slug', '')
        .order('public_slug', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('[sitemap-exposants] query failed', error);
        throw error;
      }
      const batch = data ?? [];
      for (const r of batch) {
        const slug = (r.public_slug ?? '').trim();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        const lastmod = formatDate(r.last_activity_at) || formatDate(r.updated_at) || formatDate(r.created_at) || now;
        rows.push({ slug, lastmod });
      }
      if (batch.length < PAGE_SIZE) break;
    }

    const body = rows
      .map(
        (r) =>
          `  <url>\n    <loc>${escapeXml(`${SITE_URL}/exposants/${encodeURIComponent(r.slug)}`)}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

    console.log(`[sitemap-exposants] generated ${rows.length} exhibitor URLs`);

    return new Response(xml, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[sitemap-exposants] error', error);
    // Minimal valid (empty) urlset on error — never break crawlers.
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
    return new Response(fallback, { status: 200, headers: corsHeaders });
  }
});