import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2, CheckCircle, XCircle, SkipForward, RefreshCw, AlertTriangle } from 'lucide-react';

interface EnrichResult {
  id: string;
  id_event: string | null;
  nom_event: string;
  slug: string | null;
  status: 'done' | 'skipped' | 'error';
  reason?: string;
  meta_description_gen?: string;
  length?: number;
  enrichissement_date?: string;
  retried?: boolean;
  retry_reason?: string;
}

interface BatchResponse {
  batch: boolean;
  total: number;
  done: number;
  skipped: number;
  errors: number;
  retried?: number;
  results: EnrichResult[];
  message?: string;
}

const BATCH_SIZES = [
  { value: '5', label: '5 événements' },
  { value: '10', label: '10 événements' },
  { value: '20', label: '20 événements (max)' },
];

function getLengthColor(len: number | undefined): string {
  if (!len) return 'text-muted-foreground';
  if (len >= 140 && len <= 155) return 'text-green-700';
  if (len >= 135 && len <= 160) return 'text-amber-700';
  return 'text-destructive';
}

export const SeoEnrichmentPanel = () => {
  const [batchSize, setBatchSize] = useState('10');
  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const [missingCount, setMissingCount] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchMissingCount = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('visible', true)
      .eq('is_test', false)
      .gte('date_debut', today)
      .is('meta_description_gen', null);
    if (!error) setMissingCount(count ?? 0);
  };

  useEffect(() => { fetchMissingCount(); }, []);

  const runBatch = async () => {
    setIsRunning(true);
    setResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-event-meta', {
        body: { batch: true, limit: Number(batchSize) },
      });

      if (error) throw error;

      setResponse(data as BatchResponse);

      const d = data as BatchResponse;
      toast({
        title: `Batch terminé — ${d.done} enrichi(s)`,
        description: d.total === 0
          ? 'Aucun événement éligible trouvé.'
          : `${d.done} OK, ${d.skipped} ignoré(s), ${d.errors} erreur(s)${d.retried ? `, ${d.retried} retry(s)` : ''}`,
      });
      fetchMissingCount();
    } catch (err) {
      console.error('Batch enrichment error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de lancer le batch. Vérifiez les logs Edge Function.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Enrichissement SEO (meta description) — V2
        </CardTitle>
        <CardDescription className="flex items-center gap-3 flex-wrap">
          <span>
            Génère les meta descriptions manquantes via Claude avec prompt renforcé, validation qualité et retry automatique.
            Ne touche jamais aux metas existantes ni aux événements passés.
          </span>
          {missingCount !== null && (
            <Badge variant={missingCount === 0 ? 'outline' : 'destructive'} className="whitespace-nowrap">
              {missingCount === 0 ? '✓ Tous enrichis' : `${missingCount} sans meta`}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <SafeSelect
              ariaLabel="Taille du lot"
              placeholder="Taille du lot"
              value={batchSize}
              onChange={(v) => v && setBatchSize(v)}
              options={BATCH_SIZES}
              includeAllOption={false}
            />
        </div>
          <Button onClick={runBatch} disabled={isRunning || missingCount === 0}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enrichissement en cours…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Générer les meta descriptions
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Pour garantir la fiabilité du traitement, les enrichissements sont limités à 20 événements par lancement.
        </p>

        {/* Summary */}
        {response && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{response.total} traité(s)</Badge>
            {response.done > 0 && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {response.done} enrichi(s)
              </Badge>
            )}
            {response.skipped > 0 && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                {response.skipped} ignoré(s)
              </Badge>
            )}
            {response.errors > 0 && (
              <Badge variant="destructive">
                {response.errors} erreur(s)
              </Badge>
            )}
            {(response.retried ?? 0) > 0 && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {response.retried} retry(s)
              </Badge>
            )}
          </div>
        )}

        {/* Results table */}
        {response && response.results && response.results.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Événement</th>
                    <th className="text-left px-3 py-2 font-medium">Statut</th>
                    <th className="text-left px-3 py-2 font-medium">Meta générée</th>
                    <th className="text-right px-3 py-2 font-medium">Car.</th>
                    <th className="text-center px-3 py-2 font-medium">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {response.results.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        {r.slug ? (
                          <Link to={`/events/${r.slug}`} className="font-medium text-primary hover:underline">
                            {r.nom_event}
                          </Link>
                        ) : (
                          <div className="font-medium">{r.nom_event}</div>
                        )}
                        {r.id_event && (
                          <div className="text-xs text-muted-foreground">{r.id_event}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          {r.status === 'done' && (
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <CheckCircle className="h-3.5 w-3.5" /> OK
                            </span>
                          )}
                          {r.status === 'skipped' && (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <SkipForward className="h-3.5 w-3.5" /> Ignoré
                            </span>
                          )}
                          {r.status === 'error' && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <XCircle className="h-3.5 w-3.5" /> Erreur
                            </span>
                          )}
                          {r.retried && (
                            <span className="inline-flex items-center gap-1 text-blue-700 text-xs">
                              <RefreshCw className="h-3 w-3" /> Retry
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        {r.meta_description_gen ? (
                          <p className="text-xs leading-relaxed line-clamp-3">{r.meta_description_gen}</p>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${getLengthColor(r.length)}`}>
                        {r.length ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.reason && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={r.reason}>
                            <AlertTriangle className="h-3 w-3" />
                            <span className="max-w-[120px] truncate">{r.reason}</span>
                          </span>
                        )}
                        {r.retry_reason && !r.reason && (
                          <span className="text-xs text-blue-600" title={r.retry_reason}>
                            1ère tentative : {r.retry_reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {response && response.total === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            Aucun événement éligible trouvé. Tous les événements à venir visibles ont déjà une meta description.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
