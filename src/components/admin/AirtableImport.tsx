import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aXZkdnp6aGVib2J2ZWVkeGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTY5NTEsImV4cCI6MjA2NDc5Mjk1MX0.s1P0Hj1u1g1BtAczv_gkippD9wTwkUj2pwxKchkZ8Hw';
const FUNCTIONS_URL = 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/import-airtable';

async function callImportStep(payload: Record<string, unknown>): Promise<{ status: number; body: any }> {
  const { data: { session } } = await supabase.auth.getSession();
  const anonKey = (supabase as any).supabaseKey ?? SUPABASE_PUBLISHABLE_KEY;
  const token = session?.access_token ?? anonKey;

  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(payload),
  });

  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

type Phase = 'idle' | 'starting' | 'events' | 'exposants' | 'participations' | 'done' | 'error';

interface Progress {
  phase: Phase;
  exposantsProcessed: number;
  participationsProcessed: number;
  eventsImported: number;
  chunks: number;
}

const INITIAL_PROGRESS: Progress = {
  phase: 'idle',
  exposantsProcessed: 0,
  participationsProcessed: 0,
  eventsImported: 0,
  chunks: 0,
};

export function AirtableImport() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>(INITIAL_PROGRESS);
  const [results, setResults] = useState<{
    eventsImported: number;
    exposantsImported: number;
    participationsImported: number;
    errorsPersisted: number;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress({ ...INITIAL_PROGRESS, phase: 'starting' });

    let eventsImported = 0;
    let exposantsProcessed = 0;
    let participationsProcessed = 0;
    let chunks = 0;

    const push = (phase: Phase) =>
      setProgress({ phase, eventsImported, exposantsProcessed, participationsProcessed, chunks });

    /** Déroule une étape paginée (exposants / participations), gère le 409 offset expiré. */
    const runPaginatedStep = async (
      step: 'exposants' | 'participations',
      sessionId: string,
      onProcessed: (n: number) => void,
    ): Promise<any> => {
      let offset: string | undefined = undefined;
      let restarts = 0;

      while (true) {
        const payload: Record<string, unknown> = { step, session_id: sessionId };
        if (offset) payload.offset = offset;

        const { status, body } = await callImportStep(payload);

        if (status === 409 && body?.error === 'airtable_offset_expired') {
          restarts++;
          if (restarts > 2) {
            throw new Error(
              `Étape « ${step} » : curseur Airtable expiré 3 fois de suite, abandon après 2 relances.`,
            );
          }
          console.warn(`[AirtableImport] ⏪ Offset expiré sur ${step}, relance #${restarts} depuis le début`);
          offset = undefined;
          continue;
        }

        if (!body?.success) {
          throw new Error(body?.error || body?.message || `Échec de l'étape « ${step} » (HTTP ${status})`);
        }

        chunks++;
        onProcessed(Number(body.processed) || 0);
        push(step);

        if (body.done) return body;
        offset = body.offset;
        if (!offset) return body;
      }
    };

    try {
      console.log('[AirtableImport] 🔄 Démarrage de l\'orchestration par tranches...');

      // 1. start
      const startRes = await callImportStep({ action: 'start' });
      if (!startRes.body?.success || !startRes.body?.session_id) {
        throw new Error(
          startRes.body?.error || startRes.body?.message || `Impossible de démarrer l'import (HTTP ${startRes.status})`,
        );
      }
      const sessionId: string = startRes.body.session_id;

      // 2. events
      push('events');
      const eventsRes = await callImportStep({ step: 'events', session_id: sessionId });
      if (!eventsRes.body?.success) {
        throw new Error(
          eventsRes.body?.error || eventsRes.body?.message || `Échec de l'étape « events » (HTTP ${eventsRes.status})`,
        );
      }
      eventsImported += Number(eventsRes.body.imported) || 0;
      chunks++;
      push('events');

      // 3. exposants
      push('exposants');
      await runPaginatedStep('exposants', sessionId, (n) => { exposantsProcessed += n; });

      // 4. participations
      push('participations');
      await runPaginatedStep('participations', sessionId, (n) => { participationsProcessed += n; });

      push('done');

      const importResults = {
        eventsImported,
        exposantsImported: exposantsProcessed,
        participationsImported: participationsProcessed,
        errorsPersisted: 0,
        message: `Import terminé : ${eventsImported} événements, ${exposantsProcessed} exposants et ${participationsProcessed} participations traités`,
      };

      setResults(importResults);
      console.log('[AirtableImport] ✅ Import terminé:', importResults, `(${chunks} tranches)`);

      toast({
        title: 'Import réussi',
        description: importResults.message,
      });

      // Rafraîchir automatiquement les données après import réussi
      console.log('[AirtableImport] 🔄 Rafraîchissement automatique des données...');
      queryClient.invalidateQueries({ queryKey: ['events-import-pending'] });
      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events-rpc'] });
      // Rafraîchir les erreurs d'import
      queryClient.invalidateQueries({ queryKey: ['import-errors'] });

    } catch (err: any) {
      console.error('[AirtableImport] ❌ Exception:', err);
      const errorMessage = err.message || 'Erreur lors de l\'import';
      setError(errorMessage);
      push('error');

      toast({
        title: 'Erreur d\'import',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusMessage = () => {
    if (loading) {
      switch (progress.phase) {
        case 'starting': return 'Initialisation…';
        case 'events': return 'Import des événements…';
        case 'exposants': return `Exposants traités : ${progress.exposantsProcessed}`;
        case 'participations': return `Participations traitées : ${progress.participationsProcessed}`;
        default: return 'Import en cours…';
      }
    }
    if (results) return `✅ ${results.message}`;
    return 'Cliquez pour démarrer l\'import';
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Download className="h-5 w-5" />
          Importer les données Airtable
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">
          {getStatusMessage()}
        </p>

        {loading && progress.chunks > 0 && (
          <p className="text-xs text-muted-foreground">
            {progress.chunks} tranche{progress.chunks > 1 ? 's' : ''} exécutée{progress.chunks > 1 ? 's' : ''}
          </p>
        )}

        {error && (
          <p className="text-destructive text-sm">
            Erreur : {error}
          </p>
        )}
        
        {results && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
            <div className="flex items-center justify-center gap-2 font-medium text-green-800 mb-2">
              <CheckCircle className="h-4 w-4" />
              Détails de l'import
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-700">{results.eventsImported}</div>
                <div className="text-xs text-green-600">événements</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{results.exposantsImported}</div>
                <div className="text-xs text-green-600">exposants</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{results.participationsImported}</div>
                <div className="text-xs text-green-600">participations</div>
              </div>
            </div>
            
            {results.errorsPersisted > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-center gap-2 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
                <span>{results.errorsPersisted} erreurs à traiter (voir panneau ci-dessous)</span>
              </div>
            )}
          </div>
        )}
        
        <Button
          onClick={handleImport}
          disabled={loading}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Patientez…
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Importer les données
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
