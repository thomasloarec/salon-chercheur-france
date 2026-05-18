import { Fragment, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Activity, RefreshCw, Loader2, PlayCircle, Beaker, Rocket, Zap,
  CheckCircle2, AlertTriangle, XCircle, Server, ChevronDown, ChevronUp,
  ExternalLink, Settings, ListChecks,
} from 'lucide-react';

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

interface ValidationCounts {
  passed: number;
  pending: number;
  failed: number;
  null_score: number;
  score_ge_55: number;
  desc_missing: number;
  published: number;
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

export function SeoEnrichmentDashboard() {
  const { toast } = useToast();
  const [eligibility, setEligibility] = useState<EligibilityStats | null>(null);
  const [validationCounts, setValidationCounts] = useState<ValidationCounts | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [eligibilityRes, runsRes, passedRes, pendingRes, failedRes, nullScoreRes, ge55Res, descMissingRes, publishedRes] = await Promise.all([
        supabase.rpc('count_seo_enrichment_eligible'),
        supabase.from('seo_enrichment_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(15),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('auto_validation_status', 'passed').eq('validation_mode', 'auto'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .or('enrichissement_statut.eq.en_attente,validation_mode.eq.manual'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('auto_validation_status', 'failed'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).gte('date_debut', today)
          .is('enrichissement_score', null),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).gte('date_debut', today)
          .gte('enrichissement_score', 55),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).gte('date_debut', today)
          .is('description_enrichie', null),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('enrichissement_statut', 'valide'),
      ]);

