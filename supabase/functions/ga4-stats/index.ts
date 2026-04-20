// Edge Function: ga4-stats
// Récupère les métriques GA4 (visiteurs uniques, pages vues, sessions)
// pour les 7 derniers jours via OAuth refresh token (user-based auth).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const PROPERTY_ID = Deno.env.get('GA4_PROPERTY_ID');
const CLIENT_ID = Deno.env.get('GA4_OAUTH_CLIENT_ID');
const CLIENT_SECRET = Deno.env.get('GA4_OAUTH_CLIENT_SECRET');
const REFRESH_TOKEN = Deno.env.get('GA4_OAUTH_REFRESH_TOKEN');

// Cache mémoire de l'access token (TTL 50 min, GA renvoie 1h)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    refresh_token: REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth token refresh failed (${res.status}): ${txt}`);
  }

  const data = await res.json();
  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() - 600_000 + expiresInMs, // marge sécurité 10 min
  };
  return cachedToken.token;
}

async function runReport(accessToken: string, body: unknown) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GA4 runReport failed (${res.status}): ${txt}`);
  }
  return res.json();
}

function aggregateMetrics(report: any): number[] {
  // Retourne [activeUsers, screenPageViews, sessions]
  const row = report?.rows?.[0]?.metricValues ?? [];
  return [
    Number(row[0]?.value ?? 0),
    Number(row[1]?.value ?? 0),
    Number(row[2]?.value ?? 0),
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!PROPERTY_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      return new Response(
        JSON.stringify({
          error: 'Missing GA4 configuration secrets',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const accessToken = await getAccessToken();

    const metrics = [
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
      { name: 'sessions' },
    ];

    // Période courante : 7 derniers jours (J-7 → hier)
    const currentBody = {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
      metrics,
    };
    // Période précédente : J-14 → J-8
    const previousBody = {
      dateRanges: [{ startDate: '14daysAgo', endDate: '8daysAgo' }],
      metrics,
    };

    const [currentReport, previousReport] = await Promise.all([
      runReport(accessToken, currentBody),
      runReport(accessToken, previousBody),
    ]);

    const current = aggregateMetrics(currentReport);
    const previous = aggregateMetrics(previousReport);

    // Format compatible avec la structure Plausible existante du dashboard
    const payload = {
      aggregate: { results: { metrics: current } },
      aggregatePrev: { results: { metrics: previous } },
      source: 'ga4',
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ga4-stats] error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
