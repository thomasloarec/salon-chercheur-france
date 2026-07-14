import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle, XCircle, Loader2, RefreshCw, Rocket,
  ChevronDown, ChevronUp, FileCheck, AlertTriangle,
  Pencil, Save, X, ShieldCheck, ShieldAlert, Sparkles, ShieldQuestion,
  ExternalLink, Settings, Wand2, Archive, Info
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import type { SeoQualityResult } from '@/lib/seoQuality';

interface PendingEvent {
  id: string;
  nom_event: string;
  slug: string | null;
  ville: string | null;
  date_debut: string | null;
  enrichissement_score: number | null;
  description_enrichie: string | null;
  enrichissement_statut: string | null;
  auto_validation_status: string | null;
  auto_validation_score: number | null;
  auto_validation_report: AutoValidationReport | null;
  validation_mode: string | null;
  seo_quality_score: number | null;
  seo_quality_report: SeoQualityResult | null;
}

interface AutoValidationCheck {
  code: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  blocker: boolean;
  penalty: number;
  details?: string;
  evidence?: string[];
}

interface AutoValidationReport {
  status: 'passed' | 'warning' | 'failed';
  score: number;
  decision: 'auto_validate' | 'manual_review';
  reason: string;
  checks: AutoValidationCheck[];
  blockers: string[];
  warnings: string[];
  stats: { char_count: number; word_count: number; min_words_required: number };
  ignored_for_now?: boolean;
}

type FilterValue = 'to_fix' | 'to_review' | 'last_run' | 'published' | 'ignored';

interface Stats {
  pending: number;
  validated: number;
  eligibleUntreated: number;
  totalFuture: number;
}

