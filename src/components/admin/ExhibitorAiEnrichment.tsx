import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrichmentReport {
  processed: number;
  success: number;
  errors: number;
  remaining: number;
  message?: string;
}

const ExhibitorAiEnrichment: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<EnrichmentReport | null>(null);

  const handleEnrich = async () => {
    setLoading(true);
    setReport(null);

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
      toast.error('Erreur inattendue lors de l\'enrichissement');
      console.error('[ExhibitorAiEnrichment]', err);
    } finally {
      setLoading(false);
    }
  };

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

        <Button onClick={handleEnrich} disabled={loading} variant="default">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enrichissement en cours…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Enrichir les exposants manquants
            </>
          )}
        </Button>

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
