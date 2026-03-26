import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * Edge Function: enrich-event-meta
 * 
 * Enrichit automatiquement les métadonnées SEO d'un événement
 * en appelant l'API Claude (Anthropic) pour générer meta_description_gen.
 * 
 * Payload: { event_id: string } (UUID de l'événement dans la table events)
 * 
 * Sécurité : fire-and-forget, ne bloque jamais la publication.
 * En cas d'erreur, enrichissement_statut = 'error'.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface EventData {
  id: string;
  nom_event: string;
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
    // Limiter la description à 500 chars pour ne pas exploser le contexte
    const desc = event.description_event.slice(0, 500);
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

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    const corsResult = handleCors(req);
    if (corsResult instanceof Response) return corsResult;
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { event_id } = await req.json();

    if (!event_id || typeof event_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'event_id requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY non configurée');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Récupérer l'événement
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('id, nom_event, type_event, secteur, ville, nom_lieu, date_debut, date_fin, description_event, affluence, meta_description_gen')
      .eq('id', event_id)
      .maybeSingle();

    if (fetchError || !event) {
      console.error('❌ Événement non trouvé:', event_id, fetchError?.message);
      return new Response(
        JSON.stringify({ error: 'Événement non trouvé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Vérifications : à venir + meta vide
    if (event.meta_description_gen && event.meta_description_gen.trim() !== '') {
      console.log(`⏭️ meta_description_gen déjà remplie pour ${event.nom_event}, skip.`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'meta_description_gen déjà remplie' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const endDate = event.date_fin?.slice(0, 10) ?? event.date_debut?.slice(0, 10);
    if (endDate && endDate < today) {
      console.log(`⏭️ Événement passé ${event.nom_event}, skip enrichissement.`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Événement passé' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Vérifier champs minimum (nom_event requis au minimum)
    if (!event.nom_event || event.nom_event.trim() === '') {
      console.log('⏭️ nom_event vide, skip.');
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Données insuffisantes' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Marquer comme "pending"
    await supabase
      .from('events')
      .update({ enrichissement_statut: 'pending', enrichissement_date: new Date().toISOString() })
      .eq('id', event_id);

    // 5. Appel Claude API
    console.log(`🤖 Appel Claude pour : ${event.nom_event}`);

    const userMessage = buildPrompt(event as EventData);

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          { role: 'user', content: userMessage }
        ],
        system: SYSTEM_PROMPT,
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error(`❌ Claude API error ${anthropicResponse.status}:`, errorText.slice(0, 300));

      await supabase
        .from('events')
        .update({ enrichissement_statut: 'error', enrichissement_date: new Date().toISOString() })
        .eq('id', event_id);

      return new Response(
        JSON.stringify({ error: 'Erreur API Claude', status: anthropicResponse.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await anthropicResponse.json();
    const metaDescription = result?.content?.[0]?.text?.trim();

    if (!metaDescription || metaDescription.length < 50) {
      console.error('❌ Meta description invalide ou trop courte:', metaDescription);

      await supabase
        .from('events')
        .update({ enrichissement_statut: 'error', enrichissement_date: new Date().toISOString() })
        .eq('id', event_id);

      return new Response(
        JSON.stringify({ error: 'Meta description générée invalide' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Sauvegarder la meta description
    const truncated = metaDescription.slice(0, 160);

    const { error: updateError } = await supabase
      .from('events')
      .update({
        meta_description_gen: truncated,
        enrichissement_statut: 'done',
        enrichissement_date: new Date().toISOString(),
      })
      .eq('id', event_id);

    if (updateError) {
      console.error('❌ Erreur sauvegarde meta:', updateError.message);
      return new Response(
        JSON.stringify({ error: 'Erreur sauvegarde' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Meta description générée pour ${event.nom_event}: "${truncated}"`);

    return new Response(
      JSON.stringify({
        success: true,
        event_name: event.nom_event,
        meta_description_gen: truncated,
        length: truncated.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur générale enrichissement:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
