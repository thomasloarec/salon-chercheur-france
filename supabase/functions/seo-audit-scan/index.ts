import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = 'https://lotexpo.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: admin } = await userClient.rpc('is_admin');
    if (!admin) throw new Error('Admin only');

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { phase, scanId } = await req.json();

    let results: Record<string, unknown> = {};

    switch (phase) {
      case 'crawlability':
        results = await analyzeCrawlability(adminClient);
        break;
      case 'onpage':
        results = await analyzeOnPage(adminClient);
        break;
      case 'schema':
        results = await analyzeSchema(adminClient);
        break;
      case 'urls':
        results = await analyzeUrls(adminClient);
        break;
      case 'linking':
        results = await analyzeLinking(adminClient);
        break;
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }

    if (scanId) {
      const { data: scan } = await adminClient
        .from('seo_scans')
        .select('results')
        .eq('id', scanId)
        .single();

      await adminClient
        .from('seo_scans')
        .update({
          results: { ...((scan?.results as Record<string, unknown>) || {}), [phase]: results },
          phase,
        })
        .eq('id', scanId);
    }

    return new Response(JSON.stringify({ success: true, phase, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: message === 'Unauthorized' || message === 'Admin only' ? 403 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function safeFetch(url: string, timeout = 10000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

async function analyzeCrawlability(supabase: ReturnType<typeof createClient>) {
  // robots.txt
  const robotsIssues: string[] = [];
  let robotsExists = false;
  let robotsContent = '';
  const robotsRes = await safeFetch(`${SITE_URL}/robots.txt`);
  if (robotsRes?.ok) {
    robotsExists = true;
    robotsContent = await robotsRes.text();
    for (const line of robotsContent.split('\n')) {
      const lower = line.toLowerCase().trim();
      if (lower.startsWith('disallow:')) {
        const path = lower.replace('disallow:', '').trim();
        if (['/salons', '/events/', '/articles', '/blog/', '/exposants', '/nouveautes'].some(p => path.includes(p))) {
          robotsIssues.push(`Chemin bloqué : ${path}`);
        }
      }
    }
  } else {
    robotsIssues.push('robots.txt introuvable');
  }

  // Sitemap
  const sitemapIssues: string[] = [];
  let sitemapExists = false;
  let sitemapUrlCount = 0;
  const sitemapUrls: string[] = [];
  const sitemapRes = await safeFetch(`${SITE_URL}/sitemap.xml`);
  if (sitemapRes?.ok) {
    sitemapExists = true;
    const content = await sitemapRes.text();
    const urlMatches = content.match(/<loc>(.*?)<\/loc>/g) || [];
    const allParsedUrls = urlMatches.map(m => m.replace(/<\/?loc>/g, ''));
    sitemapUrls.push(...allParsedUrls.slice(0, 200));
    sitemapUrlCount = allParsedUrls.length;

    // Check against ALL parsed URLs, not just the truncated preview list
    const hasEvents = allParsedUrls.some(u => u.includes('/events/'));
    const hasBlog = allParsedUrls.some(u => u.includes('/blog/'));
    const hasSectorHubs = allParsedUrls.some(u => u.includes('/secteur/'));
    const hasCityHubs = allParsedUrls.some(u => u.includes('/ville/'));
    if (!hasEvents) sitemapIssues.push('Aucune page salon dans le sitemap');
    if (!hasBlog) sitemapIssues.push('Aucun article blog dans le sitemap');
    if (!hasSectorHubs) sitemapIssues.push('Aucune page hub secteur dans le sitemap');
    if (!hasCityHubs) sitemapIssues.push('Aucune page hub ville dans le sitemap');
  } else {
    sitemapIssues.push('sitemap.xml introuvable');
  }

  // DB counts
  const { count: eventsCount } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('visible', true).eq('is_test', false);
  const { count: articlesCount } = await supabase.from('blog_articles').select('id', { count: 'exact', head: true }).in('status', ['published', 'ready']);
  const { count: exhibitorsCount } = await supabase.from('exhibitors').select('id', { count: 'exact', head: true }).eq('is_test', false);

  const totalExpected = (eventsCount || 0) + (articlesCount || 0) + 5;

  return {
    robotsTxt: { exists: robotsExists, content: robotsContent.slice(0, 2000), issues: robotsIssues },
    sitemap: { exists: sitemapExists, urlCount: sitemapUrlCount, urls: sitemapUrls.slice(0, 50), issues: sitemapIssues },
    dbCounts: { events: eventsCount || 0, articles: articlesCount || 0, exhibitors: exhibitorsCount || 0, totalExpected },
    sitemapCoverage: sitemapUrlCount > 0 ? {
      inSitemap: sitemapUrlCount,
      expectedTotal: totalExpected,
      ratio: Math.round((sitemapUrlCount / totalExpected) * 100),
    } : null,
  };
}

async function analyzeOnPage(supabase: ReturnType<typeof createClient>) {
  const { data: events } = await supabase.from('events')
    .select('id, nom_event, slug, description_event, ville, type_event, url_image, url_site_officiel')
    .eq('visible', true).eq('is_test', false).order('date_debut', { ascending: false }).limit(10);

  const eventAudit = (events || []).map((e: Record<string, unknown>) => {
    const desc = (e.description_event as string) || '';
    const wordCount = desc.split(/\s+/).filter(Boolean).length;
    const name = (e.nom_event as string) || '';
    return {
      url: `/events/${e.slug}`,
      name,
      titleLength: name.length,
      titleOk: name.length >= 20 && name.length <= 65,
      hasDescription: !!desc,
      descWordCount: wordCount,
      isThinContent: wordCount < 300,
      hasImage: !!e.url_image,
      hasOfficialUrl: !!e.url_site_officiel,
      hasSlug: !!e.slug,
      hasCity: !!e.ville,
    };
  });

  const { data: articles } = await supabase.from('blog_articles')
    .select('id, title, slug, meta_title, meta_description, body_text, h1_title, intro_text, why_visit_text')
    .in('status', ['published', 'ready']).limit(10);

  const articleAudit = (articles || []).map((a: Record<string, unknown>) => {
    const body = `${a.body_text || ''} ${a.intro_text || ''} ${a.why_visit_text || ''}`;
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const metaDesc = (a.meta_description as string) || '';
    return {
      url: `/blog/${a.slug}`,
      name: a.title as string,
      hasMetaTitle: !!a.meta_title,
      metaTitleLength: ((a.meta_title || a.title) as string || '').length,
      metaTitleOk: ((a.meta_title || a.title) as string || '').length >= 40 && ((a.meta_title || a.title) as string || '').length <= 65,
      hasMetaDesc: !!metaDesc,
      metaDescLength: metaDesc.length,
      metaDescOk: metaDesc.length >= 120 && metaDesc.length <= 160,
      hasH1: !!a.h1_title,
      h1DiffFromTitle: a.h1_title !== a.title,
      wordCount,
      isThinContent: wordCount < 300,
    };
  });

  const allPages = [...eventAudit, ...articleAudit];
  return {
    events: eventAudit,
    articles: articleAudit,
    summary: {
      totalAnalyzed: allPages.length,
      passingAll: allPages.filter(p => !p.isThinContent).length,
      thinContentCount: allPages.filter(p => p.isThinContent).length,
    },
  };
}

async function analyzeSchema(supabase: ReturnType<typeof createClient>) {
  const { data: events } = await supabase.from('events')
    .select('id, nom_event, slug, date_debut, date_fin, ville, nom_lieu, description_event')
    .eq('visible', true).eq('is_test', false).limit(10);

  const eventSchema = (events || []).map((e: Record<string, unknown>) => ({
    url: `/events/${e.slug}`,
    name: e.nom_event as string,
    hasName: !!e.nom_event,
    hasStartDate: !!e.date_debut,
    hasEndDate: !!e.date_fin,
    hasLocation: !!e.ville || !!e.nom_lieu,
    hasDescription: !!e.description_event,
    schemaComplete: !!e.nom_event && !!e.date_debut && !!e.date_fin && (!!e.ville || !!e.nom_lieu),
  }));

  const { data: articles } = await supabase.from('blog_articles')
    .select('id, title, slug, meta_description, published_at')
    .in('status', ['published', 'ready']).limit(10);

  const articleSchema = (articles || []).map((a: Record<string, unknown>) => ({
    url: `/blog/${a.slug}`,
    name: a.title as string,
    hasHeadline: !!a.title,
    hasDatePublished: !!a.published_at,
    hasDescription: !!a.meta_description,
    schemaComplete: !!a.title && !!a.published_at,
  }));

  const evtPct = eventSchema.length ? Math.round(eventSchema.filter(e => e.schemaComplete).length / eventSchema.length * 100) : 0;
  const artPct = articleSchema.length ? Math.round(articleSchema.filter(a => a.schemaComplete).length / articleSchema.length * 100) : 0;

  return {
    events: eventSchema,
    articles: articleSchema,
    coverage: { eventSchemaPercent: evtPct, articleSchemaPercent: artPct },
  };
}

async function analyzeUrls(supabase: ReturnType<typeof createClient>) {
  const { data: events } = await supabase.from('events')
    .select('slug, nom_event, ville').eq('visible', true).eq('is_test', false).limit(50);

  const { data: articles } = await supabase.from('blog_articles')
    .select('slug, title').in('status', ['published', 'ready']).limit(20);

  const allUrls = [
    ...(events || []).map((e: Record<string, unknown>) => ({ url: `/events/${e.slug}`, name: e.nom_event as string, type: 'event' })),
    ...(articles || []).map((a: Record<string, unknown>) => ({ url: `/blog/${a.slug}`, name: a.title as string, type: 'article' })),
  ];

  const urlAudit = allUrls.map(item => ({
    ...item,
    hasUnderscore: item.url.includes('_'),
    isLong: item.url.length > 100,
    hasDynamicParams: item.url.includes('?'),
    isDescriptive: (item.url.split('/').pop() || '').length > 3,
    length: item.url.length,
  }));

  const { data: sectors } = await supabase.from('sectors' as string).select('id, name, slug');

  // Check thin content events
  const { data: thinEvents } = await supabase.from('events')
    .select('slug, nom_event, description_event')
    .eq('visible', true).eq('is_test', false)
    .order('created_at', { ascending: false }).limit(50);

  const thinContent = (thinEvents || [])
    .filter((e: Record<string, unknown>) => {
      const wc = ((e.description_event as string) || '').split(/\s+/).filter(Boolean).length;
      return wc < 300;
    })
    .map((e: Record<string, unknown>) => ({
      url: `/events/${e.slug}`,
      name: e.nom_event as string,
      wordCount: ((e.description_event as string) || '').split(/\s+/).filter(Boolean).length,
    }))
    .sort((a: { wordCount: number }, b: { wordCount: number }) => a.wordCount - b.wordCount);

  // Dynamically detect hub pages by checking sitemap
  let hasSectorPages = false;
  let hasCityPages = false;
  const sectorHubCount = { total: 0 };
  const cityHubCount = { total: 0 };

  try {
    const sitemapRes = await safeFetch(`${SITE_URL}/sitemap.xml`);
    if (sitemapRes?.ok) {
      const content = await sitemapRes.text();
      const locMatches = content.match(/<loc>(.*?)<\/loc>/g) || [];
      const urls = locMatches.map(m => m.replace(/<\/?loc>/g, ''));
      const sectorUrls = urls.filter(u => u.includes('/secteur/'));
      const cityUrls = urls.filter(u => u.includes('/ville/'));
      hasSectorPages = sectorUrls.length > 0;
      hasCityPages = cityUrls.length > 0;
      sectorHubCount.total = sectorUrls.length;
      cityHubCount.total = cityUrls.length;
    }
  } catch { /* ignore */ }

  // Count unique cities with enough events
  const cityCount: Record<string, number> = {};
  for (const e of (events || []) as Record<string, unknown>[]) {
    const v = e.ville as string;
    if (v) cityCount[v] = (cityCount[v] || 0) + 1;
  }
  const eligibleCities = Object.entries(cityCount).filter(([, c]) => c >= 3).length;

  return {
    urls: urlAudit,
    summary: {
      total: urlAudit.length,
      withIssues: urlAudit.filter(u => u.hasUnderscore || u.isLong || u.hasDynamicParams || !u.isDescriptive).length,
      underscoreCount: urlAudit.filter(u => u.hasUnderscore).length,
      longCount: urlAudit.filter(u => u.isLong).length,
    },
    contentGaps: {
      sectors: (sectors || []).map((s: Record<string, unknown>) => ({ name: s.name, slug: s.slug })),
      hasSectorPages,
      hasYearPages: false,
      hasCityPages,
      sectorHubRoute: '/secteur/:slug',
      cityHubRoute: '/ville/:slug',
      sectorHubsInSitemap: sectorHubCount.total,
      cityHubsInSitemap: cityHubCount.total,
      eligibleCities,
    },
    thinContent,
  };
}

async function analyzeLinking(supabase: ReturnType<typeof createClient>) {
  const { data: articles } = await supabase.from('blog_articles')
    .select('id, slug, title, event_ids')
    .in('status', ['published', 'ready'])
    .not('slug', 'is', null)
    .limit(30);

  const { count: eventsCount } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('visible', true).eq('is_test', false);

  const articleRows = (articles || []) as Record<string, unknown>[];

  const withEventLinks = articleRows.filter((a) => {
    const ids = a.event_ids as unknown[];
    return Array.isArray(ids) && ids.length > 0;
  });

  // Important: blog_articles.body_text is no longer used by the frontend.
  // Internal links are rendered dynamically in the final HTML from event_ids and related article blocks.
  const articleHtmlChecks = await Promise.all(articleRows.map(async (a) => {
    const slug = a.slug as string | null;
    if (!slug) {
      return { slug: null, hasInternalLinks: false, matchedPatterns: [] as string[] };
    }

    const res = await safeFetch(`${SITE_URL}/blog/${slug}`, 15000);
    if (!res?.ok) {
      return { slug, hasInternalLinks: false, matchedPatterns: [] as string[] };
    }

    const html = await res.text();
    const checks = [
      { name: 'eventLinks', pattern: /href=["'][^"']*\/events\/[^"']+["']/i },
      { name: 'blogLinks', pattern: /href=["'][^"']*\/blog\/[^"']+["']/i },
      { name: 'sectorHubLinks', pattern: /href=["'][^"']*\/secteur\/[^"']+["']/i },
      { name: 'cityHubLinks', pattern: /href=["'][^"']*\/ville\/[^"']+["']/i },
      { name: 'absoluteInternalLinks', pattern: /href=["']https:\/\/lotexpo\.com\/[^"]+["']/i },
    ];

    const matchedPatterns = checks.filter(check => check.pattern.test(html)).map(check => check.name);
    return {
      slug,
      hasInternalLinks: matchedPatterns.length > 0,
      matchedPatterns,
    };
  }));

  const withInternalLinks = articleHtmlChecks.filter((a) => a.hasInternalLinks);
  const totalArticles = articleRows.length;

  return {
    articles: articleHtmlChecks,
    summary: {
      totalEvents: eventsCount || 0,
      totalArticles,
      articlesLinkingToEvents: withEventLinks.length,
      articlesLinkingPercentage: totalArticles > 0 ? Math.round(withEventLinks.length / totalArticles * 100) : 0,
      articlesWithInternalLinks: withInternalLinks.length,
      internalLinksPercentage: totalArticles > 0 ? Math.round(withInternalLinks.length / totalArticles * 100) : 0,
    },
  };
}
