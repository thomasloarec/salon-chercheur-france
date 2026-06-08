import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';

/**
 * Edge Function: admin-seo-batch-proxy
 *
 * Proxy admin-only pour appeler les fonctions protégées par SEO_BATCH_SECRET
 * depuis le frontend admin, sans exposer le secret côté client.
 *
 * Body : {
 *   target: 'seo-enrichment-batch' | 'revalidate-enriched-description',
 *   payload: Record<string, unknown>
 * }
 */

const ALLOWED_TARGETS = new Set([
  'seo-enrichment-batch',
  'revalidate-enriched-description',
  'seo-auto-fix-description',
  'seo-auto-fix-batch',
]);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors instanceof Response) return cors;
  const headers = { ...buildCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST requis' }), { status: 405, headers });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const BATCH_SECRET = Deno.env.get('SEO_BATCH_SECRET') ?? '';

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !BATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'Configuration serveur incomplète' }), { status: 500, headers });
  }

  // ── Auth: verify caller is an admin ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers });
  }
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Authentification invalide' }), { status: 401, headers });
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: isAdmin, error: roleErr } = await serviceClient.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  });
  if (roleErr || !isAdmin) {
    return new Response(JSON.stringify({ error: 'Accès admin requis' }), { status: 403, headers });
  }

  // ── Parse body ──
  let body: { target?: string; payload?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const target = String(body.target ?? '');
  if (!ALLOWED_TARGETS.has(target)) {
    return new Response(JSON.stringify({ error: `target invalide. Attendu: ${[...ALLOWED_TARGETS].join(', ')}` }), { status: 400, headers });
  }
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

  // ── Forward with shared secret ──
  const url = `${SUPABASE_URL}/functions/v1/${target}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'x-seo-batch-secret': BATCH_SECRET,
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    return new Response(text, { status: r.status, headers });
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Forward error',
      details: err instanceof Error ? err.message : String(err),
    }), { status: 502, headers });
  }
});