import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * Edge Function: enrich-event-meta
 * 
 * Enrichit automatiquement les métadonnées SEO d'un événement
 * en appelant l'API Claude (Anthropic) pour générer meta_description_gen.
 * 
 * Modes :
 *   { event_id: string }           → enrichit un seul événement
 *   { batch: true, limit: number } → enrichit un lot d'événements éligibles
 * 
 * Sécurité : fire-and-forget, ne bloque jamais la publication.
 * En cas d'erreur, enrichissement_statut = 'error'.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface EventData {
  id: string;
  id_event: string | null;
  nom_event: string;
  slug: string | null;
  type_event: string | null;
  secteur: unknown;
  ville: string | null;
  nom_lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  description_event: string | null;
  affluence: string | null;
  meta_description_gen: string | null;
}

interface EnrichResult {
  id: string;
  id_event: string | null;
  nom_event: string;
  slug: string | null;
  status: 'done' | 'skipped' | 'error';
  reason?: string;
  meta_description_gen?: string;
  length?: number;
  enrichissement_date?: string;
}

function buildPrompt(event: EventData): string {
  const parts: string[] = [];

  parts.push(`Nom : ${event.nom_event}`);
  if (event.type_event) parts.push(`Type : ${event.type_event}`);
  if (event.ville) parts.push(`Ville : ${event.ville}`);
  if (event.nom_lieu) parts.push(`Lieu : ${event.nom_lieu}`);
  if (event.date_debut) parts.push(`Date début : ${event.date_debut}`);
  if (event.date_fin) parts.push(`Date fin : ${event.date_fin}`);

  if (event.secteur) {
    const secteurs = Array.isArray(event.secteur) 
      ? event.secteur.join(', ')
      : String(event.secteur);
    if (secteurs && secteurs !== '[]') parts.push(`Secteurs : ${secteurs}`);
  }

  if (event.affluence) parts.push(`Affluence : ${event.affluence} visiteurs`);

  if (event.description_event) {
    const desc = event.description_event.replace(/<[^>]*>/g, '').slice(0, 500);
    parts.push(`Description : ${desc}`);
  }

  return parts.join('\n');
}

const SYSTEM_PROMPT = `Tu es un rédacteur SEO spécialisé dans les salons et événements professionnels en France.

RÈGLES STRICTES :
- Génère UNE SEULE meta description entre 140 et 155 caractères exactement.
- Utilise UNIQUEMENT les informations fournies. N'invente RIEN.
- Si une information n'est pas fournie, ne la mentionne pas.
- Style factuel, clair et naturel. Pas de superlatifs. Pas de formulations marketing.
- Pas de guillemets autour du résultat.
- Pas de préfixe type "Meta description :" ou "Voici la meta description".
- Inclus si possible : nom de l'événement, ville, dates ou année, et secteur principal.
- La phrase doit donner envie de cliquer tout en restant informative et honnête.
- Réponds UNIQUEMENT avec la meta description, rien d'autre.`;

