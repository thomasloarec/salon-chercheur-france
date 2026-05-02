import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle, AlertCircle, RefreshCw, Database, CreditCard, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrichmentReport {
  processed: number;
  success: number;
  errors: number;
  remaining: number;
  message?: string;
  error_code?: string | null;
  error_detail?: string | null;
}

interface EnrichmentStats {
  total: number;
  enriched: number;
  remaining: number;
  orphan?: number;
  remainingWithSite?: number;
}

const ExhibitorAiEnrichment: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<EnrichmentReport | null>(null);
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const initialRemainingRef = useRef<number | null>(null);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_exhibitor_ai_enrichment_stats');
      if (error) throw error;
      const s = (data ?? {}) as {
        total_exposants?: number;
        enriched_valid?: number;
        orphan_ai_rows?: number;
        remaining_with_site?: number;
        remaining_total?: number;
      };
      setStats({
        total: s.total_exposants ?? 0,
        enriched: s.enriched_valid ?? 0,
        remaining: s.remaining_with_site ?? 0,
        orphan: s.orphan_ai_rows ?? 0,
        remainingWithSite: s.remaining_with_site ?? 0,
      });
    } catch {
      console.error('[ExhibitorAiEnrichment] Failed to fetch stats');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPolling = () => {
    initialRemainingRef.current = stats?.remaining ?? null;
    pollRef.current = setInterval(() => {
      fetchStats();
    }, 10000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleEnrich = async () => {
    setLoading(true);
    setReport(null);
    startTimer();
    startPolling();

    try {
      const { data, error } = await supabase.functions.invoke('enrich-exposants-ai', {
        body: { triggered_by: 'admin-manual' },
      });

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }

      setReport(data as EnrichmentReport);

      const r = data as EnrichmentReport;
      if (r.error_code === 'ANTHROPIC_CREDIT_EXHAUSTED') {
        toast.error('Crédit Anthropic épuisé — voir le détail ci-dessous.');
      } else if (r.error_code === 'ANTHROPIC_AUTH_ERROR') {
        toast.error('Clé API Anthropic invalide — voir le détail ci-dessous.');
      } else if (r.error_code === 'ANTHROPIC_RATE_LIMITED') {
        toast.warning('Anthropic : limite de débit atteinte (429).');
      } else if (r.error_code === 'ALL_ERRORS') {
        toast.error(`Aucun enrichissement n'a réussi sur ce batch (${r.errors} erreurs).`);
      } else if (r.processed === 0) {
        toast.info('Tous les exposants sont déjà enrichis !');
      } else {
        toast.success(`${r.success} exposant(s) enrichi(s) avec succès`);
      }
    } catch (err) {
      toast.error("Erreur inattendue lors de l'enrichissement");
      console.error('[ExhibitorAiEnrichment]', err);
    } finally {
      setLoading(false);
      stopTimer();
      stopPolling();
      fetchStats();
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}min ${s}s` : `${s}s`;
  };

  const processedDuringSession =
    loading && initialRemainingRef.current !== null && stats
      ? Math.max(0, initialRemainingRef.current - stats.remaining)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Enrichissement IA des exposants
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enrichit automatiquement les fiches exposants manquantes via l'IA (résumé, secteur, mots-clés…).
          Traitement par lot de 50. Se relance automatiquement s'il reste des exposants à traiter.
        </p>

        {/* Stats bar */}
        <div className="rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">État actuel</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStats}
              disabled={statsLoading}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${statsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {stats ? (
            <div className="grid grid-cols-3 gap-3 mt-2 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold">{stats.total.toLocaleString('fr-FR')}</div>
                <div className="text-xs text-muted-foreground">Total exposants</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{stats.enriched.toLocaleString('fr-FR')}</div>
                <div className="text-xs text-muted-foreground">Enrichis</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${stats.remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {stats.remaining.toLocaleString('fr-FR')}
                </div>
                <div className="text-xs text-muted-foreground">Restants</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-2">Chargement…</div>
          )}
          {stats && stats.total > 0 && (
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((stats.enriched / stats.total) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-right mt-1">
                {Math.round((stats.enriched / stats.total) * 100)}% enrichis
              </div>
            </div>
          )}
          {stats && (stats.orphan ?? 0) > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              ⚠️ {stats.orphan!.toLocaleString('fr-FR')} ligne(s) <code>exhibitor_ai</code> orpheline(s)
              (anciens identifiants, non liées à un exposant actuel) — non comptées comme enrichies.
            </p>
          )}
        </div>

        <Button
          onClick={handleEnrich}
          disabled={loading || (stats?.remaining === 0)}
          variant="default"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enrichissement en cours… ({formatDuration(elapsedSeconds)})
            </>
          ) : stats?.remaining === 0 ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Tous les exposants sont enrichis
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Enrichir les {stats?.remaining?.toLocaleString('fr-FR') ?? '…'} exposants manquants
            </>
          )}
        </Button>

        {/* Live progress during enrichment */}
        {loading && processedDuringSession !== null && processedDuringSession > 0 && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {processedDuringSession} exposant(s) traité(s) depuis le début de cette session…
          </div>
        )}

        {report && (
          <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
            {report.error_code === 'ANTHROPIC_CREDIT_EXHAUSTED' && (
              <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 mb-2">
                <div className="flex items-start gap-2">
                  <CreditCard className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-sm">
                    <div className="font-semibold text-red-900 dark:text-red-200">
                      Crédit Anthropic épuisé
                    </div>
                    <p className="text-red-800 dark:text-red-300">
                      L'enrichissement utilise l'API Claude (Anthropic). Le solde de crédit du
                      compte Anthropic est à zéro, donc <strong>aucun exposant ne peut être
                      enrichi tant que le crédit n'est pas rechargé</strong>.
                    </p>
                    <p className="text-red-800 dark:text-red-300">
                      Étapes à suivre :
                    </p>
                    <ol className="list-decimal list-inside text-red-800 dark:text-red-300 space-y-0.5">
                      <li>Ouvrir la console Anthropic ci-dessous.</li>
                      <li>Aller dans <em>Plans &amp; Billing</em>.</li>
                      <li>Recharger le crédit ou activer la facturation auto.</li>
                      <li>Revenir ici et relancer l'enrichissement.</li>
                    </ol>
                    <a
                      href="https://console.anthropic.com/settings/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 underline font-medium"
                    >
                      Ouvrir Anthropic — Plans &amp; Billing
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
            {report.error_code === 'ANTHROPIC_AUTH_ERROR' && (
              <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 mb-2 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <div className="font-semibold mb-1">Clé API Anthropic invalide</div>
                  La clé <code>ANTHROPIC_API_KEY</code> est rejetée par Anthropic
                  (401/403). Vérifiez le secret dans Supabase et régénérez une clé si nécessaire.
                </div>
              </div>
            )}
            {report.error_code === 'ANTHROPIC_RATE_LIMITED' && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900 p-3 mb-2 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-900 dark:text-yellow-200">
                  <div className="font-semibold mb-1">Limite de débit Anthropic (429)</div>
                  Trop de requêtes en peu de temps. Attendez quelques minutes puis relancez.
                </div>
              </div>
            )}
            {report.error_code === 'ALL_ERRORS' && !['ANTHROPIC_CREDIT_EXHAUSTED','ANTHROPIC_AUTH_ERROR','ANTHROPIC_RATE_LIMITED'].includes(report.error_code) && (
              <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 mb-2 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <div className="font-semibold mb-1">Aucun exposant n'a pu être enrichi</div>
                  Les {report.errors} appels du batch ont échoué. Consultez les logs de la
                  edge function <code>enrich-exposants-ai</code> pour le détail.
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              {report.errors === 0 ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
              <span className="font-medium">Rapport du batch</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-background rounded p-2 text-center">
                <div className="text-lg font-bold">{report.processed}</div>
                <div className="text-muted-foreground">Traités</div>
              </div>
              <div className="bg-background rounded p-2 text-center">
                <div className="text-lg font-bold text-green-600">{report.success}</div>
                <div className="text-muted-foreground">Succès</div>
              </div>
              <div className="bg-background rounded p-2 text-center">
                <div className="text-lg font-bold text-red-600">{report.errors}</div>
                <div className="text-muted-foreground">Erreurs</div>
              </div>
              <div className="bg-background rounded p-2 text-center">
                <div className="text-lg font-bold text-blue-600">{report.remaining}</div>
                <div className="text-muted-foreground">Restants</div>
              </div>
            </div>
            {report.remaining > 0 && !report.error_code && (
              <p className="text-xs text-muted-foreground">
                ℹ️ Le batch suivant a été déclenché automatiquement en arrière-plan.
              </p>
            )}
            {report.remaining > 0 && report.error_code && (
              <p className="text-xs text-muted-foreground">
                ⏸️ L'auto-relance a été arrêtée à cause de l'erreur ci-dessus. Corrigez le
                problème puis relancez manuellement.
              </p>
            )}
            {report.message && (
              <p className="text-xs text-muted-foreground">{report.message}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExhibitorAiEnrichment;