      if (eligibilityRes.error) throw eligibilityRes.error;
      setEligibility(eligibilityRes.data as unknown as EligibilityStats);
      setRuns((runsRes.data ?? []) as RunRow[]);
      setValidationCounts({
        passed: passedRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        failed: failedRes.count ?? 0,
        null_score: nullScoreRes.count ?? 0,
        score_ge_55: ge55Res.count ?? 0,
        desc_missing: descMissingRes.count ?? 0,
        published: publishedRes.count ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur chargement', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      if (r?.error) {
        throw new Error(String(r.error));
      }
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

  const toggleRunDetails = (id: string) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const lastRun = runs[0];
  const lastDeployRun = runs.find((r) => r.deploy_hook_triggered);

  return (
    <div className="space-y-6">
      {/* Bloc 1 — Résumé global */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Pilotage enrichissement SEO
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            Vue d'ensemble du pipeline : scoring, génération IA, validation automatique et publication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Eligibility KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Total éligibles" value={eligibility?.total_eligible} tone="blue" />
            <Kpi label="Score NULL" value={validationCounts?.null_score} tone="slate" />
            <Kpi label="Score ≥ 55" value={validationCounts?.score_ge_55} tone="emerald" />
            <Kpi label="Description manquante" value={eligibility?.no_description_enrichie} tone="amber" />
            <Kpi label="Meta manquante" value={eligibility?.no_meta} tone="amber" />
            <Kpi label="Description courte" value={eligibility?.short_description} tone="slate" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Auto-validés (passed)" value={validationCounts?.passed} tone="emerald" />
            <Kpi label="En attente revue" value={validationCounts?.pending} tone="amber" />
            <Kpi label="Validation failed" value={validationCounts?.failed} tone="red" />
            <Kpi label="Pages publiées" value={validationCounts?.published} tone="emerald" />
          </div>

          {/* Last run summary */}
          <div className="border rounded-lg p-4 bg-muted/30 text-sm space-y-1">
            <div className="font-medium flex items-center gap-2">
              <Server className="h-4 w-4" /> Dernier run
            </div>
            {lastRun ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(lastRun.status)}
                  <Badge variant="outline">{lastRun.trigger_source}</Badge>
                  <span className="text-muted-foreground">{formatDateTime(lastRun.started_at)}</span>
                  <span className="text-muted-foreground">· durée {formatDuration(lastRun.started_at, lastRun.finished_at)}</span>
                </div>
                <div className="text-muted-foreground">
                  {lastRun.events_processed ?? 0}/{lastRun.events_selected ?? 0} traités —
                  {' '}{lastRun.events_success ?? 0} succès, {lastRun.events_failed ?? 0} échec(s)
                </div>
                <div className="text-muted-foreground">
                  Dernier déploiement Vercel :{' '}
                  {lastDeployRun
                    ? `${formatDateTime(lastDeployRun.started_at)} (HTTP ${lastDeployRun.deploy_hook_status ?? '?'})`
                    : 'aucun dans l\'historique récent'}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Aucun run enregistré pour l'instant.</p>
            )}
          </div>

          {/* Détail du dernier run — événements traités */}
          {lastRun && Array.isArray((lastRun.details ?? {})['processed_events'])
            && ((lastRun.details ?? {})['processed_events'] as unknown[]).length > 0 && (
            <LastRunProcessedEvents
              events={(lastRun.details as Record<string, unknown>)['processed_events'] as ProcessedEvent[]}
              deployTriggered={!!lastRun.deploy_hook_triggered}
            />
          )}
          {lastRun && !Array.isArray((lastRun.details ?? {})['processed_events'])
            && Array.isArray((lastRun.details ?? {})['processed_ids'])
            && ((lastRun.details ?? {})['processed_ids'] as unknown[]).length > 0 && (
            <LastRunProcessedFallback
              ids={(lastRun.details as Record<string, unknown>)['processed_ids'] as string[]}
              deployTriggered={!!lastRun.deploy_hook_triggered}
            />
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Actions manuelles</div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!!actionLoading}
                onClick={() => runBatch('dry_run', 20, false, 'dry')}
              >
                {actionLoading === 'dry' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Beaker className="h-4 w-4 mr-2" />}
                Dry-run (20)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!!actionLoading}
                onClick={() => runBatch('test', 2, false, 'test')}
              >
                {actionLoading === 'test' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                Batch test (2)
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!!actionLoading}
                onClick={() => runBatch('run', 5, true, 'pilot')}
              >
                {actionLoading === 'pilot' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                Batch pilote (5)
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={!!actionLoading}>
                    {actionLoading === 'big' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                    Batch 20
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer le lancement d'un batch de 20 événements ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action va générer jusqu'à 20 descriptions enrichies + meta et déclenchera Vercel si du contenu public change.
                      Consomme des crédits Claude.
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
            </div>
            <p className="text-xs text-muted-foreground">
              Le Deploy Hook Vercel n'est déclenché que si la meta a été (re)générée ou si au moins une description a été auto-validée.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bloc 2 — Historique des runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des runs (15 derniers)</CardTitle>
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
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | null | undefined; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate' }) {
  const toneClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${toneClasses[tone]}`}>
      <div className="text-2xl font-bold tabular-nums">{value ?? '—'}</div>
      <div className="text-[11px] opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

interface ProcessedEvent {
  id: string;
  nom_event?: string | null;
  slug?: string | null;
  public_url?: string | null;
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
}

function decisionBadge(decision?: string | null) {
  switch (decision) {
    case 'publie_auto':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Publié auto</Badge>;
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

function LastRunProcessedEvents({ events, deployTriggered }: { events: ProcessedEvent[]; deployTriggered: boolean }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-2 text-sm font-medium flex items-center gap-2">
        <ListChecks className="h-4 w-4" />
        Événements traités lors du dernier run ({events.length})
        {deployTriggered && (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] ml-auto">Vercel déclenché</Badge>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/20">
            <tr>
              <th className="text-left px-2 py-2 font-medium">Événement</th>
              <th className="text-right px-2 py-2 font-medium">Score</th>
              <th className="text-left px-2 py-2 font-medium">Desc.</th>
              <th className="text-left px-2 py-2 font-medium">Auto-val.</th>
              <th className="text-left px-2 py-2 font-medium">Mode</th>
              <th className="text-left px-2 py-2 font-medium">Statut</th>
              <th className="text-left px-2 py-2 font-medium">Décision</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20">
                <td className="px-2 py-1.5 max-w-[240px]">
                  <div className="font-medium truncate">{e.nom_event ?? e.id}</div>
                  {e.slug && <div className="text-[10px] text-muted-foreground truncate">/events/{e.slug}</div>}
                  {e.error && <div className="text-[10px] text-red-700 truncate" title={e.error}>{e.error}</div>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {e.score ?? '—'}
                  {e.niveau && <div className="text-[10px] text-muted-foreground">{e.niveau}</div>}
                </td>
                <td className="px-2 py-1.5">{e.description_done ? '✅' : '—'}</td>
                <td className="px-2 py-1.5">
                  {e.auto_validation_status
                    ? `${e.auto_validation_status}${e.auto_validation_score != null ? ` (${e.auto_validation_score})` : ''}`
                    : '—'}
                </td>
                <td className="px-2 py-1.5">{e.validation_mode ?? '—'}</td>
                <td className="px-2 py-1.5">{e.enrichissement_statut ?? '—'}</td>
                <td className="px-2 py-1.5">{decisionBadge(e.decision)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
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
                    <a
                      href={`/admin/events/${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                      title="Fiche admin"
                    >
                      <Settings className="h-3 w-3" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Fallback for older runs that only stored processed_ids — fetch event names live. */
function LastRunProcessedFallback({ ids, deployTriggered }: { ids: string[]; deployTriggered: boolean }) {
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
  return <LastRunProcessedEvents events={events} deployTriggered={deployTriggered} />;
}