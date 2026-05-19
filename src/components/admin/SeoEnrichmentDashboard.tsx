import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Activity, RefreshCw, Loader2, PlayCircle, Beaker, Rocket, Zap,
  CheckCircle2, AlertTriangle, XCircle, Server, ChevronDown, ChevronUp,
  ExternalLink, ListChecks, Lightbulb, Calculator, ShieldQuestion,
  Info, Wrench, Moon,
} from 'lucide-react';
import { SeoEventDetailSheet, type ProcessedEventLite } from './SeoEventDetailSheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface EligibilityStats {
  total_eligible: number;
  no_meta: number;
  not_valide_status: number;
  no_description_enrichie: number;
  short_description: number;
}

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  trigger_source: string;
  events_selected: number | null;
  events_processed: number | null;
  events_success: number | null;
  events_failed: number | null;
  events_skipped: number | null;
  meta_done: number | null;
  description_done: number | null;
  deploy_hook_triggered: boolean | null;
  deploy_hook_status: number | null;
  deploy_hook_error: string | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
}

interface Counters {
  passed: number;
  pending: number;
  failed: number;
  null_score: number;
  score_ge_55: number;
  ready_for_batch: number;
  desc_missing: number;
  published: number;
}

interface StaleFailureInfo {
  runId: string;
  errorIds: string[];
  resolvedIds: string[];
  unresolvedIds: string[];
}

interface AutoFixableInfo {
  count: number;
  byReason: Record<string, number>;
  totalFailed: number;       // toutes les events en failed (y compris déjà validées manuellement)
  failedManual: number;      // failed mais déjà validées manuellement → exclues du correcteur
  failedNoDesc: number;      // failed mais description_enrichie null → rien à corriger
}

interface AutoFixResult {
  ranAt: string;
  processed: number;
  fixed: number;
  still_failed: number;
  errored: number;
  by_reason_before?: Record<string, number>;
  results?: Array<{
    event_id: string;
    nom_event: string | null;
    slug: string | null;
    status: string;
    reason?: string;
    before?: { status: string; score: number };
    after?: { status: string; score: number; decision?: string };
  }>;
  deploy_triggered?: boolean;
}

type BatchMode = 'dry_run' | 'test' | 'run';

