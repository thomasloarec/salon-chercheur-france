import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2, CheckCircle, XCircle, SkipForward } from 'lucide-react';

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
}

interface BatchResponse {
  batch: boolean;
  total: number;
  done: number;
  skipped: number;
  errors: number;
  results: EnrichResult[];
  message?: string;
}

const BATCH_SIZES = [
  { value: '5', label: '5 événements' },
  { value: '10', label: '10 événements' },
  { value: '20', label: '20 événements' },
  { value: '50', label: '50 événements (max)' },
];

export const SeoEnrichmentPanel = () => {
  const [batchSize, setBatchSize] = useState('10');
  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const { toast } = useToast();

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
          : `${d.done} OK, ${d.skipped} ignoré(s), ${d.errors} erreur(s)`,
      });
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
          Enrichissement SEO (meta description)
        </CardTitle>
        <CardDescription>
          Génère automatiquement les meta descriptions manquantes pour les événements à venir visibles, via l'API Claude.
          Ne touche jamais aux metas existantes ni aux événements passés.
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
          <Button onClick={runBatch} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enrichissement en cours…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Lancer le pilote
              </>
            )}
          </Button>
        </div>

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
                        {r.reason && (
                          <div className="text-xs text-muted-foreground mt-0.5">{r.reason}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        {r.meta_description_gen ? (
                          <p className="text-xs leading-relaxed line-clamp-2">{r.meta_description_gen}</p>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.length ?? '—'}
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