/** Enrich a single event. Returns the result object. */
async function enrichSingleEvent(
  supabase: ReturnType<typeof createClient>,
  event: EventData,
  anthropicKey: string,
): Promise<EnrichResult> {
  const base = { id: event.id, id_event: event.id_event, nom_event: event.nom_event, slug: event.slug };

  // Guard: already has meta
  if (event.meta_description_gen && event.meta_description_gen.trim() !== '') {
    return { ...base, status: 'skipped', reason: 'meta_description_gen déjà remplie' };
  }

  // Guard: past event
  const today = new Date().toISOString().slice(0, 10);
  const endDate = event.date_fin?.slice(0, 10) ?? event.date_debut?.slice(0, 10);
  if (endDate && endDate < today) {
    return { ...base, status: 'skipped', reason: 'Événement passé' };
  }

  // Guard: missing data
  if (!event.nom_event || event.nom_event.trim() === '') {
    return { ...base, status: 'skipped', reason: 'Données insuffisantes' };
  }

  // Mark pending
  await supabase
    .from('events')
    .update({ enrichissement_statut: 'pending', enrichissement_date: new Date().toISOString() })
    .eq('id', event.id);

  try {
    console.log(`🤖 Appel Claude pour : ${event.nom_event}`);
    const userMessage = buildPrompt(event);

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: userMessage }],
        system: SYSTEM_PROMPT,
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error(`❌ Claude API error ${anthropicResponse.status}:`, errorText.slice(0, 300));
      await supabase
        .from('events')
        .update({ enrichissement_statut: 'error', enrichissement_date: new Date().toISOString() })
        .eq('id', event.id);
      return { ...base, status: 'error', reason: `Claude API ${anthropicResponse.status}` };
    }

    const result = await anthropicResponse.json();
    const metaDescription = result?.content?.[0]?.text?.trim();

    if (!metaDescription || metaDescription.length < 50) {
      await supabase
        .from('events')
        .update({ enrichissement_statut: 'error', enrichissement_date: new Date().toISOString() })
        .eq('id', event.id);
      return { ...base, status: 'error', reason: 'Meta générée invalide ou trop courte' };
    }

    const truncated = metaDescription.slice(0, 160);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('events')
      .update({
        meta_description_gen: truncated,
        enrichissement_statut: 'done',
        enrichissement_date: now,
      })
      .eq('id', event.id);

    if (updateError) {
      console.error('❌ Erreur sauvegarde meta:', updateError.message);
      return { ...base, status: 'error', reason: 'Erreur sauvegarde DB' };
    }

    console.log(`✅ Meta OK pour ${event.nom_event}: "${truncated}"`);
    return {
      ...base,
      status: 'done',
      meta_description_gen: truncated,
      length: truncated.length,
      enrichissement_date: now,
    };
  } catch (err) {
    console.error(`❌ Erreur enrichissement ${event.nom_event}:`, err);
    await supabase
      .from('events')
      .update({ enrichissement_statut: 'error', enrichissement_date: new Date().toISOString() })
      .eq('id', event.id);
    return { ...base, status: 'error', reason: err instanceof Error ? err.message : String(err) };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    const corsResult = handleCors(req);
    if (corsResult instanceof Response) return corsResult;
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const body = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY non configurée');
      return new Response(JSON.stringify({ error: 'Configuration manquante' }), { status: 500, headers: jsonHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ─── BATCH MODE ───
    if (body.batch === true) {
      const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
      const today = new Date().toISOString().slice(0, 10);

      console.log(`📦 Batch enrichissement — limit: ${limit}`);

      // Fetch eligible events: visible, upcoming, no meta
      const { data: events, error: fetchErr } = await supabase
        .from('events')
        .select('id, id_event, nom_event, slug, type_event, secteur, ville, nom_lieu, date_debut, date_fin, description_event, affluence, meta_description_gen')
        .eq('visible', true)
        .eq('is_test', false)
        .gte('date_debut', today)
        .or('meta_description_gen.is.null,meta_description_gen.eq.')
        .order('date_debut', { ascending: true })
        .limit(limit);

      if (fetchErr) {
        console.error('❌ Fetch batch events error:', fetchErr.message);
        return new Response(JSON.stringify({ error: 'Erreur récupération événements', details: fetchErr.message }), { status: 500, headers: jsonHeaders });
      }

      if (!events || events.length === 0) {
        return new Response(JSON.stringify({ batch: true, total: 0, results: [], message: 'Aucun événement éligible trouvé' }), { status: 200, headers: jsonHeaders });
      }

      console.log(`📋 ${events.length} événements éligibles trouvés`);

      const results: EnrichResult[] = [];
      for (const ev of events) {
        // Sequential to avoid rate limits on Claude API
        const result = await enrichSingleEvent(supabase, ev as EventData, ANTHROPIC_API_KEY);
        results.push(result);
      }

      const done = results.filter(r => r.status === 'done').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const errors = results.filter(r => r.status === 'error').length;

      console.log(`📦 Batch terminé — done: ${done}, skipped: ${skipped}, errors: ${errors}`);

      return new Response(JSON.stringify({
        batch: true,
        total: results.length,
        done,
        skipped,
        errors,
        results,
      }), { status: 200, headers: jsonHeaders });
    }

    // ─── SINGLE EVENT MODE ───
    const { event_id } = body;

    if (!event_id || typeof event_id !== 'string') {
      return new Response(JSON.stringify({ error: 'event_id requis' }), { status: 400, headers: jsonHeaders });
    }

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('id, id_event, nom_event, slug, type_event, secteur, ville, nom_lieu, date_debut, date_fin, description_event, affluence, meta_description_gen')
      .eq('id', event_id)
      .maybeSingle();

    if (fetchError || !event) {
      console.error('❌ Événement non trouvé:', event_id, fetchError?.message);
      return new Response(JSON.stringify({ error: 'Événement non trouvé' }), { status: 404, headers: jsonHeaders });
    }

    const result = await enrichSingleEvent(supabase, event as EventData, ANTHROPIC_API_KEY);

    const statusCode = result.status === 'error' ? 500 : 200;
    return new Response(JSON.stringify(result), { status: statusCode, headers: jsonHeaders });

  } catch (error) {
    console.error('❌ Erreur générale enrichissement:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
