import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * Edge Function: seo-enrichment-batch
 *
 * Orchestrateur d'enrichissement SEO automatique.
 * Délègue le traitement événement par événement à `enrich-event-meta`
 * (réutilise la logique existante : meta_description_gen + description_enrichie).
 *
 * Couche supplémentaire :
 *  - sélection priorisée des événements éligibles
 *  - journalisation dans seo_enrichment_runs
 *  - verrou anti-double-run
 *  - déclenchement conditionnel du Deploy Hook Vercel
 *  - support des modes dry_run / test / run
 */

type Mode = 'dry_run' | 'test' | 'run';
type TriggerSource = 'cron' | 'manual' | 'dry_run';

interface Params {
  mode: Mode;
  limit: number;
  deploy: boolean;
  trigger_source: TriggerSource;
}

interface CandidateEvent {
  id: string;
  id_event: string | null;
  nom_event: string;
  slug: string | null;
  ville: string | null;
  secteur: unknown;
  date_debut: string | null;
  meta_description_gen: string | null;
  description_enrichie: string | null;
  enrichissement_statut: string | null;
  description_event: string | null;
  enrichissement_score: number | null;
  enrichissement_niveau: string | null;
}

const PRIORITY_SECTOR_KEYWORDS = [
  'santé', 'médical',
  'tourisme', 'événementiel', 'evenementiel', 'hôtellerie',
  'industrie', 'production',
  'btp', 'construction',
  'agroalimentaire', 'agriculture', 'boisson',
];

function flattenSecteur(secteur: unknown): string[] {
  if (!secteur) return [];
  const arr = Array.isArray(secteur) ? secteur : [secteur];
  return arr.flatMap((s) => (Array.isArray(s) ? s : [s])).filter(Boolean).map((s) => String(s));
}

/**
 * Tie-breaker score, utilisé UNIQUEMENT après tri par enrichissement_score DESC.
 * Le ranking principal est piloté par events.enrichissement_score (0-100)
 * calculé par public.compute_event_enrichissement_score().
 */
