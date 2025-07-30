
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function AirtableImport() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    eventsImported: number;
    exposantsImported: number;
    participationsImported: number;
    message: string;
    errors?: {
      events: Array<{ record_id: string; reason: string }>;
      exposants: Array<{ record_id: string; reason: string }>;
      participation: Array<{ record_id: string; reason: string }>;
    };
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
        message: data.message || `Import terminé : ${data.eventsImported || 0} événements, ${data.exposantsImported || 0} exposants et ${data.participationsImported || 0} participations importés`,
        errors: data.errors || { events: [], exposants: [], participation: [] }
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
            <div className="text-green-700">
              • {results.participationsImported} participations importées
            </div>
            
            {results.errors && (
              <div className="mt-3 space-y-2">
                {(results.errors.events.length > 0 || results.errors.exposants.length > 0 || results.errors.participation.length > 0) && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Voir les erreurs ({results.errors.events.length + results.errors.exposants.length + results.errors.participation.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>Détails des erreurs d'import</DialogTitle>
                        <DialogDescription>
                          Liste des enregistrements qui n'ont pas pu être importés
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        {results.errors.events.length > 0 && (
                          <div>
                            <h4 className="font-medium text-red-800 mb-2">Événements non importés :</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                              {results.errors.events.map((error, index) => (
                                <li key={index}>
                                  • record_id: {error.record_id}, raison: "{error.reason}"
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {results.errors.exposants.length > 0 && (
                          <div>
                            <h4 className="font-medium text-red-800 mb-2">Exposants non importés :</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                              {results.errors.exposants.map((error, index) => (
                                <li key={index}>
                                  • record_id: {error.record_id}, raison: "{error.reason}"
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {results.errors.participation.length > 0 && (
                          <div>
                            <h4 className="font-medium text-red-800 mb-2">Participations non importées :</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                              {results.errors.participation.map((error, index) => (
                                <li key={index}>
                                  • record_id: {error.record_id}, raison: "{error.reason}"
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
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
