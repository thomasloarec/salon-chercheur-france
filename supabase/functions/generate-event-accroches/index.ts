import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic, getAnthropicModelFast } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = getAnthropicModelFast(); // Sonnet 4.6 par défaut (via _shared/anthropic.ts)
const BATCH_LIMIT = 100;
const CONCURRENCY = 4;
const MAX_LEN = 200;

type EventRow = {
  id: string;
  nom_event: string | null;
  ville: string | null;
  secteur: unknown;
  description_event: string | null;
};

function extractSectors(secteur: unknown): string {
  if (!secteur) return '';
  if (Array.isArray(secteur)) {
    return secteur
      .map((s) => (typeof s === 'string' ? s : (s as any)?.name || (s as any)?.label || ''))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof secteur === 'string') return secteur;
  if (typeof secteur === 'object') {
    const o = secteur as any;
    return o.name || o.label || '';
  }
  return '';
}

function buildPrompt(ev: EventRow): string {
  const nom = (ev.nom_event || '').trim();
  const secteurs = extractSectors(ev.secteur);
  const desc = (ev.description_event || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  return `Tu rédiges une accroche pour un salon professionnel, affichée sous son nom dans un annuaire. Elle complète les informations déjà affichées à côté (nom, secteur, dates, ville, nombre d'exposants) : ne les répète jamais.

Salon : ${nom}
Secteur(s) : ${secteurs}
Description : ${desc}

Consignes :
- Une seule phrase complète et fluide, environ 90 à 120 caractères. Reste court : une phrase courte et entière vaut mieux qu'une longue.
- Décris le thème du salon, son public professionnel et ce qu'on y trouve ou pourquoi y aller.
- N'indique JAMAIS la date, ni la ville ou la région, ni le nombre d'exposants (déjà affichés à côté).
- Varie la formulation d'un salon à l'autre. Ne commence pas par « Le rendez-vous », « Le salon », « Découvrez », « Explorez » ni « Plateforme ».
- Français, factuel et spécifique ; pas de superlatif creux.
- Sans tiret cadratin. Réponds uniquement par l'accroche, sans guillemets ni préambule.`;
}

function cleanAccroche(raw: string): string {
  let t = raw.trim();
  // strip surrounding quotes
  t = t.replace(/^["'«»“”‘’]+|["'«»“”‘’]+$/g, '').trim();
  // remove em-dash per instructions
  t = t.replace(/—/g, '-');
  if (t.length > MAX_LEN) {
    const slice = t.slice(0, MAX_LEN);
    const lastSpace = slice.lastIndexOf(' ');
    t = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd();
    // strip trailing punctuation fragments like a lone comma/semicolon
    t = t.replace(/[,;:\-]+$/g, '').trimEnd();
  }
  return t;
}

async function processOne(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  ev: EventRow,
): Promise<'done' | 'error'> {
  const res = await callAnthropic({
    apiKey,
    model: MODEL,
    userMessage: buildPrompt(ev),
    maxTokens: 80,
    caller: 'generate-event-accroches',
  });
  if (!res.ok || !res.text) return 'error';
  const accroche = cleanAccroche(res.text);
  if (!accroche) return 'error';
  const { error } = await supabase
    .from('event_ai')
    .upsert(
      { event_id: ev.id, accroche, generated_at: new Date().toISOString() },
      { onConflict: 'event_id' },
    );
  if (error) {
    console.error('[generate-event-accroches] upsert error', ev.id, error.message);
    return 'error';
  }
  return 'done';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anthropicKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Missing required secrets' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Auth: allow (a) service_role token (cron) or (b) authenticated admin user.
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.slice('Bearer '.length);
  if (token !== serviceKey) {
    // Verify user JWT and admin role
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleError } = await admin.rpc('has_role', {
      _user_id: claimsData.claims.sub,
      _role: 'admin',
    });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Select events missing an accroche via dedicated RPC (NOT EXISTS join).
  const { data, error } = await supabase.rpc('select_events_missing_accroche', {
    p_limit: BATCH_LIMIT,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const rows = (data ?? []) as EventRow[];

  const total = rows.length;
  let done = 0;
  let errors = 0;

  // Bounded concurrency
  let idx = 0;
  async function worker() {
    while (idx < rows!.length) {
      const my = idx++;
      const ev = rows![my];
      try {
        const r = await processOne(supabase, anthropicKey!, ev);
        if (r === 'done') done++;
        else errors++;
      } catch (e) {
        errors++;
        console.error('[generate-event-accroches] unexpected', ev.id, (e as Error).message);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));

  // Count remaining
  const { count: remainingCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('visible', true)
    .eq('is_test', false);
  const { count: withAccroche } = await supabase
    .from('event_ai')
    .select('event_id', { count: 'exact', head: true })
    .not('accroche', 'is', null);
  const restants = Math.max(0, (remainingCount ?? 0) - (withAccroche ?? 0));

  return new Response(
    JSON.stringify({ traites: total, done, errors, restants }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});