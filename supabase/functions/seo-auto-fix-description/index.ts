import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { validateEnrichedDescription, type EventSource } from '../_shared/validate-enriched-description.ts';
import { callAnthropic } from '../_shared/anthropic.ts';

/**
 * Edge Function: seo-auto-fix-description
 *
 * Relance Claude avec un prompt CORRECTIF strict pour réparer une description
 * enrichie qui a échoué la validation auto. Cible un seul événement, ne touche
 * qu'aux problèmes détectés, sans inventer d'informations supplémentaires.
 *
 * Body : { event_id: string }
 * Auth : header x-seo-batch-secret (mêmes règles que revalidate-enriched-description)
 */

const SELECT_FIELDS =
  'id, slug, nom_event, ville, pays, nom_lieu, code_postal, rue, date_debut, date_fin, secteur, affluence, tarif, url_site_officiel, description_event, description_enrichie, enrichissement_niveau, enrichissement_statut';

interface CheckLike { code: string; status: string; evidence?: string[]; details?: string; }

async function loadExhibitorNames(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('participation')
    .select('exhibitor_name, exhibitors(name)')
    .eq('id_event', eventId)
    .limit(2000);
  if (error) return [];
  const names = new Set<string>();
  for (const r of (data ?? []) as Array<{ exhibitor_name: string | null; exhibitors: { name: string | null } | null }>) {
    if (r.exhibitor_name) names.add(r.exhibitor_name);
    if (r.exhibitors?.name) names.add(r.exhibitors.name);
  }
  return [...names];
}

