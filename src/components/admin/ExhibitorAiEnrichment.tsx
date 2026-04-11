import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle, AlertCircle, RefreshCw, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrichmentReport {
  processed: number;
  success: number;
  errors: number;
  remaining: number;
  message?: string;
}

interface EnrichmentStats {
  total: number;
  enriched: number;
  remaining: number;
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
      const [exposantsRes, aiRes] = await Promise.all([
        supabase
          .from('exposants')
          .select('id_exposant', { count: 'exact', head: true })
          .not('id_exposant', 'is', null),
        supabase
          .from('exhibitor_ai')
          .select('id', { count: 'exact', head: true }),
      ]);

      const total = exposantsRes.count ?? 0;
      const enriched = aiRes.count ?? 0;
      setStats({ total, enriched, remaining: Math.max(0, total - enriched) });
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

      if (data.processed === 0) {
        toast.info('Tous les exposants sont déjà enrichis !');
      } else {
        toast.success(`${data.success} exposant(s) enrichi(s) avec succès`);
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
            {report.remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                ℹ️ Le batch suivant a été déclenché automatiquement en arrière-plan.
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
