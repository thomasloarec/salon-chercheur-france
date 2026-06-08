import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';

/**
 * Edge Function: seo-auto-fix-batch
 *
 * Boucle sur les événements futurs visibles dont la dernière validation
 * automatique est en `failed` (et qui ne sont pas déjà validés manuellement),
 * puis appelle `seo-auto-fix-description` pour chacun. Retourne un rapport
 * `{ processed, fixed, still_failed, by_reason, results }`.
 *
 * Garde-fous : reprend les règles du correcteur unitaire (jamais d'invention,
 * suppression ou reformulation seulement). Aucun déclenchement Vercel ici.
 *
 * Auth : header x-seo-batch-secret (même que les autres fonctions SEO).
 * Body : { limit?: number (default 5, max 20), dry_run?: boolean }
 */

interface FixResult {
  event_id: string;
  nom_event: string | null;
  slug: string | null;
  status: 'fixed' | 'still_failed' | 'no_change' | 'error';
  before?: { status: string; score: number };
  after?: { status: string; score: number; decision?: string };
  reason?: string;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors instanceof Response) return cors;
  const headers = { ...buildCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST requis' }), { status: 405, headers });
  }

  const BATCH_SECRET = Deno.env.get('SEO_BATCH_SECRET') ?? '';
  if (!BATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'SEO_BATCH_SECRET non configuré' }), { status: 500, headers });
  }
  if ((req.headers.get('x-seo-batch-secret') ?? '') !== BATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { limit?: number; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const limit = Math.min(Math.max(body.limit ?? 5, 1), 20);
  const dryRun = body.dry_run === true;

  // Sélection des candidats : futurs visibles, failed, non manuellement validés,
  // avec description_enrichie non vide.
  const today = new Date().toISOString().slice(0, 10);
  const { data: candidates, error: selErr } = await supabase
    .from('events')
    .select('id, nom_event, slug, auto_validation_report, validation_mode, enrichissement_statut')
    .eq('visible', true).eq('is_test', false).gte('date_debut', today)
    .eq('auto_validation_status', 'failed')
    .not('description_enrichie', 'is', null)
    .neq('validation_mode', 'manual')
    .order('auto_validated_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }), { status: 500, headers });
  }

  const eligible = (candidates ?? []) as Array<{
    id: string;
    nom_event: string | null;
    slug: string | null;
    auto_validation_report: Record<string, unknown> | null;
    validation_mode: string | null;
    enrichissement_statut: string | null;
  }>;

  // Distribution AVANT pour le rapport
  const beforeReasons: Record<string, number> = {};
  for (const ev of eligible) {
    const checks = (ev.auto_validation_report?.['checks'] ?? []) as Array<{ code?: string; status?: string }>;
    const codes = Array.isArray(checks)
      ? [...new Set(checks.filter((c) => c?.status === 'fail').map((c) => c.code ?? 'unknown'))]
      : [];
    for (const c of codes) beforeReasons[c] = (beforeReasons[c] ?? 0) + 1;
  }

  if (dryRun) {
    return new Response(JSON.stringify({
      dry_run: true,
      processed: 0,
      candidates: eligible.length,
      by_reason_before: beforeReasons,
      candidate_ids: eligible.map((e) => e.id),
    }, null, 2), { status: 200, headers });
  }

  const results: FixResult[] = [];
  let fixed = 0;
  let stillFailed = 0;
  let errored = 0;

  for (const ev of eligible) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/seo-auto-fix-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'x-seo-batch-secret': BATCH_SECRET,
        },
        body: JSON.stringify({ event_id: ev.id }),
      });
      const text = await r.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(text); } catch { /* ignore */ }

      if (!r.ok) {
        errored += 1;
        results.push({
          event_id: ev.id, nom_event: ev.nom_event, slug: ev.slug,
          status: 'error', reason: (parsed.error as string) ?? text.slice(0, 200),
        });
        continue;
      }

      const summary = parsed.summary as { fixed?: boolean; reason?: string; after?: { status?: string; score?: number; decision?: string }; before?: { status?: string; score?: number } } | undefined;
      if (summary && summary.fixed === false) {
        results.push({
          event_id: ev.id, nom_event: ev.nom_event, slug: ev.slug,
          status: 'no_change', reason: summary.reason,
        });
        continue;
      }

      const afterStatus = summary?.after?.status ?? 'unknown';
      const beforeStatus = summary?.before?.status ?? 'failed';
      const beforeScore = summary?.before?.score ?? 0;
      const afterScore = summary?.after?.score ?? 0;
      const isFixed = summary?.after?.decision === 'auto_validate' || afterStatus === 'passed';
      if (isFixed) fixed += 1; else stillFailed += 1;
      results.push({
        event_id: ev.id, nom_event: ev.nom_event, slug: ev.slug,
        status: isFixed ? 'fixed' : 'still_failed',
        before: { status: beforeStatus, score: beforeScore },
        after: { status: afterStatus, score: afterScore, decision: summary?.after?.decision },
      });
    } catch (err) {
      errored += 1;
      results.push({
        event_id: ev.id, nom_event: ev.nom_event, slug: ev.slug,
        status: 'error', reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new Response(JSON.stringify({
    processed: eligible.length,
    fixed,
    still_failed: stillFailed,
    errored,
    by_reason_before: beforeReasons,
    results,
  }, null, 2), { status: 200, headers });
});