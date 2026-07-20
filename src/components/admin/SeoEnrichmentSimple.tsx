import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Sparkles, Wand2, ShieldCheck, ExternalLink, MessageSquareQuote } from 'lucide-react';

interface Counters {
  enriched: number;
  super: number;
  alerte: number;
  toGenerate: number;
  failed: number;
}

interface Row {
  id: string;
  nom_event: string;
  slug: string | null;
  seo_quality_score: number | null;
  auto_validation_status: string | null;
  enrichissement_score: number | null;
}

export function SeoEnrichmentSimple() {
  const { toast } = useToast();
  const [counters, setCounters] = useState<Counters>({ enriched: 0, super: 0, alerte: 0, toGenerate: 0, failed: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [accrochesMissing, setAccrochesMissing] = useState<number | null>(null);
  const [accrochesLoading, setAccrochesLoading] = useState(false);
  const [accrochesRunning, setAccrochesRunning] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchAccrochesMissing = useCallback(async () => {
    setAccrochesLoading(true);
    try {
      const [totalRes, withAccrocheRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false),
        supabase.from('event_ai').select('event_id', { count: 'exact', head: true })
          .not('accroche', 'is', null),
      ]);
      const missing = Math.max(0, (totalRes.count ?? 0) - (withAccrocheRes.count ?? 0));
      setAccrochesMissing(missing);
    } catch (e) {
      console.error('[SeoEnrichmentSimple] accroches count error', e);
    } finally {
      setAccrochesLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [enrichedRes, superRes, alerteRes, toGenRes, failedRes, rowsRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).not('description_enrichie', 'is', null),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).not('description_enrichie', 'is', null)
          .gte('seo_quality_score', 80),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('visible', true).eq('is_test', false).not('description_enrichie', 'is', null)
          .lt('seo_quality_score', 80),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('is_test', false).is('description_enrichie', null)
          .gt('date_debut', today).gte('enrichissement_score', 55),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('is_test', false).eq('auto_validation_status', 'failed')
          .not('description_enrichie', 'is', null),
        supabase.from('events')
          .select('id, nom_event, slug, seo_quality_score, auto_validation_status, enrichissement_score')
          .eq('visible', true).eq('is_test', false)
          .not('description_enrichie', 'is', null)
          .or('seo_quality_score.lt.80,auto_validation_status.eq.failed')
          .order('seo_quality_score', { ascending: true })
          .limit(50),
      ]);
      setCounters({
        enriched: enrichedRes.count ?? 0,
        super: superRes.count ?? 0,
        alerte: alerteRes.count ?? 0,
        toGenerate: toGenRes.count ?? 0,
        failed: failedRes.count ?? 0,
      });
      setRows((rowsRes.data ?? []) as Row[]);
    } catch (e) {
      console.error('[SeoEnrichmentSimple] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { fetchAll(); fetchAccrochesMissing(); }, [fetchAll, fetchAccrochesMissing]);

  const refreshAll = () => {
    fetchAll();
    fetchAccrochesMissing();
    window.dispatchEvent(new Event('seo-enrichment-refresh'));
  };

  const generateAccroches = async () => {
    setAccrochesRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-event-accroches', { body: {} });
      if (error) throw error;
      const r = data as { traites?: number; done?: number; errors?: number; restants?: number };
      toast({
        title: '✨ Accroches générées',
        description: `${r?.done ?? 0} générées, ${r?.errors ?? 0} erreurs sur ${r?.traites ?? 0}. Restants : ${r?.restants ?? '—'}.`,
      });
      fetchAccrochesMissing();
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setAccrochesRunning(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-event-meta', {
        body: { batch_desc_enrichie: true, limit: 3 },
      });
      if (error) throw error;
      const r = data as { total?: number; done?: number; errors?: number; skipped?: number };
      toast({
        title: '📝 Descriptions générées',
        description: `${r?.done ?? 0} générées, ${r?.skipped ?? 0} ignorées, ${r?.errors ?? 0} erreurs sur ${r?.total ?? 0}.`,
      });
      refreshAll();
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const revalidate = async () => {
    setRevalidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: { target: 'revalidate-enriched-description', payload: { dry_run: false, limit: 200 } },
      });
      if (error) throw error;
      const s = (data as { summary?: { auto_validated?: number; warning?: number; failed?: number; total?: number } })?.summary;
      toast({
        title: '🛡️ Re-validation terminée',
        description: `${s?.total ?? 0} évalué(s) — auto: ${s?.auto_validated ?? 0}, warning: ${s?.warning ?? 0}, failed: ${s?.failed ?? 0}`,
      });
      refreshAll();
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setRevalidating(false);
    }
  };

  const autoFixAll = async () => {
    setFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: { target: 'seo-auto-fix-description', payload: {} },
      });
      if (error) throw error;
      const s = (data as { summary?: { fixed?: number; total?: number } })?.summary;
      toast({
        title: '🪄 Corrections appliquées',
        description: s ? `${s.fixed ?? 0}/${s.total ?? 0} corrigées` : 'Terminé',
      });
      refreshAll();
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setFixing(false);
    }
  };

  const seoBadge = (score: number | null) => {
    if (score == null) return <Badge variant="outline" className="text-xs">SEO —</Badge>;
    if (score >= 80) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">Super · {score}</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Alerte · {score}</Badge>;
  };

  const factBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline" className="text-xs">—</Badge>;
    if (status === 'passed') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">OK</Badge>;
    if (status === 'warning') return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Warning</Badge>;
    if (status === 'failed') return <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">Échec</Badge>;
    return <Badge variant="outline" className="text-xs">{status}</Badge>;
  };

  const Tile = ({ label, value, tone }: { label: string; value: number; tone?: 'super' | 'alerte' | 'default' }) => {
    const toneCls =
      tone === 'super' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : tone === 'alerte' ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-muted/30';
    return (
      <div className={`rounded-lg border p-3 ${toneCls}`}>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Enrichissement SEO</CardTitle>
        <Button variant="ghost" size="sm" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tuiles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Tile label="Descriptions enrichies" value={counters.enriched} />
          <Tile label="Qualité SEO Super (≥80)" value={counters.super} tone="super" />
          <Tile label="Qualité SEO Alerte (<80)" value={counters.alerte} tone="alerte" />
          <Tile label="À générer" value={counters.toGenerate} />
          <Tile label="Erreur factuelle" value={counters.failed} />
        </div>

        {/* Actions principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button size="lg" onClick={generate} disabled={generating} className="h-14 text-base">
            {generating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Sparkles className="h-5 w-5 mr-2" />}
            Générer les descriptions enrichies
          </Button>
          <Button size="lg" variant="secondary" onClick={revalidate} disabled={revalidating} className="h-14 text-base">
            {revalidating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
            Revalider & recalculer les scores
          </Button>
        </div>

        {/* Action secondaire */}
        <div>
          <Button variant="outline" size="sm" onClick={autoFixAll} disabled={fixing}>
            {fixing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Corriger les erreurs factuelles
          </Button>
        </div>

        {/* Accroches des salons */}
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">Accroches des salons</div>
                <div className="text-xs text-muted-foreground">
                  Une phrase courte affichée sous le nom du salon. Le cron traite quotidiennement le manquant ; ce bouton permet un rattrapage manuel (100 par clic).
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-sm shrink-0">
              {accrochesLoading ? '…' : `${accrochesMissing ?? '—'} sans accroche`}
            </Badge>
          </div>
          <Button onClick={generateAccroches} disabled={accrochesRunning || accrochesMissing === 0}>
            {accrochesRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Générer les accroches manquantes
          </Button>
        </div>

        {/* Liste à traiter */}
        <div>
          <div className="text-sm font-medium mb-2">À traiter ({rows.length})</div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Aucun événement à traiter 🎉</div>
          ) : (
            <div className="divide-y rounded-lg border">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{r.nom_event}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {seoBadge(r.seo_quality_score)}
                    {factBadge(r.auto_validation_status)}
                    {r.slug && (
                      <a
                        href={`/events/${r.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Voir la fiche <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}