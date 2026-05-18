import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { validateEnrichedDescription, type EventSource } from '../_shared/validate-enriched-description.ts';

/**
 * Edge Function: revalidate-enriched-description
 *
 * Rejoue la validation automatique sur des descriptions enrichies déjà générées.
 * - dry_run=true (défaut)  → ne modifie rien, retourne le rapport complet
 * - dry_run=false          → applique enrichissement_statut/validation_mode/etc.
 *
 * Body : { event_ids?: string[], slugs?: string[], dry_run?: boolean, limit?: number }
 * - Si ni event_ids ni slugs ne sont fournis, on cible les events avec
 *   description_enrichie non vide ET (auto_validation_status IS NULL OU statut='en_attente').
 */

const SELECT_FIELDS =
  'id, slug, nom_event, ville, pays, nom_lieu, code_postal, rue, date_debut, date_fin, secteur, affluence, tarif, url_site_officiel, description_event, description_enrichie, enrichissement_niveau, enrichissement_statut';

interface BodyShape {
  event_ids?: string[];
  slugs?: string[];
  dry_run?: boolean;
  limit?: number;
}

async function loadExhibitorNames(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('participation')
    .select('exhibitor_name, exhibitors(name)')
    .eq('id_event', eventId)
    .limit(2000);
  if (error) {
    console.warn(`[revalidate] exhibitors load: ${error.message}`);
    return [];
  }
  const names = new Set<string>();
  for (const r of (data ?? []) as Array<{ exhibitor_name: string | null; exhibitors: { name: string | null } | null }>) {
    if (r.exhibitor_name) names.add(r.exhibitor_name);
    if (r.exhibitors?.name) names.add(r.exhibitors.name);
  }
  return [...names];
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors instanceof Response) return cors;
  const headers = { ...buildCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST requis' }), { status: 405, headers });
  }

  // Shared-secret gate (réutilise SEO_BATCH_SECRET)
  const BATCH_SECRET = Deno.env.get('SEO_BATCH_SECRET') ?? '';
  if (!BATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'SEO_BATCH_SECRET non configuré' }), { status: 500, headers });
  }
  const provided = req.headers.get('x-seo-batch-secret') ?? '';
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(BATCH_SECRET);
  let ok = a.length === b.length;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  ok = ok && diff === 0;
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: BodyShape = {};
  try { body = await req.json(); } catch { /* empty body OK */ }

  const dryRun = body.dry_run !== false; // défaut true
  const limit = Math.min(body.limit ?? 50, 200);

  let query = supabase.from('events').select(SELECT_FIELDS).not('description_enrichie', 'is', null).limit(limit);
  if (body.event_ids && body.event_ids.length > 0) {
    query = query.in('id', body.event_ids);
  } else if (body.slugs && body.slugs.length > 0) {
    query = query.in('slug', body.slugs);
  }

  const { data: events, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const ev of events ?? []) {
    const exhibitorNames = await loadExhibitorNames(supabase, (ev as { id: string }).id);
    const source: EventSource = {
      nom_event: (ev as { nom_event: string }).nom_event,
      date_debut: (ev as { date_debut: string | null }).date_debut,
      date_fin: (ev as { date_fin: string | null }).date_fin,
      ville: (ev as { ville: string | null }).ville,
      pays: (ev as { pays: string | null }).pays,
      nom_lieu: (ev as { nom_lieu: string | null }).nom_lieu,
      code_postal: (ev as { code_postal: string | null }).code_postal,
      rue: (ev as { rue: string | null }).rue,
      secteur: (ev as { secteur: unknown }).secteur,
      affluence: (ev as { affluence: string | null }).affluence,
      tarif: (ev as { tarif: string | null }).tarif,
      url_site_officiel: (ev as { url_site_officiel: string | null }).url_site_officiel,
      description_event: (ev as { description_event: string | null }).description_event,
      enrichissement_niveau: (ev as { enrichissement_niveau: string | null }).enrichissement_niveau,
    };
    const desc = (ev as { description_enrichie: string }).description_enrichie;
    const validation = validateEnrichedDescription(desc, source, exhibitorNames);
    const autoValidated = validation.decision === 'auto_validate';

    let applied = false;
    if (!dryRun) {
      const upd: Record<string, unknown> = {
        auto_validation_status: validation.status,
        auto_validation_score: validation.score,
        auto_validation_report: validation,
        auto_validated_at: new Date().toISOString(),
        validation_mode: autoValidated ? 'auto' : 'manual',
      };
      // Ne re-passe en 'valide' que si auto-validé. Ne déclasse pas une description déjà validée manuellement.
      const currentStatus = (ev as { enrichissement_statut: string | null }).enrichissement_statut;
      if (autoValidated) {
        upd.enrichissement_statut = 'valide';
      } else if (currentStatus !== 'valide') {
        upd.enrichissement_statut = 'en_attente';
      }
      const { error: upErr } = await supabase.from('events').update(upd).eq('id', (ev as { id: string }).id);
      if (upErr) {
        console.error(`[revalidate] update error ${(ev as { id: string }).id}: ${upErr.message}`);
      } else {
        applied = true;
      }
    }

    results.push({
      id: (ev as { id: string }).id,
      slug: (ev as { slug: string | null }).slug,
      nom_event: (ev as { nom_event: string }).nom_event,
      enrichissement_niveau: (ev as { enrichissement_niveau: string | null }).enrichissement_niveau,
      previous_statut: (ev as { enrichissement_statut: string | null }).enrichissement_statut,
      auto_validation_status: validation.status,
      auto_validation_score: validation.score,
      decision: validation.decision,
      final_statut: autoValidated ? 'valide' : ((ev as { enrichissement_statut: string | null }).enrichissement_statut === 'valide' ? 'valide' : 'en_attente'),
      validation_mode: autoValidated ? 'auto' : 'manual',
      reason: validation.reason,
      stats: validation.stats,
      blockers: validation.blockers,
      warnings: validation.warnings,
      checks: validation.checks,
      applied,
    });
  }

  const summary = {
    dry_run: dryRun,
    total: results.length,
    auto_validated: results.filter((r) => r.auto_validation_status === 'passed').length,
    warning: results.filter((r) => r.auto_validation_status === 'warning').length,
    failed: results.filter((r) => r.auto_validation_status === 'failed').length,
    deploy_hook_triggered: false,
  };

  return new Response(JSON.stringify({ summary, results }, null, 2), { status: 200, headers });
});