function statusBadge(status: string) {
  switch (status) {
    case 'success':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" />Succès</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300"><AlertTriangle className="h-3 w-3 mr-1" />Partiel</Badge>;
    case 'failed':
      return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Échec</Badge>;
    case 'running':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En cours</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function triggerLabel(src: string): string {
  switch (src) {
    case 'manual': return 'Manuel';
    case 'cron': return 'Cron';
    case 'dry_run': return 'Dry-run';
    default: return src;
  }
}

function batchLabelFromRun(r: RunRow): string {
  const d = r.details ?? {};
  const mode = (d as Record<string, unknown>)['mode'] as string | undefined;
  const requested = ((d as Record<string, unknown>)['limit'] as number | undefined) ?? null;
  const sel = r.events_selected ?? 0;
  // Libellé basé sur le mode + limite demandée, pas sur ce qui a été réellement trouvé
  let base: string;
  if (mode === 'dry_run') base = `Dry-run ${requested ?? sel}`;
  else if (mode === 'test') base = `Batch test ${requested ?? sel}`;
  else if (mode === 'run') {
    const req = requested ?? sel;
    if (req <= 5) base = `Batch pilote ${req}`;
    else base = `Batch ${req}`;
  } else {
    base = `${triggerLabel(r.trigger_source)} ${requested ?? sel}`;
  }
  if (requested != null && requested !== sel) {
    return `${base} demandé — ${sel} événement${sel > 1 ? 's' : ''} réellement traitable${sel > 1 ? 's' : ''}`;
  }
  return base;
}

export function SeoEnrichmentDashboard() {
  const { toast } = useToast();
  const [eligibility, setEligibility] = useState<EligibilityStats | null>(null);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set());
  const [missingDescOpen, setMissingDescOpen] = useState(false);
  const [staleFailure, setStaleFailure] = useState<StaleFailureInfo | null>(null);
  const [autoFixable, setAutoFixable] = useState<AutoFixableInfo | null>(null);
  const [lastAutoFix, setLastAutoFix] = useState<AutoFixResult | null>(null);
  const [autoFixConfirmOpen, setAutoFixConfirmOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [eligibilityRes, runsRes, passedRes, pendingRes, failedRes, nullScoreRes, ge55Res, readyForBatchRes, descMissingRes, publishedRes] = await Promise.all([
        supabase.rpc('count_seo_enrichment_eligible'),
        supabase.from('seo_enrichment_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(15),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('auto_validation_status', 'passed').eq('validation_mode', 'auto'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('enrichissement_statut', 'en_attente'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('auto_validation_status', 'failed')
          .or('enrichissement_statut.is.null,enrichissement_statut.neq.valide')
          // Exclure les événements validés manuellement (statut=valide + mode=manual) :
          // l'admin a déjà résolu la situation, ils ne doivent plus être comptés "failed".
          .not('validation_mode', 'eq', 'manual'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).gte('date_debut', today)
          .is('enrichissement_score', null),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).gte('date_debut', today)
          .gte('enrichissement_score', 55),
        supabase.from('events').select('id, meta_description_gen, description_enrichie, enrichissement_statut, validation_mode')
          .eq('visible', true).eq('is_test', false).gte('date_debut', today)
          .not('slug', 'is', null).neq('slug', '')
          .gte('enrichissement_score', 55)
          .limit(1000),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).gte('date_debut', today)
          .is('description_enrichie', null),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('enrichissement_statut', 'valide'),
      ]);

      if (eligibilityRes.error) throw eligibilityRes.error;
      const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
      const descGeneratableStatuses = new Set([null, 'non_traite', 'done']);
      const readyForBatchCount = (readyForBatchRes.data ?? []).filter((row) => {
        const r = row as { meta_description_gen: string | null; description_enrichie: string | null; enrichissement_statut: string | null; validation_mode: string | null };
        // Un événement validé manuellement (admin a tranché) n'est plus traitable par le batch.
        if (r.enrichissement_statut === 'valide' && r.validation_mode === 'manual') return false;
        return !hasText(r.meta_description_gen)
          || (!hasText(r.description_enrichie) && descGeneratableStatuses.has(r.enrichissement_statut));
      }).length;
      setEligibility(eligibilityRes.data as unknown as EligibilityStats);
      setRuns((runsRes.data ?? []) as RunRow[]);
      setCounters({
        passed: passedRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        failed: failedRes.count ?? 0,
        null_score: nullScoreRes.count ?? 0,
        score_ge_55: ge55Res.count ?? 0,
        ready_for_batch: readyForBatchCount,
        desc_missing: descMissingRes.count ?? 0,
        published: publishedRes.count ?? 0,
      });

      // ─── Audit "erreurs corrigeables automatiquement" ───
      // Source unique : events futurs visibles avec auto_validation_status='failed',
      // pas déjà validés manuellement, et avec description_enrichie non null.
      const { data: failedRows } = await supabase
        .from('events')
        .select('id, validation_mode, enrichissement_statut, description_enrichie, auto_validation_report')
        .eq('visible', true).eq('is_test', false).gte('date_debut', today)
        .eq('auto_validation_status', 'failed')
        .limit(500);
      const allFailed = (failedRows ?? []) as Array<{
        id: string;
        validation_mode: string | null;
        enrichissement_statut: string | null;
        description_enrichie: string | null;
        auto_validation_report: Record<string, unknown> | null;
      }>;
      const fixable = allFailed.filter((r) => r.validation_mode !== 'manual' && !!r.description_enrichie);
      const byReason: Record<string, number> = {};
      for (const r of fixable) {
        const checks = (r.auto_validation_report?.['checks'] ?? []) as Array<{ code?: string; status?: string }>;
        const codes = Array.isArray(checks)
          ? [...new Set(checks.filter((c) => c?.status === 'fail').map((c) => c.code ?? 'unknown'))]
          : [];
        for (const c of codes) byReason[c] = (byReason[c] ?? 0) + 1;
      }
      setAutoFixable({
        count: fixable.length,
        byReason,
        totalFailed: allFailed.length,
        failedManual: allFailed.filter((r) => r.validation_mode === 'manual').length,
        failedNoDesc: allFailed.filter((r) => !r.description_enrichie).length,
      });

      // ─── Détection d'échec périmé ───
      // Si le dernier run non-dry_run est "failed" mais que tous les événements
      // listés en erreur sont maintenant résolus (statut=valide), on considère
      // l'échec comme historique et on ne bloque plus l'admin.
      const lastNonDry = (runsRes.data ?? []).find((r) => (r as RunRow).trigger_source !== 'dry_run') as RunRow | undefined;
      if (lastNonDry && lastNonDry.status === 'failed') {
        const errs = (lastNonDry.details as Record<string, unknown> | null)?.['errors'];
        const errorIds: string[] = Array.isArray(errs)
          ? (errs as Array<{ id?: string }>).map((e) => e?.id ?? '').filter(Boolean)
          : [];
        if (errorIds.length > 0) {
          const { data: errRows } = await supabase
            .from('events')
            .select('id, enrichissement_statut, validation_mode, meta_description_gen')
            .in('id', errorIds);
          const resolvedIds: string[] = [];
          const unresolvedIds: string[] = [];
          for (const id of errorIds) {
            const row = (errRows ?? []).find((r) => (r as { id: string }).id === id) as
              | { id: string; enrichissement_statut: string | null; validation_mode: string | null; meta_description_gen: string | null }
              | undefined;
            const resolved = !!row
              && row.enrichissement_statut === 'valide'
              && hasText(row.meta_description_gen);
            (resolved ? resolvedIds : unresolvedIds).push(id);
          }
          setStaleFailure({ runId: lastNonDry.id, errorIds, resolvedIds, unresolvedIds });
        } else {
          setStaleFailure(null);
        }
      } else {
        setStaleFailure(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur chargement', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('seo-enrichment-refresh', handler);
    return () => window.removeEventListener('seo-enrichment-refresh', handler);
  }, [fetchData]);

  const runBatch = async (mode: BatchMode, limit: number, deploy: boolean, key: string) => {
    setActionLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: {
          target: 'seo-enrichment-batch',
          payload: { mode, limit, deploy, trigger_source: 'manual' },
        },
      });
      if (error) throw error;
      const r = data as Record<string, unknown>;
      if (r?.error) throw new Error(String(r.error));
      if (mode === 'dry_run') {
        toast({
          title: '🧪 Dry-run terminé',
          description: `${r.selected_count ?? 0} sélectionné(s) sur ${r.total_eligible ?? 0} éligibles.`,
        });
      } else {
        const autoVal = (r.desc_auto_validated as number | undefined) ?? 0;
        const pendingRev = (r.desc_pending_review as number | undefined) ?? 0;
        toast({
          title: `✅ Batch ${mode} terminé`,
          description: `${r.events_processed ?? 0} traités, ${autoVal} publiés auto, ${pendingRev} en revue, ${r.events_failed ?? 0} échec(s) — Vercel ${r.deploy_hook_triggered ? 'déclenché' : 'non déclenché'}`,
        });
      }
      fetchData();
      window.dispatchEvent(new CustomEvent('seo-enrichment-refresh'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur batch', description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const runScoring = async () => {
    setActionLoading('score');
    try {
      const { data, error } = await supabase.rpc('score_events_batch', {
        p_limit: 20,
        p_dry_run: false,
        p_only_null: true,
      });
      if (error) throw error;
      const d = data as Record<string, unknown> | null;
      const processed = (d?.['processed'] as number | undefined) ?? 0;
      toast({
        title: '🧮 Scoring terminé',
        description: `${processed} événement(s) scoré(s).`,
      });
      fetchData();
      window.dispatchEvent(new CustomEvent('seo-enrichment-refresh'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur scoring', description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const runRevalidate = async () => {
    setActionLoading('reval');
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: {
          target: 'revalidate-enriched-description',
          payload: { dry_run: false, limit: 200 },
        },
      });
      if (error) throw error;
      const s = (data as { summary?: { auto_validated?: number; warning?: number; failed?: number; total?: number } })?.summary;
      toast({
        title: '🛡️ Re-validation terminée',
        description: `${s?.total ?? 0} évalué(s) — auto ${s?.auto_validated ?? 0}, warning ${s?.warning ?? 0}, failed ${s?.failed ?? 0}`,
      });
      fetchData();
      window.dispatchEvent(new CustomEvent('seo-enrichment-refresh'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur re-validation', description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const runAutoFixBatch = async () => {
    setActionLoading('autofix');
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: {
          target: 'seo-auto-fix-batch',
          payload: { limit: 5 },
        },
      });
      if (error) throw error;
      const r = data as AutoFixResult & { processed?: number; fixed?: number; still_failed?: number; errored?: number };
      toast({
        title: '🛠️ Correction automatique terminée',
        description: `${r.processed ?? 0} traité(s) — ${r.fixed ?? 0} corrigé(s), ${r.still_failed ?? 0} encore en échec, ${r.errored ?? 0} erreur(s).`,
      });
      setLastAutoFix({
        ranAt: new Date().toISOString(),
        processed: r.processed ?? 0,
        fixed: r.fixed ?? 0,
        still_failed: r.still_failed ?? 0,
        errored: r.errored ?? 0,
        by_reason_before: r.by_reason_before,
        results: r.results,
      });
      fetchData();
      window.dispatchEvent(new CustomEvent('seo-enrichment-refresh'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur correction auto', description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleRunDetails = (id: string) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const lastRun = runs.find((r) => r.trigger_source !== 'dry_run') ?? runs[0];
  const lastDeployRun = runs.find((r) => r.deploy_hook_triggered);
  const lastNonDryRuns = useMemo(() => runs.filter((r) => r.trigger_source !== 'dry_run'), [runs]);

  // ─── Évaluation des critères de passage au cron nocturne ───
  const cronReadiness = useMemo(() => {
    const last5 = lastNonDryRuns.slice(0, 5);
    const last3 = lastNonDryRuns.slice(0, 3);
    const successCount = last5.filter((r) => r.status === 'success').length;
    const technicalErrors = last5.filter((r) => r.status === 'failed').length;
    const autoValRate = (() => {
      if (last3.length === 0) return 0;
      let processed = 0; let autoVal = 0;
      for (const r of last3) {
        processed += r.events_processed ?? 0;
        const d = (r.details ?? {}) as Record<string, unknown>;
        autoVal += (d['desc_auto_validated'] as number | undefined) ?? 0;
      }
      if (processed === 0) return 0;
      return autoVal / processed;
    })();
    const checks = [
      { key: 'success3', label: '≥ 3 batchs réussis (5 derniers)', ok: successCount >= 3, detail: `${successCount}/5` },
      { key: 'no_tech_err', label: 'Aucun échec technique (5 derniers)', ok: technicalErrors === 0, detail: `${technicalErrors} échec(s)` },
      { key: 'auto_rate', label: 'Taux auto-validation ≥ 70 % (3 derniers)', ok: autoValRate >= 0.7, detail: `${Math.round(autoValRate * 100)}%` },
      { key: 'few_failed', label: 'Moins de 20 textes en échec validation', ok: (counters?.failed ?? 0) < 20, detail: `${counters?.failed ?? 0}` },
      { key: 'no_null_score', label: 'Aucun événement sans score', ok: (counters?.null_score ?? 0) === 0, detail: `${counters?.null_score ?? 0}` },
      { key: 'deploy_ok', label: 'Dernier déploiement Vercel sans erreur', ok: !!lastDeployRun && !lastDeployRun.deploy_hook_error, detail: lastDeployRun ? (lastDeployRun.deploy_hook_error ? 'erreur' : 'ok') : '—' },
    ];
    const ready = checks.every((c) => c.ok);
    return { ready, checks };
  }, [lastNonDryRuns, counters, lastDeployRun]);

  // ─── Recommandation ───
  const recommendation = useMemo(() => {
    if (!counters || !eligibility) return null;
    // Cas B — dernier run failed ET au moins un événement encore non résolu
    const failureStillBlocking = lastRun
      && lastRun.status === 'failed'
      && (!staleFailure || staleFailure.unresolvedIds.length > 0);
    if (failureStillBlocking) {
      return {
        tone: 'red' as const,
        title: 'Le dernier run a échoué. Corrige l’erreur avant de relancer.',
        cta: {
          label: 'Voir le détail de l’erreur',
          onClick: () => {
            setExpandedRunIds((prev) => new Set(prev).add(lastRun.id));
            document.getElementById('seo-runs-history')?.scrollIntoView({ behavior: 'smooth' });
          },
        },
      };
    }
    // Cas B-bis — échec historique mais tous les événements en erreur sont maintenant résolus
    if (lastRun && lastRun.status === 'failed' && staleFailure && staleFailure.unresolvedIds.length === 0) {
      return {
        tone: 'emerald' as const,
        title: `Les ${staleFailure.resolvedIds.length} événement(s) du dernier run en échec ont été corrigés manuellement. Tu peux relancer un batch.`,
        cta: { label: 'Lancer Batch 20', onClick: () => runBatch('run', 20, true, 'big') },
      };
    }
    // Cas A — erreurs réellement corrigeables automatiquement
    if ((autoFixable?.count ?? 0) >= 1) {
      const n = Math.min(autoFixable!.count, 5);
      return {
        tone: 'amber' as const,
        title: `${autoFixable!.count} description${autoFixable!.count > 1 ? 's en échec sont corrigeables' : ' en échec est corrigeable'} automatiquement.`,
        cta: {
          label: `Corriger automatiquement ${n} erreur${n > 1 ? 's' : ''}`,
          onClick: () => setAutoFixConfirmOpen(true),
        },
      };
    }
    // Cas A-bis — quelques textes à vérifier manuellement
    if (counters.pending > 0 || counters.failed > 0) {
      const total = counters.pending + counters.failed;
      return {
        tone: 'amber' as const,
        title: `${total} description${total > 1 ? 's nécessitent' : ' nécessite'} une vérification manuelle avant de lancer un nouveau gros batch.`,
        cta: {
          label: 'Voir les textes à vérifier',
          onClick: () => document.getElementById('seo-validation')?.scrollIntoView({ behavior: 'smooth' }),
        },
      };
    }
    // Cas C — beaucoup d'événements sans score
    if (counters.null_score >= 10) {
      return {
        tone: 'blue' as const,
        title: `${counters.null_score} événements n’ont pas encore de score SEO. Il est recommandé de scorer 20 événements.`,
        cta: { label: 'Scorer 20 événements', onClick: runScoring },
      };
    }
    // Cas E — prudence : aucun batch pilote récent
    const recentPilots = lastNonDryRuns.filter((r) => (r.events_selected ?? 0) <= 5).length;
    const recentLargeRuns = lastNonDryRuns.filter((r) => (r.events_selected ?? 0) >= 10 && r.status === 'success').length;
    if (recentPilots < 2 && recentLargeRuns === 0 && counters.ready_for_batch > 0) {
      return {
        tone: 'blue' as const,
        title: 'Le système est stable, mais il est recommandé de lancer encore un Batch pilote 5 avant Batch 20.',
        cta: { label: 'Lancer Batch pilote 5', onClick: () => runBatch('run', 5, true, 'pilot') },
      };
    }
    // Cas D — système stable, propose batch 20
    if (lastRun && lastRun.status === 'success' && counters.ready_for_batch > 0) {
      // Si tous les critères cron sont remplis, suggère la préparation du cron
      if (cronReadiness.ready) {
        return {
          tone: 'emerald' as const,
          title: 'Tous les critères sont remplis. Le système est prêt pour le cron nocturne.',
          cta: {
            label: 'Préparer activation cron',
            onClick: () => document.getElementById('seo-cron-readiness')?.scrollIntoView({ behavior: 'smooth' }),
          },
        };
      }
      return {
        tone: 'emerald' as const,
        title: 'Le dernier batch a réussi. Tu peux lancer un batch de 20 événements.',
        cta: { label: 'Lancer Batch 20', onClick: () => runBatch('run', 20, true, 'big') },
      };
    }
    return {
      tone: 'slate' as const,
      title: 'Rien d’urgent. Lance un dry-run pour voir les prochains événements éligibles.',
      cta: { label: 'Dry-run 20', onClick: () => runBatch('dry_run', 20, false, 'dry') },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counters, eligibility, lastRun, lastNonDryRuns, staleFailure, cronReadiness, autoFixable]);

  // ─── Statut global ───
  const globalStatus: { label: string; tone: 'emerald' | 'amber' | 'red' } = useMemo(() => {
    if (lastRun?.status === 'failed' && (!staleFailure || staleFailure.unresolvedIds.length > 0)) {
      return { label: 'Erreur', tone: 'red' };
    }
    if ((counters?.pending ?? 0) > 0 || (counters?.failed ?? 0) > 0) return { label: 'Attention', tone: 'amber' };
    return { label: 'OK', tone: 'emerald' };
  }, [lastRun, counters, staleFailure]);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      {/* ─── Bloc 0 — Action recommandée maintenant ─── */}
      {recommendation && (
        <Card className={`border-2 ${
          recommendation.tone === 'red' ? 'border-red-300 bg-red-50/50' :
          recommendation.tone === 'amber' ? 'border-amber-300 bg-amber-50/50' :
          recommendation.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50/50' :
          recommendation.tone === 'blue' ? 'border-blue-300 bg-blue-50/50' :
          'border-slate-300 bg-slate-50/50'
        }`}>
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <Lightbulb className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                recommendation.tone === 'red' ? 'text-red-600' :
                recommendation.tone === 'amber' ? 'text-amber-600' :
                recommendation.tone === 'emerald' ? 'text-emerald-600' :
                recommendation.tone === 'blue' ? 'text-blue-600' :
                'text-slate-600'
              }`} />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Action recommandée maintenant</div>
                <div className="text-base font-medium">{recommendation.title}</div>
              </div>
            </div>
            <Button onClick={recommendation.cta.onClick} disabled={!!actionLoading} size="lg">
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {recommendation.cta.label}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Bloc 1 — Actions SEO ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Actions SEO
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            Toutes les actions de pilotage de l'enrichissement, regroupées au même endroit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <ActionTile
              icon={<Beaker className="h-4 w-4" />}
              title="Dry-run 20"
              description="Voir les prochains événements sans rien modifier."
              onClick={() => runBatch('dry_run', 20, false, 'dry')}
              loading={actionLoading === 'dry'}
              disabled={!!actionLoading}
              variant="outline"
            />
            <ActionTile
              icon={<PlayCircle className="h-4 w-4" />}
              title="Batch test 2"
              description="Tester sur 2 événements, sans risque."
              onClick={() => runBatch('test', 2, false, 'test')}
              loading={actionLoading === 'test'}
              disabled={!!actionLoading}
              variant="outline"
            />
            <ActionTile
              icon={<Rocket className="h-4 w-4" />}
              title="Batch pilote 5"
              description="Générer 5 descriptions et publier automatiquement celles qui sont sûres."
              onClick={() => runBatch('run', 5, true, 'pilot')}
              loading={actionLoading === 'pilot'}
              disabled={!!actionLoading}
              variant="default"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={!!actionLoading || (counters?.ready_for_batch ?? 0) === 0}
                  className="text-left border-2 border-red-200 hover:border-red-300 bg-red-50/30 rounded-lg p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2 font-medium text-red-900">
                    {actionLoading === 'big' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Batch 20
                  </div>
                  <div className="text-xs text-red-700 mt-1">
                    Traitement plus large. À utiliser quand les derniers batchs sont propres.
                    {typeof counters?.ready_for_batch === 'number' && (
                      <div className="mt-1 font-medium">
                        {counters.ready_for_batch} événement(s) vraiment traitable(s) — score ≥ 55 + texte manquant.
                        {counters.ready_for_batch === 0 && <> Aucun nouveau texte à générer maintenant.</>}
                        {counters.ready_for_batch < 20 && counters.null_score > 0 && (
                          <> Lancez « Scorer 20 événements » pour en débloquer davantage.</>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer le lancement d'un batch de 20 événements ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va générer jusqu'à 20 descriptions enrichies + meta et déclenchera Vercel si du contenu public change.
                    Consomme des crédits Claude.
                    {typeof counters?.ready_for_batch === 'number' && (
                      <>
                        {' '}Actuellement, <strong>{counters.ready_for_batch} événement(s)</strong> ont un score ≥ 55 et une meta ou description manquante.
                        Le batch en traitera jusqu'à 20. Les événements déjà publiés ne sont pas repris.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => runBatch('run', 20, true, 'big')}>
                    Lancer le batch 20
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <ActionTile
              icon={<Calculator className="h-4 w-4" />}
              title="Scorer 20 événements"
              description="Attribuer un score aux événements sans score."
              onClick={runScoring}
              loading={actionLoading === 'score'}
              disabled={!!actionLoading}
              variant="outline"
            />
            <ActionTile
              icon={<ShieldQuestion className="h-4 w-4" />}
              title="Revalider les textes"
              description="Rejouer le contrôle qualité sans générer de nouveau texte."
              onClick={runRevalidate}
              loading={actionLoading === 'reval'}
              disabled={!!actionLoading}
              variant="outline"
            />
            <AutoFixActionTile
              autoFixable={autoFixable}
              loading={actionLoading === 'autofix'}
              disabled={!!actionLoading}
              onClick={() => setAutoFixConfirmOpen(true)}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Le Deploy Hook Vercel n'est déclenché que si la meta a été (re)générée ou si au moins une description a été auto-validée.
          </p>
        </CardContent>
      </Card>

      {/* ─── Bloc 2 — Compteurs en 4 familles ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiFamily
          title="À traiter"
          tone="blue"
          items={[
            { label: 'Total incomplets', value: eligibility?.total_eligible, hint: 'Indicateur large : événements futurs avec au moins un signal incomplet. Ce n’est pas le nombre que Batch 20 va traiter.' },
            { label: 'Score ≥ 55', value: counters?.score_ge_55, hint: 'Événements suffisamment prioritaires, y compris ceux déjà publiés.' },
            { label: 'Traitables par Batch 20', value: counters?.ready_for_batch, hint: 'Score ≥ 55 et meta ou description enrichie manquante. Ce compteur correspond au maximum réellement traitable par batch.' },
            { label: 'Sans score', value: counters?.null_score, hint: 'Score NULL = événements pas encore priorisés.' },
            { label: 'Description manquante', value: eligibility?.no_description_enrichie, hint: 'Cliquez pour voir la liste et traiter chaque événement manuellement.', onClick: () => setMissingDescOpen(true) },
          ]}
        />
        <KpiFamily
          title="Publiés"
          tone="emerald"
          items={[
            { label: 'Pages publiées', value: counters?.published, hint: 'Descriptions visibles publiquement après rebuild Vercel.' },
            { label: 'Auto-validés', value: counters?.passed, hint: 'Validés automatiquement par le contrôle qualité.' },
          ]}
        />
        <KpiFamily
          title="À vérifier"
          tone="amber"
          items={[
            { label: 'En attente revue', value: counters?.pending, hint: 'Texte généré mais pas publié, en attente de relecture.' },
            { label: 'Validation failed', value: counters?.failed, hint: 'Textes en échec automatique qui ne sont pas déjà validés manuellement.' },
            { label: 'À corriger auto.', value: autoFixable?.count ?? 0, hint: 'Textes en échec, non validés manuellement, avec description enrichie présente. Ce sont les seuls que le correcteur automatique peut traiter.' },
          ]}
        />
        <KpiFamily
          title="Système"
          tone={globalStatus.tone}
          items={[
            { label: 'Statut global', valueText: globalStatus.label },
            { label: 'Dernier run', valueText: lastRun ? formatDateTime(lastRun.started_at) : '—' },
            { label: 'Dernier déploiement Vercel', valueText: lastDeployRun ? formatDateTime(lastDeployRun.started_at) : '—' },
          ]}
        />
      </div>

      {/* ─── Bloc 2.5 — Erreurs corrigeables automatiquement ─── */}
      <AutoFixableSection
        info={autoFixable}
        loading={actionLoading === 'autofix'}
        disabled={!!actionLoading}
        onLaunch={() => setAutoFixConfirmOpen(true)}
      />

      {/* ─── Bloc 2.6 — Résultat de la dernière correction automatique ─── */}
      {lastAutoFix && (
        <LastAutoFixCard result={lastAutoFix} />
      )}

      {/* ─── Bloc 3 — Résultat de la dernière action ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Résultat de la dernière action
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lastRun ? (
            <LastActionSummary run={lastRun} />
          ) : (
            <p className="text-sm text-muted-foreground">Aucun run enregistré pour l'instant.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Bloc 4 — Historique des runs (replié par défaut visuellement) ─── */}
      <Card id="seo-runs-history">
        <CardHeader>
          <CardTitle className="text-base">Historique des runs (15 derniers)</CardTitle>
          <CardDescription>Pour comprendre l'historique. Les actions principales sont en haut de page.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun run enregistré.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-2 py-2 font-medium">Date</th>
                    <th className="text-left px-2 py-2 font-medium">Source</th>
                    <th className="text-left px-2 py-2 font-medium">Statut</th>
                    <th className="text-right px-2 py-2 font-medium">Sél.</th>
                    <th className="text-right px-2 py-2 font-medium">OK</th>
                    <th className="text-right px-2 py-2 font-medium">Échec</th>
                    <th className="text-right px-2 py-2 font-medium">Skip</th>
                    <th className="text-right px-2 py-2 font-medium">Meta</th>
                    <th className="text-right px-2 py-2 font-medium">Desc.</th>
                    <th className="text-right px-2 py-2 font-medium">Auto-val.</th>
                    <th className="text-right px-2 py-2 font-medium">Revue</th>
                    <th className="text-left px-2 py-2 font-medium">Vercel</th>
                    <th className="text-right px-2 py-2 font-medium">Durée</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.map((r) => {
                    const expanded = expandedRunIds.has(r.id);
                    const details = r.details ?? {};
                    const autoVal = (details['desc_auto_validated'] as number | undefined) ?? null;
                    const pendingRev = (details['desc_pending_review'] as number | undefined) ?? null;
                    const publicChanged = details['public_changed'] as boolean | undefined;
                    return (
                      <Fragment key={r.id}>
                        <tr className="hover:bg-muted/30">
                          <td className="px-2 py-1.5 whitespace-nowrap">{formatDateTime(r.started_at)}</td>
                          <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{r.trigger_source}</Badge></td>
                          <td className="px-2 py-1.5">{statusBadge(r.status)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{r.events_selected ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{r.events_success ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-red-700">{r.events_failed ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.events_skipped ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{r.meta_done ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{r.description_done ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{autoVal ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{pendingRev ?? '—'}</td>
                          <td className="px-2 py-1.5">
                            {r.deploy_hook_triggered ? (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                                {r.deploy_hook_status ?? '?'}
                              </Badge>
                            ) : publicChanged === false ? (
                              <span className="text-muted-foreground">aucun changement</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatDuration(r.started_at, r.finished_at)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => toggleRunDetails(r.id)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Détails JSON"
                            >
                              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={14} className="px-3 py-2">
                              {r.deploy_hook_error && (
                                <div className="text-red-700 mb-1">Vercel : {r.deploy_hook_error}</div>
                              )}
                              {r.error_message && (
                                <div className="text-red-700 mb-1">Erreur : {r.error_message}</div>
                              )}
                              <pre className="text-[10px] leading-relaxed bg-background border rounded p-2 max-h-72 overflow-auto">
                                {JSON.stringify(r.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <MissingDescriptionsDialog
        open={missingDescOpen}
        onOpenChange={setMissingDescOpen}
      />

      {/* ─── Bloc 5 — Préparation cron nocturne ─── */}
      <Card id="seo-cron-readiness" className={cronReadiness.ready ? 'border-emerald-300' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Prêt pour cron nocturne :{' '}
            <Badge className={cronReadiness.ready ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>
              {cronReadiness.ready ? 'Oui' : 'Non'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Cette section ne fait que mesurer la maturité du système. Aucun cron n'est créé tant que tu ne confirmes pas explicitement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1.5 text-sm">
            {cronReadiness.checks.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                {c.ok
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                <span className={c.ok ? '' : 'text-muted-foreground'}>{c.label}</span>
                <span className="text-xs text-muted-foreground ml-auto tabular-nums">{c.detail}</span>
              </li>
            ))}
          </ul>
          <div className="border-t pt-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuration cible (non activée)</div>
            <pre className="text-[11px] leading-relaxed bg-muted/30 border rounded p-2">{`fréquence : 1× par nuit (03:00 UTC)
limit     : 20
mode      : run
deploy    : true
trigger   : cron`}</pre>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!cronReadiness.ready}
                variant={cronReadiness.ready ? 'default' : 'outline'}
              >
                <Moon className="h-4 w-4 mr-2" />
                Préparer activation cron
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer l'activation du cron SEO automatique ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action installerait un job pg_cron exécutant Batch 20 chaque nuit avec déploiement Vercel automatique.
                  Dans cette phase, l'activation reste désactivée : confirme uniquement si tu veux qu'on prépare la migration cron dans un prochain message.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => toast({
                    title: 'Préparation cron à faire dans un prochain message',
                    description: 'Aucune modification n\'a été effectuée. Demande explicitement « active le cron SEO » pour que la migration soit créée.',
                  })}
                >
                  J'ai noté
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}

// ──────────────────────────────────────────────────────────
// Composants internes
// ──────────────────────────────────────────────────────────

function ActionTile({
  icon, title, description, onClick, loading, disabled, variant,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  variant: 'default' | 'outline';
}) {
  const base = variant === 'default'
    ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
    : 'hover:bg-muted/40';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left border-2 rounded-lg p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${base}`}
    >
      <div className="flex items-center gap-2 font-medium">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {title}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </button>
  );
}

interface KpiItem {
  label: string;
  value?: number | null;
  valueText?: string;
  hint?: string;
  onClick?: () => void;
}

function KpiFamily({
  title, tone, items,
}: {
  title: string;
  tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate';
  items: KpiItem[];
}) {
  const toneClasses: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/40',
    emerald: 'border-emerald-200 bg-emerald-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
    red: 'border-red-200 bg-red-50/40',
    slate: 'border-slate-200 bg-slate-50/40',
  };
  const titleTone: Record<string, string> = {
    blue: 'text-blue-800',
    emerald: 'text-emerald-800',
    amber: 'text-amber-800',
    red: 'text-red-800',
    slate: 'text-slate-800',
  };
  return (
    <div className={`border-2 rounded-lg p-4 ${toneClasses[tone]}`}>
      <div className={`text-sm font-semibold mb-3 ${titleTone[tone]}`}>{title}</div>
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.label}
            className={`flex items-center justify-between gap-2 text-sm ${it.onClick ? 'cursor-pointer hover:bg-white/60 rounded px-1 -mx-1 transition-colors' : ''}`}
            onClick={it.onClick}
            role={it.onClick ? 'button' : undefined}
            tabIndex={it.onClick ? 0 : undefined}
            onKeyDown={it.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') it.onClick?.(); } : undefined}
          >
            <span className="text-muted-foreground flex items-center gap-1 min-w-0">
              <span className={`truncate ${it.onClick ? 'underline decoration-dotted underline-offset-2' : ''}`}>{it.label}</span>
              {it.hint && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 opacity-50 flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{it.hint}</TooltipContent>
                </Tooltip>
              )}
            </span>
            <span className="font-semibold tabular-nums">
              {it.valueText ?? (it.value ?? '—')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Dialog : liste des événements sans description_enrichie
// ──────────────────────────────────────────────────────────
function MissingDescriptionsDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [rows, setRows] = useState<Array<{
    id: string; nom_event: string | null; slug: string | null; ville: string | null;
    date_debut: string | null; enrichissement_score: number | null;
    enrichissement_statut: string | null; meta_description_gen: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ProcessedEventLite | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('events')
      .select('id, nom_event, slug, ville, date_debut, enrichissement_score, enrichissement_statut, meta_description_gen')
      .eq('visible', true).eq('is_test', false).gte('date_debut', today)
      .is('description_enrichie', null)
      .order('enrichissement_score', { ascending: false, nullsFirst: false })
      .order('date_debut', { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (!error) setRows((data ?? []) as typeof rows);
        setLoading(false);
      });
  }, [open, refreshKey]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('seo-enrichment-refresh', handler);
    return () => window.removeEventListener('seo-enrichment-refresh', handler);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Événements sans description enrichie</DialogTitle>
            <DialogDescription>
              {loading ? 'Chargement…' : `${rows.length} événement(s) futur(s) sans description enrichie. Cliquez sur « Voir détail » pour les traiter (générer, corriger ou valider manuellement).`}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-2 font-medium">Événement</th>
                  <th className="text-left px-2 py-2 font-medium">Ville</th>
                  <th className="text-left px-2 py-2 font-medium">Date</th>
                  <th className="text-right px-2 py-2 font-medium">Score</th>
                  <th className="text-left px-2 py-2 font-medium">Statut</th>
                  <th className="text-left px-2 py-2 font-medium">Meta</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-2 py-1.5 max-w-[280px]">
                      <div className="font-medium truncate">{r.nom_event ?? r.id}</div>
                      {r.slug && <div className="text-[10px] text-muted-foreground truncate">/events/{r.slug}</div>}
                    </td>
                    <td className="px-2 py-1.5 truncate max-w-[120px]">{r.ville ?? '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.date_debut ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.enrichissement_score ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5">
                      {r.enrichissement_statut === 'error'
                        ? <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]">error</Badge>
                        : r.enrichissement_statut
                          ? <Badge variant="outline" className="text-[10px]">{r.enrichissement_statut}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.meta_description_gen
                        ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        : <XCircle className="h-3 w-3 text-red-500" />}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Button
                        size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                        onClick={() => setSelected({ id: r.id, nom_event: r.nom_event, slug: r.slug })}
                      >
                        Voir détail
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">Aucun événement sans description enrichie.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
      <SeoEventDetailSheet
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        processed={selected}
      />
    </>
  );
}

interface ProcessedEvent {
  id: string;
  nom_event?: string | null;
  slug?: string | null;
  score?: number | null;
  niveau?: string | null;
  description_done?: boolean | null;
  meta_status?: string | null;
  auto_validation_status?: string | null;
  auto_validation_score?: number | null;
  validation_mode?: string | null;
  enrichissement_statut?: string | null;
  decision?: string | null;
  warnings?: unknown;
  error?: string | null;
  meta_reason?: string | null;
  desc_reason?: string | null;
}

function decisionBadge(decision?: string | null) {
  switch (decision) {
    case 'publie_auto':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Publié auto</Badge>;
    case 'publie_manuelle':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Validé</Badge>;
    case 'revue_manuelle':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />En revue</Badge>;
    case 'failed':
    case 'failed_validation':
      return <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Échec</Badge>;
    case 'meta_only':
      return <Badge variant="outline" className="text-[10px]">Meta uniquement</Badge>;
    case 'skipped':
      return <Badge variant="outline" className="text-[10px]">Skippé</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{decision ?? '—'}</Badge>;
  }
}

function whatToDo(decision?: string | null): { label: string; tone: 'emerald' | 'amber' | 'red' | 'slate' } {
  switch (decision) {
    case 'publie_auto': return { label: 'Rien à faire', tone: 'emerald' };
    case 'publie_manuelle': return { label: 'Rien à faire', tone: 'emerald' };
    case 'meta_only': return { label: 'Rien à faire', tone: 'emerald' };
    case 'revue_manuelle': return { label: 'Ouvrir le détail pour relire', tone: 'amber' };
    case 'failed':
    case 'failed_validation': return { label: 'Ouvrir le détail pour corriger', tone: 'red' };
    case 'skipped': return { label: 'Voir pourquoi', tone: 'slate' };
    default: return { label: '—', tone: 'slate' };
  }
}

function whatToDoBadge(decision?: string | null) {
  const { label, tone } = whatToDo(decision);
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  return <Badge className={`${cls[tone]} text-[10px]`}>{label}</Badge>;
}

function LastActionSummary({ run }: { run: RunRow }) {
  const details = run.details ?? {};
  const autoVal = (details['desc_auto_validated'] as number | undefined) ?? 0;
  const pendingRev = (details['desc_pending_review'] as number | undefined) ?? 0;
  const processedEvents = Array.isArray(details['processed_events'])
    ? (details['processed_events'] as ProcessedEvent[])
    : null;
  const processedIds = !processedEvents && Array.isArray(details['processed_ids'])
    ? (details['processed_ids'] as string[])
    : null;

  return (
    <div className="space-y-4">
      <div className="text-sm space-y-1">
        <div>
          <span className="text-muted-foreground">Dernière action : </span>
          <span className="font-medium">{batchLabelFromRun(run)}</span>
          <span className="text-muted-foreground"> · {formatDateTime(run.started_at)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Résultat : </span>
          <span className="font-medium">
            {run.events_processed ?? 0} traité{(run.events_processed ?? 0) > 1 ? 's' : ''},{' '}
            {autoVal} publié{autoVal > 1 ? 's' : ''} automatiquement,{' '}
            {pendingRev} à vérifier,{' '}
            {run.events_failed ?? 0} erreur{(run.events_failed ?? 0) > 1 ? 's' : ''}.
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Vercel : </span>
          {run.deploy_hook_triggered ? (
            <span className="font-medium text-blue-700">déclenché avec succès (HTTP {run.deploy_hook_status ?? '?'}).</span>
          ) : (details['public_changed'] === false ? (
            <span className="text-muted-foreground">non déclenché (aucun changement public).</span>
          ) : (
            <span className="text-muted-foreground">non déclenché.</span>
          ))}
        </div>
      </div>

      {processedEvents && processedEvents.length > 0 && (
        <ProcessedEventsTable events={processedEvents} />
      )}
      {processedIds && processedIds.length > 0 && (
        <ProcessedFallback ids={processedIds} />
      )}
    </div>
  );
}

function ProcessedEventsTable({ events }: { events: ProcessedEvent[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = events.find((e) => e.id === openId) ?? null;
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-2 py-2 font-medium">Événement</th>
              <th className="text-right px-2 py-2 font-medium">Score</th>
              <th className="text-left px-2 py-2 font-medium">Décision</th>
              <th className="text-left px-2 py-2 font-medium">Que faire&nbsp;?</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20">
                <td className="px-2 py-1.5 max-w-[280px]">
                  <div className="font-medium truncate">{e.nom_event ?? e.id}</div>
                  {e.slug && <div className="text-[10px] text-muted-foreground truncate">/events/{e.slug}</div>}
                  {e.error && <div className="text-[10px] text-red-700 truncate" title={e.error}>{e.error}</div>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {e.score ?? '—'}
                  {e.niveau && <div className="text-[10px] text-muted-foreground">{e.niveau}</div>}
                </td>
                <td className="px-2 py-1.5">{decisionBadge(e.decision)}</td>
                <td className="px-2 py-1.5">{whatToDoBadge(e.decision)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setOpenId(e.id)}
                    >
                      Voir détail
                    </Button>
                    {e.slug && (
                      <a
                        href={`/events/${e.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                        title="Voir page publique"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SeoEventDetailSheet
        open={!!openId}
        onOpenChange={(o) => { if (!o) setOpenId(null); }}
        processed={selected as ProcessedEventLite | null}
      />
    </div>
  );
}

function ProcessedFallback({ ids }: { ids: string[] }) {
  const [rows, setRows] = useState<Array<{
    id: string; nom_event: string | null; slug: string | null;
    enrichissement_score: number | null; enrichissement_niveau: string | null;
    enrichissement_statut: string | null; auto_validation_status: string | null;
    auto_validation_score: number | null; validation_mode: string | null;
  }>>([]);
  useEffect(() => {
    let cancelled = false;
    supabase.from('events')
      .select('id, nom_event, slug, enrichissement_score, enrichissement_niveau, enrichissement_statut, auto_validation_status, auto_validation_score, validation_mode')
      .in('id', ids)
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as typeof rows);
      });
    return () => { cancelled = true; };
  }, [ids]);
  const events: ProcessedEvent[] = rows.map((r) => {
    const autoVal = r.auto_validation_status;
    const statut = r.enrichissement_statut;
    let decision = 'skipped';
    if (statut === 'valide' && autoVal === 'passed' && r.validation_mode === 'auto') decision = 'publie_auto';
    else if (statut === 'valide' && r.validation_mode === 'manual') decision = 'publie_manuelle';
    else if (autoVal === 'warning') decision = 'revue_manuelle';
    else if (autoVal === 'failed') decision = 'failed_validation';
    else if (statut === 'en_attente') decision = 'revue_manuelle';
    else if (statut === 'valide') decision = 'publie_auto';
    return {
      id: r.id,
      nom_event: r.nom_event,
      slug: r.slug,
      score: r.enrichissement_score,
      niveau: r.enrichissement_niveau,
      description_done: true,
      auto_validation_status: autoVal,
      auto_validation_score: r.auto_validation_score,
      validation_mode: r.validation_mode,
      enrichissement_statut: statut,
      decision,
    };
  });
  if (events.length === 0) return null;
  return <ProcessedEventsTable events={events} />;
}
