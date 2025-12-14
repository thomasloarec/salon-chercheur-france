import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600', // Cache 1 hour
};

const SITE_URL = 'https://lotexpo.com';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[sitemap] Generating dynamic sitemap.xml');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all visible events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('slug, updated_at, date_debut')
      .eq('visible', true)
      .not('slug', 'is', null)
      .order('date_debut', { ascending: false });

    if (eventsError) {
      console.error('[sitemap] Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`[sitemap] Found ${events?.length || 0} visible events`);

    // Fetch all published novelties
    const { data: novelties, error: noveltiesError } = await supabase
      .from('novelties')
      .select('id, updated_at, events!inner(slug)')
      .eq('status', 'Published');

    if (noveltiesError) {
      console.error('[sitemap] Error fetching novelties:', noveltiesError);
    }

    console.log(`[sitemap] Found ${novelties?.length || 0} published novelties`);

    // Build XML
    const now = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  
  <!-- Static pages -->
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <url>
    <loc>${SITE_URL}/events</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${SITE_URL}/nouveautes</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${SITE_URL}/exposants</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>${SITE_URL}/comment-ca-marche</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  
  <url>
    <loc>${SITE_URL}/mentions-legales</loc>
    <lastmod>${now}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>${SITE_URL}/politique-confidentialite</loc>
    <lastmod>${now}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>${SITE_URL}/cgu</loc>
    <lastmod>${now}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
`;

    // Add event pages
    if (events && events.length > 0) {
      xml += '\n  <!-- Event pages -->\n';
      for (const event of events) {
        if (!event.slug) continue;
        
        const lastmod = event.updated_at 
          ? new Date(event.updated_at).toISOString().split('T')[0]
          : now;
        
        // Determine priority based on event date
        const eventDate = event.date_debut ? new Date(event.date_debut) : null;
        const isUpcoming = eventDate && eventDate >= new Date();
        const priority = isUpcoming ? '0.8' : '0.5';
        const changefreq = isUpcoming ? 'daily' : 'monthly';
        
        xml += `  <url>
    <loc>${SITE_URL}/events/${encodeURIComponent(event.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
`;
      }
    }

    // Add novelty pages (if you have dedicated novelty pages)
    // For now, novelties are part of event pages, so we skip individual URLs

    xml += '</urlset>';

    console.log('[sitemap] Sitemap generated successfully');

    return new Response(xml, {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('[sitemap] Error:', error);
    
    // Return a minimal valid sitemap on error
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(fallbackXml, {
      status: 200,
      headers: corsHeaders,
    });
  }
});
