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

function scoreEvent(ev: CandidateEvent, hasParticipations: boolean): number {
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

function isEligible(e: CandidateEvent): boolean {
  return (
    !e.meta_description_gen ||
    !e.enrichissement_statut || e.enrichissement_statut !== 'valide' ||
    !e.description_enrichie ||
    (e.description_event ?? '').length < 500
  );
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
      .select('id, id_event, nom_event, slug, ville, secteur, date_debut, meta_description_gen, description_enrichie, enrichissement_statut, description_event')
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

    // ─── Fetch participation counts (priority signal) ───
    const idEvents = eligible.map((e) => e.id_event).filter((x): x is string => !!x);
    const participationsByEvent: Record<string, number> = {};
    if (idEvents.length > 0) {
      const { data: parts } = await supabase
        .from('participation')
        .select('id_event')
        .in('id_event', idEvents);
      for (const p of (parts ?? []) as Array<{ id_event: string }>) {
        participationsByEvent[p.id_event] = (participationsByEvent[p.id_event] ?? 0) + 1;
      }
    }

    eligible.sort((a, b) => {
      const sa = scoreEvent(a, (participationsByEvent[a.id_event ?? ''] ?? 0) > 0);
      const sb = scoreEvent(b, (participationsByEvent[b.id_event ?? ''] ?? 0) > 0);
      if (sb !== sa) return sb - sa;
      return (a.date_debut ?? '9999-12-31').localeCompare(b.date_debut ?? '9999-12-31');
    });

    const selected = eligible.slice(0, params.limit);

    // ─── DRY RUN — no DB write, no deploy ───
    if (params.mode === 'dry_run') {
      return new Response(JSON.stringify({
        mode: 'dry_run',
        total_eligible: eligible.length,
        selected_count: selected.length,
        selected: selected.map((e) => ({
          id: e.id,
          slug: e.slug,
          nom_event: e.nom_event,
          ville: e.ville,
          date_debut: e.date_debut,
          has_participations: (participationsByEvent[e.id_event ?? ''] ?? 0) > 0,
          score: scoreEvent(e, (participationsByEvent[e.id_event ?? ''] ?? 0) > 0),
          reasons: {
            no_meta: !e.meta_description_gen,
            status_not_valid: !e.enrichissement_statut || e.enrichissement_statut !== 'valide',
            no_description_enrichie: !e.description_enrichie,
            short_description: (e.description_event ?? '').length < 500,
          },
        })),
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
    const errorEvents: Array<{ id: string; nom_event: string; reason: string }> = [];
    let metaDone = 0;
    let descDone = 0;
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
        const metaSkipped = metaStatus === 'skipped';
        const metaErr = metaStatus === 'error' || !resp.ok;

        if (metaOk) metaDone++;
        if (descOk) descDone++;

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
      }
    }

    const dataChanged = metaDone > 0 || descDone > 0;

    // ─── Deploy hook policy ───
    // - run + deploy !== false + data changed → hook
    // - test + deploy === true + data changed → hook
    // - dry_run → never (already returned)
    let shouldDeploy = false;
    if (params.mode === 'run') {
      shouldDeploy = params.deploy !== false && dataChanged;
    } else if (params.mode === 'test') {
      shouldDeploy = params.deploy === true && dataChanged;
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
        errors: errorEvents,
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