function tieBreakScore(ev: CandidateEvent, hasParticipations: boolean): number {
  let score = 0;
  if (hasParticipations) score += 1000;
  if (ev.date_debut && ev.date_debut.startsWith('2026')) score += 500;

  const sectors = flattenSecteur(ev.secteur).map((s) => s.toLowerCase());
  const sectorMatch = sectors.some((s) =>
    PRIORITY_SECTOR_KEYWORDS.some((kw) => s.includes(kw))
  );
  if (sectorMatch) score += 200;

  if (!ev.description_enrichie) score += 100;
  if (!ev.meta_description_gen) score += 50;
  return score;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEligible(e: CandidateEvent): boolean {
  // Le batch ne sait générer que la meta et/ou la description enrichie.
  // Un événement déjà publié ne doit donc pas être repris uniquement parce que
  // sa description source est courte ou parce que l'auto-validation garde une trace d'échec.
  return !hasText(e.meta_description_gen) || !hasText(e.description_enrichie);
}

function parseParams(body: Record<string, unknown>): Params {
  const rawMode = typeof body.mode === 'string' ? body.mode : 'dry_run';
  const mode: Mode = (['dry_run', 'test', 'run'] as const).includes(rawMode as Mode)
    ? (rawMode as Mode)
    : 'dry_run';

  const rawTrigger = typeof body.trigger_source === 'string' ? body.trigger_source : 'manual';
  let trigger_source: TriggerSource = (['cron', 'manual', 'dry_run'] as const).includes(rawTrigger as TriggerSource)
    ? (rawTrigger as TriggerSource)
    : 'manual';

  if (mode === 'dry_run') trigger_source = 'dry_run';

  let limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
  if (mode === 'test') limit = Math.min(limit, 2);

  const deploy = body.deploy === true;

  return { mode, limit, deploy, trigger_source };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    const r = handleCors(req);
    if (r instanceof Response) return r;
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  // ─── Shared-secret gate ───
  // Toute requête (cron, manuel, dry_run) DOIT inclure x-seo-batch-secret.
  // Sans header valide : 401, aucun travail, aucune écriture, aucun deploy.
  const BATCH_SECRET = Deno.env.get('SEO_BATCH_SECRET') ?? '';
  if (!BATCH_SECRET) {
    return new Response(JSON.stringify({
      error: 'SEO_BATCH_SECRET non configuré côté serveur',
    }), { status: 500, headers: jsonHeaders });
  }
  const provided = req.headers.get('x-seo-batch-secret') ?? '';
  // Constant-time compare
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(BATCH_SECRET);
  let ok = a.length === b.length;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  ok = ok && diff === 0;
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: jsonHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const params = parseParams(body);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const VERCEL_HOOK = Deno.env.get('VERCEL_DEPLOY_HOOK_URL') ?? '';

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Configuration manquante' }), { status: 500, headers: jsonHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ─── Anti-double-run lock (skip in dry_run) ───
    if (params.mode !== 'dry_run') {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const { data: running } = await supabase
        .from('seo_enrichment_runs')
        .select('id, started_at')
        .eq('status', 'running')
        .gte('started_at', twoHoursAgo)
        .limit(1);
      if (running && running.length > 0) {
        return new Response(JSON.stringify({
          error: 'Un run est déjà en cours',
          existing_run_id: running[0].id,
          started_at: running[0].started_at,
        }), { status: 409, headers: jsonHeaders });
      }
    }

    // ─── Fetch candidates ───
    const today = new Date().toISOString().slice(0, 10);
    const { data: rawEvents, error: fetchErr } = await supabase
      .from('events')
      .select('id, id_event, nom_event, slug, ville, secteur, date_debut, meta_description_gen, description_enrichie, enrichissement_statut, description_event, enrichissement_score, enrichissement_niveau')
      .eq('visible', true)
      .or('is_test.is.null,is_test.eq.false')
      .not('slug', 'is', null)
      .neq('slug', '')
      .gte('date_debut', today)
      .limit(1000);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: 'Erreur récupération événements', details: fetchErr.message }), { status: 500, headers: jsonHeaders });
    }

    const eligible = ((rawEvents ?? []) as CandidateEvent[]).filter(isEligible);

    // ─── Fetch participation counts (FIX: participation.id_event = events.id UUID) ───
    const eventUuids = eligible.map((e) => e.id).filter((x): x is string => !!x);
    const participationsByEventUuid: Record<string, number> = {};
    if (eventUuids.length > 0) {
      const { data: parts } = await supabase
        .from('participation')
        .select('id_event')
        .in('id_event', eventUuids);
      for (const p of (parts ?? []) as Array<{ id_event: string }>) {
        participationsByEventUuid[p.id_event] = (participationsByEventUuid[p.id_event] ?? 0) + 1;
      }
    }

    // ─── Sort: enrichissement_score DESC (source de vérité) ───
    // Tie-break: participations > 0, 2026, secteur prioritaire, desc_enrichie manquante,
    // meta manquante, puis date_debut ASC. Les scores NULL passent en dernier.
    eligible.sort((a, b) => {
      const scoreA = a.enrichissement_score;
      const scoreB = b.enrichissement_score;
      const aNull = scoreA === null || scoreA === undefined;
      const bNull = scoreB === null || scoreB === undefined;
      if (aNull !== bNull) return aNull ? 1 : -1; // non-null d'abord
      if (!aNull && !bNull && scoreA !== scoreB) return (scoreB as number) - (scoreA as number);
      const ta = tieBreakScore(a, (participationsByEventUuid[a.id] ?? 0) > 0);
      const tb = tieBreakScore(b, (participationsByEventUuid[b.id] ?? 0) > 0);
      if (tb !== ta) return tb - ta;
      return (a.date_debut ?? '9999-12-31').localeCompare(b.date_debut ?? '9999-12-31');
    });

    // En mode RUN: ne traiter que les événements à score >= 55. Les score NULL ou < 55
    // restent éligibles en dry_run mais ne consomment pas de tokens IA.
    const runQueue = params.mode === 'run'
      ? eligible.filter((e) => typeof e.enrichissement_score === 'number' && (e.enrichissement_score as number) >= 55)
      : eligible;
    const selected = runQueue.slice(0, params.limit);

    // ─── DRY RUN — no DB write, no deploy ───
    if (params.mode === 'dry_run') {
      const ge55 = eligible.filter((e) => typeof e.enrichissement_score === 'number' && (e.enrichissement_score as number) >= 55).length;
      const nullScore = eligible.filter((e) => e.enrichissement_score === null || e.enrichissement_score === undefined).length;
      return new Response(JSON.stringify({
        mode: 'dry_run',
        total_eligible: eligible.length,
        eligible_score_ge_55: ge55,
        eligible_score_null: nullScore,
        selected_count: selected.length,
        selected: selected.map((e, idx) => {
          const pcount = participationsByEventUuid[e.id] ?? 0;
          const hasScore = typeof e.enrichissement_score === 'number';
          const scoreOk = hasScore && (e.enrichissement_score as number) >= 55;
          const wouldProcess = scoreOk; // critère mode run
          const skip_reason = !hasScore
            ? 'enrichissement_score NULL (à scorer)'
            : (e.enrichissement_score as number) < 55
              ? `enrichissement_score=${e.enrichissement_score} < 55`
              : null;
          const selection_reasons: string[] = [];
          if (!hasText(e.meta_description_gen)) selection_reasons.push('meta_description_gen manquante');
          if (!hasText(e.description_enrichie)) selection_reasons.push('description_enrichie manquante');
          return {
            sort_rank: idx + 1,
            id: e.id,
            slug: e.slug,
            nom_event: e.nom_event,
            ville: e.ville,
            date_debut: e.date_debut,
            enrichissement_score: e.enrichissement_score,
            enrichissement_niveau: e.enrichissement_niveau,
            participations_count: pcount,
            has_participations: pcount > 0,
            meta_description_gen_present: !!e.meta_description_gen,
            description_enrichie_present: !!e.description_enrichie,
            enrichissement_statut: e.enrichissement_statut,
            tie_break_score: tieBreakScore(e, pcount > 0),
            would_process: wouldProcess,
            skip_reason,
            selection_reason: selection_reasons.join(' + '),
          };
        }),
      }), { status: 200, headers: jsonHeaders });
    }

    // ─── Create run log ───
    const { data: runRow, error: runErr } = await supabase
      .from('seo_enrichment_runs')
      .insert({
        status: 'running',
        trigger_source: params.trigger_source,
        events_selected: selected.length,
        details: { mode: params.mode, limit: params.limit, deploy: params.deploy },
      })
      .select()
      .single();

    if (runErr || !runRow) {
      return new Response(JSON.stringify({ error: 'Erreur création run log', details: runErr?.message }), { status: 500, headers: jsonHeaders });
    }
    const runId = runRow.id as string;

    // ─── Process each event by delegating to enrich-event-meta ───
    const processedIds: string[] = [];
    const processedEvents: Array<Record<string, unknown>> = [];
    const errorEvents: Array<{ id: string; nom_event: string; reason: string }> = [];
    let metaDone = 0;
    let descDone = 0;
    let descAutoValidated = 0;
    let descPending = 0;
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const ev of selected) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/enrich-event-meta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
          },
          body: JSON.stringify({ event_id: ev.id }),
        });
        const result = await resp.json().catch(() => ({}));
        processedIds.push(ev.id);

        const metaStatus = result?.status as string | undefined;
        const descStatus = result?.description_enrichie_status as string | undefined;

        const metaOk = metaStatus === 'done';
        const descOk = descStatus === 'done';
        const autoVal = result?.auto_validation_status as string | undefined;
        const metaSkipped = metaStatus === 'skipped';
        const metaErr = metaStatus === 'error' || !resp.ok;
        const manuallyValidated = result?.enrichissement_statut === 'valide' && result?.validation_mode === 'manual';

        if (metaOk) metaDone++;
        if (descOk) descDone++;
        if (descOk && autoVal === 'passed') descAutoValidated++;
        if (descOk && autoVal && autoVal !== 'passed') descPending++;

        let decision = 'skipped';
        if (metaErr) decision = 'failed';
        else if (manuallyValidated) decision = 'publie_manuelle';
        else if (descOk && autoVal === 'passed') decision = 'publie_auto';
        else if (descOk && autoVal === 'warning') decision = 'revue_manuelle';
        else if (descOk && autoVal === 'failed') decision = 'failed_validation';
        else if (descOk) decision = 'revue_manuelle';
        else if (metaOk) decision = 'meta_only';

        processedEvents.push({
          id: ev.id,
          nom_event: ev.nom_event,
          slug: ev.slug,
          public_url: ev.slug ? `/events/${ev.slug}` : null,
          score: ev.enrichissement_score,
          niveau: ev.enrichissement_niveau,
          meta_status: metaStatus ?? null,
          description_done: descOk,
          auto_validation_status: autoVal ?? null,
          auto_validation_score: result?.auto_validation_score ?? null,
          validation_mode: result?.validation_mode ?? null,
          enrichissement_statut: result?.enrichissement_statut ?? null,
          decision,
          warnings: result?.auto_validation_warnings ?? null,
          error: metaErr ? (result?.reason ?? `HTTP ${resp.status}`) : null,
          meta_reason: result?.reason ?? null,
          desc_reason: result?.description_enrichie_reason ?? null,
          desc_status: descStatus ?? null,
        });

        if (metaOk || descOk) {
          successCount++;
        } else if (metaErr) {
          failCount++;
          errorEvents.push({ id: ev.id, nom_event: ev.nom_event, reason: result?.reason ?? `HTTP ${resp.status}` });
        } else if (metaSkipped) {
          skippedCount++;
        } else {
          skippedCount++;
        }
      } catch (err) {
        failCount++;
        errorEvents.push({
          id: ev.id,
          nom_event: ev.nom_event,
          reason: err instanceof Error ? err.message : String(err),
        });
        processedEvents.push({
          id: ev.id,
          nom_event: ev.nom_event,
          slug: ev.slug,
          public_url: ev.slug ? `/events/${ev.slug}` : null,
          score: ev.enrichissement_score,
          niveau: ev.enrichissement_niveau,
          decision: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Re-fetch final DB state for processed events (canonical truth, in case enrich-event-meta
    // response shape misses some fields).
    if (processedIds.length > 0) {
      const { data: finalRows } = await supabase
        .from('events')
        .select('id, auto_validation_status, auto_validation_score, validation_mode, enrichissement_statut')
        .in('id', processedIds);
      const byId: Record<string, Record<string, unknown>> = {};
      for (const row of (finalRows ?? []) as Array<Record<string, unknown>>) {
        byId[row.id as string] = row;
      }
      for (const pe of processedEvents) {
        const row = byId[pe.id as string];
        if (!row) continue;
        if (pe.auto_validation_status == null) pe.auto_validation_status = row.auto_validation_status ?? null;
        if (pe.auto_validation_score == null) pe.auto_validation_score = row.auto_validation_score ?? null;
        if (pe.validation_mode == null) pe.validation_mode = row.validation_mode ?? null;
        if (pe.enrichissement_statut == null) pe.enrichissement_statut = row.enrichissement_statut ?? null;
      }
    }

    // Changement RÉELLEMENT visible côté pré-rendu public :
    //  - une meta_description_gen a été (re)générée → présente dans <head> public
    //  - OU au moins une description_enrichie a été auto-validée (statut 'valide')
    // Les descriptions restées en_attente NE changent rien côté public,
    // donc ne doivent pas déclencher de re-build Vercel.
    const publicChanged = metaDone > 0 || descAutoValidated > 0;

    // ─── Deploy hook policy ───
    // - run + deploy !== false + data changed → hook
    // - test + deploy === true + data changed → hook
    // - dry_run → never (already returned)
    let shouldDeploy = false;
    if (params.mode === 'run') {
      shouldDeploy = params.deploy !== false && publicChanged;
    } else if (params.mode === 'test') {
      shouldDeploy = params.deploy === true && publicChanged;
    }

    let deployTriggered = false;
    let deployStatus: number | null = null;
    let deployError: string | null = null;

    if (shouldDeploy) {
      if (!VERCEL_HOOK) {
        deployError = 'VERCEL_DEPLOY_HOOK_URL non configuré';
      } else {
        try {
          const r = await fetch(VERCEL_HOOK, { method: 'POST' });
          deployTriggered = true;
          deployStatus = r.status;
          try { await r.text(); } catch { /* ignore */ }
          if (!r.ok) deployError = `Vercel a renvoyé HTTP ${r.status}`;
        } catch (err) {
          deployError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    // ─── Final status ───
    const finalStatus =
      selected.length === 0 ? 'success' :
      failCount === selected.length ? 'failed' :
      failCount > 0 ? 'partial' : 'success';

    await supabase.from('seo_enrichment_runs').update({
      finished_at: new Date().toISOString(),
      status: finalStatus,
      events_processed: processedIds.length,
      events_success: successCount,
      events_failed: failCount,
      events_skipped: skippedCount,
      meta_done: metaDone,
      description_done: descDone,
      deploy_hook_triggered: deployTriggered,
      deploy_hook_status: deployStatus,
      deploy_hook_error: deployError,
      details: {
        mode: params.mode,
        limit: params.limit,
        deploy: params.deploy,
        trigger_source: params.trigger_source,
        processed_ids: processedIds,
        processed_events: processedEvents,
        errors: errorEvents,
        desc_auto_validated: descAutoValidated,
        desc_pending_review: descPending,
        public_changed: publicChanged,
      },
    }).eq('id', runId);

    return new Response(JSON.stringify({
      run_id: runId,
      mode: params.mode,
      status: finalStatus,
      events_selected: selected.length,
      events_processed: processedIds.length,
      events_success: successCount,
      events_failed: failCount,
      events_skipped: skippedCount,
      meta_done: metaDone,
      description_done: descDone,
      desc_auto_validated: descAutoValidated,
      desc_pending_review: descPending,
      public_changed: publicChanged,
      deploy_hook_triggered: deployTriggered,
      deploy_hook_status: deployStatus,
      deploy_hook_error: deployError,
      errors: errorEvents,
    }), { status: 200, headers: jsonHeaders });

  } catch (err) {
    console.error('[seo-enrichment-batch] fatal:', err);
    return new Response(JSON.stringify({
      error: 'Erreur interne',
      details: err instanceof Error ? err.message : String(err),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});