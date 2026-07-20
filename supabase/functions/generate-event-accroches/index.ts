import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_LIMIT = 100;
const CONCURRENCY = 4;
const MAX_LEN = 160;

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
  const ville = (ev.ville || '').trim();
  const secteurs = extractSectors(ev.secteur);
  const desc = (ev.description_event || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  return `Tu rédiges une accroche courte pour un salon professionnel, affichée sous son nom dans un annuaire.
Salon : ${nom}
Secteur(s) : ${secteurs}
Ville : ${ville}
Description : ${desc}

Consignes : une seule phrase, 110 à 140 caractères, en français, factuelle et spécifique à ce salon (pas de formule générique ni de superlatif creux), sans tiret cadratin. Réponds uniquement par l'accroche, sans guillemets ni préambule.`;
}

function cleanAccroche(raw: string): string {
  let t = raw.trim();
  // strip surrounding quotes
  t = t.replace(/^["'«»“”‘’]+|["'«»“”‘’]+$/g, '').trim();
  // remove em-dash per instructions
  t = t.replace(/—/g, '-');
  if (t.length > MAX_LEN) t = t.slice(0, MAX_LEN).trimEnd();
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
  if (!supabaseUrl || !serviceKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing required secrets' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Select events with no accroche yet (either no event_ai row or accroche IS NULL).
  const { data, error } = await supabase.rpc('select_events_missing_accroche', {
    p_limit: BATCH_LIMIT,
  }).select();

  let rows: EventRow[] | null = null;
  if (error) {
    // Fallback: two-step query without a dedicated RPC.
    const { data: existing, error: aiErr } = await supabase
      .from('event_ai')
      .select('event_id')
      .not('accroche', 'is', null);
    if (aiErr) {
      return new Response(JSON.stringify({ error: aiErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const doneIds = (existing ?? []).map((r: any) => r.event_id as string);
    let query = supabase
      .from('events')
      .select('id, nom_event, ville, secteur, description_event')
      .eq('visible', true)
      .eq('is_test', false)
      .limit(BATCH_LIMIT);
    if (doneIds.length > 0) {
      // Supabase supports .not('id','in',`(${...})`)
      const list = `(${doneIds.map((id) => `"${id}"`).join(',')})`;
      query = query.not('id', 'in', list);
    }
    const { data: evs, error: evErr } = await query;
    if (evErr) {
      return new Response(JSON.stringify({ error: evErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    rows = (evs ?? []) as EventRow[];
  } else {
    rows = (data ?? []) as EventRow[];
  }

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