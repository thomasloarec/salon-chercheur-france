
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2 } from 'lucide-react';

export function AirtableImport() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    eventsImported: number;
    exposantsImported: number;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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
        message: data.message || `Import terminé : ${data.eventsImported || 0} événements et ${data.exposantsImported || 0} exposants importés`
      };
      
      setResults(importResults);
      
      console.log(`[AirtableImport] ✅ Import terminé:`, importResults);
      
      toast({
        title: 'Import réussi',
        description: importResults.message,
      });

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
            <div className="font-medium text-green-800">Détails de l'import :</div>
            <div className="text-green-700 mt-1">
              • {results.eventsImported} événements importés
            </div>
            <div className="text-green-700">
              • {results.exposantsImported} exposants importés
            </div>
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