export function EnrichedDescriptionValidation() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ pending: 0, validated: 0, eligibleUntreated: 0, totalFuture: 0 });
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('to_fix');
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateOneId, setRevalidateOneId] = useState<string | null>(null);
  const [lastRunIds, setLastRunIds] = useState<Set<string>>(new Set());
  const [autoFixId, setAutoFixId] = useState<string | null>(null);
  const [ignoreId, setIgnoreId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, validRes, eligibleRes, futureRes, eventsRes, lastRunRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true })
          .or('enrichissement_statut.eq.en_attente,validation_mode.eq.manual'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('enrichissement_statut', 'valide'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .in('enrichissement_statut', ['non_traite', 'done'])
          .gte('enrichissement_score', 55)
          .is('description_enrichie', null)
          .gt('date_debut', today),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .gt('date_debut', today),
        supabase.from('events')
          .select('id, nom_event, slug, ville, date_debut, enrichissement_score, description_enrichie, enrichissement_statut, auto_validation_status, auto_validation_score, auto_validation_report, validation_mode, seo_quality_score, seo_quality_report')
          .not('description_enrichie', 'is', null)
          .in('enrichissement_statut', ['en_attente', 'valide'])
          .order('enrichissement_score', { ascending: false })
          .limit(100),
        supabase.from('seo_enrichment_runs')
          .select('details')
          .neq('trigger_source', 'dry_run')
          .order('started_at', { ascending: false })
          .limit(1),
      ]);

      setStats({
        pending: pendingRes.count ?? 0,
        validated: validRes.count ?? 0,
        eligibleUntreated: eligibleRes.count ?? 0,
        totalFuture: futureRes.count ?? 0,
      });
      setEvents((eventsRes.data ?? []).map((e) => ({
        ...e,
        auto_validation_report: (e.auto_validation_report ?? null) as unknown as AutoValidationReport | null,
        seo_quality_score: (e as { seo_quality_score?: number | null }).seo_quality_score ?? null,
        seo_quality_report: ((e as { seo_quality_report?: unknown }).seo_quality_report ?? null) as unknown as SeoQualityResult | null,
      })) as PendingEvent[]);
      const lastDetails = lastRunRes.data?.[0]?.details as Record<string, unknown> | undefined;
      const ids = (lastDetails?.processed_ids as string[] | undefined) ?? [];
      setLastRunIds(new Set(ids));
    } catch (e) {
      console.error('Fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Global refresh — triggered by dashboard actions
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('seo-enrichment-refresh', handler);
    return () => window.removeEventListener('seo-enrichment-refresh', handler);
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startEditing = (ev: PendingEvent) => {
    setEditingId(ev.id);
    setEditText(ev.description_enrichie ?? '');
    setExpandedIds(prev => new Set(prev).add(ev.id));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (id: string) => {
    setSaveLoading(true);
    const { error } = await supabase.from('events')
      .update({ description_enrichie: editText })
      .eq('id', id);
    setSaveLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '💾 Description modifiée' });
      setEvents(prev => prev.map(e => e.id === id ? { ...e, description_enrichie: editText } : e));
      setEditingId(null);
      setEditText('');
    }
  };

  const updateStatus = async (id: string, status: 'valide' | 'rejete') => {
    setActionLoading(id);
    const { error } = await supabase.from('events').update({ enrichissement_statut: status }).eq('id', id);
    setActionLoading(null);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: status === 'valide' ? '✅ Validé' : '❌ Rejeté' });
      setEvents(prev => prev.filter(e => e.id !== id));
      setStats(prev => ({
        ...prev,
        pending: prev.pending - 1,
        validated: status === 'valide' ? prev.validated + 1 : prev.validated,
      }));
    }
  };

  const bulkValidate = async () => {
    setBulkLoading(true);
    const { error, count } = await supabase
      .from('events')
      .update({ enrichissement_statut: 'valide' })
      .eq('enrichissement_statut', 'en_attente');
    setBulkLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `✅ ${count ?? stats.pending} événements validés` });
      fetchData();
    }
  };

  const launchEnrichment = async () => {
    setEnrichLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-event-meta', {
        body: { batch_desc_enrichie: true, limit: 10 },
      });
      if (error) throw error;
      const results = data as { total?: number; done?: number; errors?: number; skipped?: number };
      toast({
        title: '📝 Descriptions enrichies générées',
        description: `${results.done ?? 0} générées, ${results.skipped ?? 0} ignorées, ${results.errors ?? 0} erreurs sur ${results.total ?? 0} éligibles.`,
      });
      fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setEnrichLoading(false);
    }
  };

  const scoreBadge = (score: number | null) => {
    if (score == null) return <Badge variant="outline">—</Badge>;
    if (score >= 65) return <Badge className="bg-green-100 text-green-800 border-green-300">{score}</Badge>;
    if (score >= 55) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{score}</Badge>;
    return <Badge variant="outline">{score}</Badge>;
  };

  const autoValidationBadge = (ev: PendingEvent) => {
    const s = ev.auto_validation_status;
    const score = ev.auto_validation_score;
    if (!s) return <Badge variant="outline" className="text-xs">Non auto-validé</Badge>;
    if (s === 'passed' && ev.validation_mode === 'auto') {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs"><ShieldCheck className="h-3 w-3 mr-1" />Validé auto · {score}/100</Badge>;
    }
    if (s === 'warning') {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />À relire · {score}/100</Badge>;
    }
    if (s === 'failed') {
      return <Badge className="bg-red-100 text-red-800 border-red-300 text-xs"><ShieldAlert className="h-3 w-3 mr-1" />Échec · {score}/100</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{s} · {score ?? '?'}/100</Badge>;
  };

  const seoQualityBadge = (ev: PendingEvent) => {
    const s = ev.seo_quality_score;
    if (s == null) return <Badge variant="outline" className="text-xs">SEO —</Badge>;
    if (s >= 80) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">SEO Super · {s}/100</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">SEO Alerte · {s}/100</Badge>;
  };

  const checkLabelToBadge = (code: string): string => {
    switch (code) {
      case 'numbers_grounded': return 'Chiffre non vérifié';
      case 'date_consistency': return 'Date incohérente';
      case 'city_consistency': return 'Ville incorrecte';
      case 'venue_consistency': return 'Lieu incorrect';
      case 'exhibitors_grounded': return 'Exposant non sourcé';
      case 'price_invented': return 'Tarif inventé';
      case 'program_invented': return 'Programme non sourcé';
      case 'length_min': return 'Texte trop court';
      case 'superlatives': return 'Superlatif non sourcé';
      case 'commercial_promise': return 'Promesse commerciale';
      case 'generic_text': return 'Texte trop générique';
      case 'repetition': return 'Répétitions';
      case 'fake_faq': return 'FAQ artificielle';
      default: return code;
    }
  };

  const reValidateAll = async () => {
    setRevalidating(true);
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
        description: `${s?.total ?? 0} évalué(s) — auto: ${s?.auto_validated ?? 0}, warning: ${s?.warning ?? 0}, failed: ${s?.failed ?? 0}`,
      });
      fetchData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setRevalidating(false);
    }
  };

  const reValidateOne = async (eventId: string) => {
    setRevalidateOneId(eventId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: {
          target: 'revalidate-enriched-description',
          payload: { dry_run: false, event_ids: [eventId] },
        },
      });
      if (error) throw error;
      const s = (data as { summary?: { auto_validated?: number; warning?: number; failed?: number } })?.summary;
      toast({
        title: '🛡️ Revalidé',
        description: `auto: ${s?.auto_validated ?? 0}, warning: ${s?.warning ?? 0}, failed: ${s?.failed ?? 0}`,
      });
      fetchData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setRevalidateOneId(null);
    }
  };

  const autoFix = async (eventId: string) => {
    setAutoFixId(eventId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: {
          target: 'seo-auto-fix-description',
          payload: { event_id: eventId },
        },
      });
      if (error) throw error;
      const s = (data as { summary?: { fixed?: boolean; after?: { status?: string; decision?: string } } })?.summary;
      if (s?.fixed) {
        toast({
          title: '🪄 Correction appliquée',
          description: `Nouveau statut : ${s.after?.status ?? '?'} (${s.after?.decision ?? '?'})`,
        });
      } else {
        toast({ title: 'Aucune correction nécessaire' });
      }
      fetchData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Erreur correction', description: msg, variant: 'destructive' });
    } finally {
      setAutoFixId(null);
    }
  };

  const ignoreForNow = async (ev: PendingEvent) => {
    setIgnoreId(ev.id);
    const report = (ev.auto_validation_report ?? {}) as AutoValidationReport;
    const newReport = { ...report, ignored_for_now: true };
    const { error } = await supabase.from('events')
      .update({
        auto_validation_report: newReport as never,
        validation_mode: 'manual',
      })
      .eq('id', ev.id);
    setIgnoreId(null);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🗄️ Ignoré', description: 'Disponible dans l\'onglet « Archivés / ignorés ».' });
      setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, auto_validation_report: newReport, validation_mode: 'manual' } : e));
    }
  };

  const unignore = async (ev: PendingEvent) => {
    setIgnoreId(ev.id);
    const report = (ev.auto_validation_report ?? {}) as AutoValidationReport;
    const { ignored_for_now: _omit, ...rest } = report;
    void _omit;
    const { error } = await supabase.from('events')
      .update({ auto_validation_report: rest as never })
      .eq('id', ev.id);
    setIgnoreId(null);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '↩️ Réintégré dans la file' });
      setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, auto_validation_report: rest as AutoValidationReport } : e));
    }
  };

  /** Génère une explication humaine pour un check en échec ou warning. */
  const explainCheck = (c: AutoValidationCheck, ev: PendingEvent): string => {
    const ev_ = (s: string | null) => s ?? '—';
    const evid = (c.evidence ?? []).slice(0, 3).join(', ');
    switch (c.code) {
      case 'city_consistency':
        return `Ville incorrecte : le texte mentionne « ${evid} », mais l'événement est à ${ev_(ev.ville)}.`;
      case 'venue_consistency':
        return `Lieu incorrect : le texte mentionne un autre lieu (« ${evid} »).`;
      case 'date_consistency':
        return `Date incohérente : année(s) « ${evid} » absente(s) des dates source.`;
      case 'numbers_grounded':
        return `Chiffre non vérifié : « ${evid} » n'est pas présent dans les données source (visiteurs, exposants, m²…).`;
      case 'price_invented':
        return `Tarif inventé : le texte mentionne un prix alors qu'aucun tarif n'est connu en base.`;
      case 'program_invented':
        return `Programme inventé : ${c.details ?? 'horaires, ateliers ou intervenants non présents en base'}.`;
      case 'exhibitors_grounded':
        return `Exposant non sourcé : « ${evid} » cité comme exposant mais absent de la liste officielle.`;
      case 'length_min':
        return c.status === 'fail' ? `Texte trop court : ${c.details ?? ''}` : `Texte un peu court (${c.details ?? ''}).`;
      case 'superlatives':
        return `Style à améliorer : superlatifs non sourcés (${evid}).`;
      case 'generic_text':
        return `Texte trop générique : à reformuler pour gagner en précision.`;
      case 'repetition':
        return `Répétitions détectées.`;
      case 'fake_faq':
        return `FAQ artificielle.`;
      case 'commercial_promise':
        return `Promesse commerciale à reformuler.`;
      default:
        return c.details ?? c.label ?? c.code;
    }
  };

  const filteredEvents = events.filter((ev) => {
    const isIgnored = ev.auto_validation_report?.ignored_for_now === true;
    const failChecks = ev.auto_validation_report?.checks?.filter((c) => c.status === 'fail' && c.blocker) ?? [];
    const warnChecks = ev.auto_validation_report?.checks?.filter((c) => c.status === 'warning') ?? [];
    const isManuallyValidated = ev.enrichissement_statut === 'valide' && ev.validation_mode === 'manual';
    const hasBlocker = !isManuallyValidated && (failChecks.length > 0 || ev.auto_validation_status === 'failed');
    const hasWarning = !isManuallyValidated && (warnChecks.length > 0 || ev.auto_validation_status === 'warning');
    const isPublished = ev.enrichissement_statut === 'valide'
      && ((ev.auto_validation_status === 'passed' && ev.validation_mode === 'auto') || ev.validation_mode === 'manual');
    switch (filter) {
      case 'to_fix':
        return !isIgnored && hasBlocker;
      case 'to_review':
        return !isIgnored && !hasBlocker && hasWarning;
      case 'last_run':
        return lastRunIds.has(ev.id);
      case 'published':
        return isPublished;
      case 'ignored':
        return isIgnored;
      default: return true;
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2" id="seo-validation">
            <FileCheck className="h-5 w-5" />
            Textes à vérifier manuellement
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Boîte de réception des actions.</strong> Par défaut, seuls les textes <em>à corriger</em> sont affichés.</p>
          <p className="flex items-start gap-1.5"><Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> « Relancer le contrôle qualité » ne valide pas automatiquement les textes : cette action relance uniquement les contrôles. Les textes avec erreurs restent à corriger.</p>
        </div>

        {/* 2. Filtres */}
        <div className="flex flex-wrap gap-2 items-center">
          {(() => {
            const counts = events.reduce((acc, e) => {
              const isIgnored = e.auto_validation_report?.ignored_for_now === true;
              const failChecks = e.auto_validation_report?.checks?.filter((c) => c.status === 'fail' && c.blocker) ?? [];
              const warnChecks = e.auto_validation_report?.checks?.filter((c) => c.status === 'warning') ?? [];
              const isManuallyValidated = e.enrichissement_statut === 'valide' && e.validation_mode === 'manual';
              const hasBlocker = !isManuallyValidated && (failChecks.length > 0 || e.auto_validation_status === 'failed');
              const hasWarning = !isManuallyValidated && (warnChecks.length > 0 || e.auto_validation_status === 'warning');
              if (isIgnored) acc.ignored++;
              else if (hasBlocker) acc.to_fix++;
              else if (hasWarning) acc.to_review++;
              if (lastRunIds.has(e.id)) acc.last_run++;
              if (e.enrichissement_statut === 'valide' && ((e.auto_validation_status === 'passed' && e.validation_mode === 'auto') || e.validation_mode === 'manual')) acc.published++;
              return acc;
            }, { to_fix: 0, to_review: 0, last_run: 0, published: 0, ignored: 0 });
            return ([
              ['to_fix', `À corriger (${counts.to_fix})`],
              ['to_review', `À relire (${counts.to_review})`],
              ['last_run', `Dernier run (${counts.last_run})`],
              ['published', `Déjà publiés (${counts.published})`],
              ['ignored', `Archivés / ignorés (${counts.ignored})`],
            ] as Array<[FilterValue, string]>);
          })().map(([val, label]) => (
            <Button
              key={val}
              size="sm"
              variant={filter === val ? 'default' : 'outline'}
              onClick={() => setFilter(val)}
              className="text-xs"
            >
              {label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={reValidateAll}
            disabled={revalidating}
            className="text-xs ml-auto"
            title="Relance les contrôles qualité sur tous les textes. Ne valide pas automatiquement."
          >
            {revalidating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Relancer le contrôle qualité
          </Button>
        </div>

        {/* 3. Liste */}
        {filteredEvents.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun événement dans cette catégorie.
          </p>
        )}

        {filteredEvents.length > 0 && (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredEvents.map(ev => {
              const expanded = expandedIds.has(ev.id);
              const isEditing = editingId === ev.id;
              const preview = ev.description_enrichie?.slice(0, 200) ?? '';
              const hasMore = (ev.description_enrichie?.length ?? 0) > 200;
              const report = ev.auto_validation_report;
              const failedCodes = report?.checks?.filter(c => c.status === 'fail').map(c => c.code) ?? [];
              const warningCodes = report?.checks?.filter(c => c.status === 'warning').map(c => c.code) ?? [];
              const issueChecks = report?.checks?.filter(c => c.status === 'fail' || c.status === 'warning') ?? [];
              const isIgnored = report?.ignored_for_now === true;
              const fixableCodes = new Set(['city_consistency','venue_consistency','date_consistency','numbers_grounded','price_invented','program_invented','exhibitors_grounded','superlatives']);
              const canAutoFix = issueChecks.some(c => fixableCodes.has(c.code));
              return (
                <div key={ev.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.slug ? (
                          <a
                            href={`/events/${ev.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {ev.nom_event}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="font-medium">{ev.nom_event}</span>
                        )}
                        <a
                          href={`/admin/events/${ev.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                          title="Fiche admin"
                        >
                          <Settings className="h-3 w-3" /> admin
                        </a>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[ev.ville, ev.date_debut].filter(Boolean).join(' · ')}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {autoValidationBadge(ev)}
                        {ev.enrichissement_statut === 'valide' && (
                          <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">Publié</Badge>
                        )}
                        {failedCodes.map(c => (
                          <Badge key={c} className="bg-red-50 text-red-700 border-red-200 text-xs">{checkLabelToBadge(c)}</Badge>
                        ))}
                        {warningCodes.map(c => (
                          <Badge key={c} className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{checkLabelToBadge(c)}</Badge>
                        ))}
                        {isIgnored && (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-xs"><Archive className="h-3 w-3 mr-1" />Ignoré</Badge>
                        )}
                      </div>
                    </div>
                    {scoreBadge(ev.enrichissement_score)}
                  </div>

                  {issueChecks.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs space-y-1">
                      <div className="font-medium text-amber-900 flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5" /> Pourquoi ce texte est dans la file ?
                      </div>
                      <ul className="space-y-0.5 text-amber-900/90">
                        {issueChecks.slice(0, 5).map((c, i) => (
                          <li key={`${c.code}-${i}`} className="flex gap-1.5">
                            <span className="opacity-60">•</span>
                            <span>{explainCheck(c, ev)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={12}
                        className="text-sm font-mono"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveEdit(ev.id)}
                          disabled={saveLoading}
                          className="text-xs"
                        >
                          {saveLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                          Enregistrer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing} className="text-xs">
                          <X className="h-3 w-3 mr-1" /> Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground whitespace-pre-line">
                        {expanded ? ev.description_enrichie : preview}
                        {hasMore && !expanded && '…'}
                      </div>
                      {hasMore && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => toggleExpand(ev.id)}>
                          {expanded ? <><ChevronUp className="h-3 w-3 mr-1" /> Réduire</> : <><ChevronDown className="h-3 w-3 mr-1" /> Voir tout</>}
                        </Button>
                      )}
                    </>
                  )}

                  <div className="flex gap-2 pt-1">
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-700 border-blue-300 hover:bg-blue-50"
                        onClick={() => startEditing(ev)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Modifier
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      disabled={actionLoading === ev.id}
                      onClick={() => updateStatus(ev.id, 'valide')}
                    >
                      {actionLoading === ev.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-300 hover:bg-red-50"
                      disabled={actionLoading === ev.id}
                      onClick={() => updateStatus(ev.id, 'rejete')}
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Rejeter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                      disabled={revalidateOneId === ev.id}
                      onClick={() => reValidateOne(ev.id)}
                      title="Relance les contrôles qualité sur ce texte"
                    >
                      {revalidateOneId === ev.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ShieldQuestion className="h-3 w-3 mr-1" />}
                      Relancer le contrôle
                    </Button>
                    {canAutoFix && !isIgnored && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-purple-700 border-purple-300 hover:bg-purple-50"
                        disabled={autoFixId === ev.id}
                        onClick={() => autoFix(ev.id)}
                        title="Relance l'IA avec un prompt correctif strict, sans inventer d'informations"
                      >
                        {autoFixId === ev.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                        Corriger automatiquement
                      </Button>
                    )}
                    {!isIgnored ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900"
                        disabled={ignoreId === ev.id}
                        onClick={() => ignoreForNow(ev)}
                        title="Sort cet événement de la file active sans le publier"
                      >
                        {ignoreId === ev.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Archive className="h-3 w-3 mr-1" />}
                        Ignorer pour l'instant
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900"
                        disabled={ignoreId === ev.id}
                        onClick={() => unignore(ev)}
                      >
                        {ignoreId === ev.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Réintégrer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. Bulk validate + 4. Launch wave */}
        <div className="flex flex-wrap gap-3 pt-2 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" disabled={stats.pending === 0 || bulkLoading}>
                {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Valider tous les textes en attente ({stats.pending})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tout valider ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va passer {stats.pending} événement(s) en statut "validé".
                  Les descriptions enrichies seront alors visibles sur le site.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={bulkValidate}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" disabled={enrichLoading || stats.eligibleUntreated === 0}>
                {enrichLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
                Générer les descriptions enrichies ({stats.eligibleUntreated} éligibles)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Générer les descriptions enrichies ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va générer les descriptions enrichies (texte long SEO)
                  pour un lot de 10 événements éligibles (score ≥ 55) qui n'en ont pas encore.
                  Cela consomme des crédits API Claude.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={launchEnrichment}>Lancer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
