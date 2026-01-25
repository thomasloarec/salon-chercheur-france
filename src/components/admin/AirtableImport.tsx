
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export function AirtableImport() {
  const [loading, setLoading] = useState(false);
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
    
    try {
      console.log('[AirtableImport] 🔄 Début de l\'import depuis Airtable...');
      
      const { data, error } = await supabase.functions.invoke('import-airtable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {}
      });

      if (error) {
        console.error('[AirtableImport] ❌ Erreur Supabase:', error);
        throw error;
      }

      if (!data.success) {
        console.error('[AirtableImport] ❌ Erreur dans la réponse:', data);
        throw new Error(data.error || data.message || 'Erreur inconnue');
      }

      const importResults = {
        eventsImported: data.eventsImported || 0,
        exposantsImported: data.exposantsImported || 0,
        participationsImported: data.participationsImported || 0,
        errorsPersisted: data.errorsPersisted || 0,
        message: data.message || `Import terminé : ${data.eventsImported || 0} événements, ${data.exposantsImported || 0} exposants et ${data.participationsImported || 0} participations importés`
      };
      
      setResults(importResults);
      
      console.log(`[AirtableImport] ✅ Import terminé:`, importResults);
      
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
    if (loading) return 'Import en cours…';
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