function buildFixInstructions(
  checks: CheckLike[],
  src: { ville: string | null; nom_lieu: string | null },
): string[] {
  const out: string[] = [];
  const failing = checks.filter((c) => c.status === 'fail' || c.status === 'warning');
  for (const c of failing) {
    switch (c.code) {
      case 'city_consistency':
        out.push(`Ville incorrecte. Supprime toute mention d'une autre ville et n'utilise QUE « ${src.ville ?? 'la ville officielle'} » comme localisation. Évidences : ${(c.evidence ?? []).join(', ') || '—'}.`);
        break;
      case 'venue_consistency':
        out.push(`Lieu incorrect. Supprime toute mention d'un autre lieu et utilise UNIQUEMENT « ${src.nom_lieu ?? 'le lieu officiel'} ». Évidences : ${(c.evidence ?? []).join(', ') || '—'}.`);
        break;
      case 'date_consistency':
        out.push(`Date/année incohérente. Supprime les années non présentes dans les données source. Évidences : ${(c.evidence ?? []).join(', ') || '—'}.`);
        break;
      case 'numbers_grounded':
        out.push(`Chiffre(s) non sourcé(s) dans un contexte sensible (visiteurs, exposants, m², édition…). SUPPRIME complètement ces chiffres au lieu de les paraphraser. Évidences : ${(c.evidence ?? []).join(' | ') || '—'}.`);
        break;
      case 'price_invented':
        out.push(`Tarif inventé. Supprime toute mention de prix, gratuité, billet ou inscription payante : aucun tarif officiel n'est en base.`);
        break;
      case 'program_invented':
        out.push(`Programme inventé. Supprime tout horaire précis, atelier nommé, keynote nommé, intervenant nommé, créneau ou programme jour-par-jour. Reformule en restant général. Évidences : ${(c.evidence ?? []).join(', ') || '—'}.`);
        break;
      case 'exhibitors_grounded':
        out.push(`Noms d'entreprises/exposants non sourcés. SUPPRIME les noms suivants du texte : ${(c.evidence ?? []).join(', ') || '—'}. Reformule sans citer d'exposants nominativement.`);
        break;
      case 'superlatives':
        out.push(`Superlatifs/promesses non sourcés. Reformule sans "leader", "n°1", "incontournable", "unique en France", "le plus grand", etc.`);
        break;
      case 'length_min':
        if (c.status === 'fail') out.push(`Texte trop court. Étoffe en restant strictement factuel à partir des données fournies, sans inventer.`);
        break;
      case 'generic_text':
      case 'repetition':
      case 'fake_faq':
        out.push(`Améliore la qualité rédactionnelle (${c.code}) sans ajouter d'information factuelle nouvelle.`);
        break;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors instanceof Response) return cors;
  const headers = { ...buildCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST requis' }), { status: 405, headers });
  }

  // Shared secret
  const BATCH_SECRET = Deno.env.get('SEO_BATCH_SECRET') ?? '';
  if (!BATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'SEO_BATCH_SECRET non configuré' }), { status: 500, headers });
  }
  if ((req.headers.get('x-seo-batch-secret') ?? '') !== BATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurée' }), { status: 500, headers });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { event_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (!body.event_id) {
    return new Response(JSON.stringify({ error: 'event_id requis' }), { status: 400, headers });
  }

  const { data: ev, error: evErr } = await supabase
    .from('events').select(SELECT_FIELDS).eq('id', body.event_id).maybeSingle();
  if (evErr || !ev) {
    return new Response(JSON.stringify({ error: evErr?.message ?? 'Événement introuvable' }), { status: 404, headers });
  }

  const event = ev as Record<string, unknown>;
  const currentDesc = String(event.description_enrichie ?? '');
  if (!currentDesc) {
    return new Response(JSON.stringify({ error: 'Pas de description_enrichie à corriger' }), { status: 400, headers });
  }

  // Recompute validation to know what's wrong NOW
  const exhibitorNames = await loadExhibitorNames(supabase, body.event_id);
  const source: EventSource = {
    nom_event: String(event.nom_event ?? ''),
    date_debut: (event.date_debut as string | null) ?? null,
    date_fin: (event.date_fin as string | null) ?? null,
    ville: (event.ville as string | null) ?? null,
    pays: (event.pays as string | null) ?? null,
    nom_lieu: (event.nom_lieu as string | null) ?? null,
    code_postal: (event.code_postal as string | null) ?? null,
    rue: (event.rue as string | null) ?? null,
    secteur: event.secteur,
    affluence: (event.affluence as string | null) ?? null,
    tarif: (event.tarif as string | null) ?? null,
    url_site_officiel: (event.url_site_officiel as string | null) ?? null,
    description_event: (event.description_event as string | null) ?? null,
    enrichissement_niveau: (event.enrichissement_niveau as string | null) ?? null,
  };
  const before = validateEnrichedDescription(currentDesc, source, exhibitorNames);

  const instructions = buildFixInstructions(before.checks as CheckLike[], { ville: source.ville, nom_lieu: source.nom_lieu });
  if (instructions.length === 0) {
    return new Response(JSON.stringify({
      summary: { fixed: false, reason: 'Aucune correction nécessaire — la validation passe déjà.' },
      before,
    }), { status: 200, headers });
  }

  // Build corrective prompt
  const system = `Tu es un correcteur factuel. Tu reçois une description existante d'un salon professionnel et une LISTE STRICTE de corrections à appliquer.

RÈGLES ABSOLUES :
- Tu N'INVENTES AUCUNE NOUVELLE INFORMATION. Tu ne fais que corriger ou supprimer ce qui pose problème.
- Si une information factuelle est demandée mais absente des données, tu l'omets totalement.
- Tu conserves la longueur, le ton, la structure du texte original autant que possible.
- Tu retournes UNIQUEMENT le texte corrigé, sans préambule, sans commentaire, sans titre.
- Pas de superlatifs ("incontournable", "leader", "unique"…).`;

  const dataBlock = [
    `NOM : ${source.nom_event}`,
    `VILLE : ${source.ville ?? 'non communiqué'}`,
    `LIEU : ${source.nom_lieu ?? 'non communiqué'}`,
    `DATES : ${source.date_debut ?? '?'} → ${source.date_fin ?? '?'}`,
    `AFFLUENCE : ${source.affluence ?? 'non communiqué'}`,
    `TARIF : ${source.tarif ?? 'non communiqué'}`,
    `EXPOSANTS CONNUS : ${exhibitorNames.slice(0, 30).join(', ') || 'aucun en base'}`,
  ].join('\n');

  const userMessage = `DONNÉES SOURCE (seules autorisées) :
${dataBlock}

TEXTE ORIGINAL À CORRIGER :
"""
${currentDesc}
"""

CORRECTIONS À APPLIQUER (strictement, sans rien inventer d'autre) :
${instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Retourne le texte corrigé.`;

  const ai = await callAnthropic({
    apiKey: ANTHROPIC_KEY,
    system,
    userMessage,
    maxTokens: 1500,
    caller: 'seo-auto-fix',
  });

  if (!ai.ok || !ai.text) {
    return new Response(JSON.stringify({ error: ai.error ?? 'Échec Claude', errorCode: ai.errorCode }), { status: 502, headers });
  }

  const newText = ai.text;
  const after = validateEnrichedDescription(newText, source, exhibitorNames);
  const autoValidated = after.decision === 'auto_validate';

  const upd: Record<string, unknown> = {
    description_enrichie: newText,
    auto_validation_status: after.status,
    auto_validation_score: after.score,
    auto_validation_report: after,
    auto_validated_at: new Date().toISOString(),
    validation_mode: autoValidated ? 'auto' : 'manual',
  };
  if (autoValidated) upd.enrichissement_statut = 'valide';
  else if ((event.enrichissement_statut as string | null) !== 'valide') upd.enrichissement_statut = 'en_attente';

  const { error: upErr } = await supabase.from('events').update(upd).eq('id', body.event_id);
  if (upErr) {
    return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers });
  }

  return new Response(JSON.stringify({
    summary: {
      fixed: true,
      before: { status: before.status, score: before.score },
      after: { status: after.status, score: after.score, decision: after.decision },
      applied_instructions: instructions.length,
      validation_mode: autoValidated ? 'auto' : 'manual',
    },
    after,
  }, null, 2), { status: 200, headers });
});