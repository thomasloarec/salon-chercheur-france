
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2 } from 'lucide-react';

export function AirtableImport() {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setCount(null);
    
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

      const totalImported = (data.eventsImported || 0) + (data.exposantsImported || 0);
      setCount(totalImported);
      
      console.log(`[AirtableImport] ✅ Import terminé: ${totalImported} enregistrements`);
      
      toast({
        title: 'Import réussi',
        description: `${totalImported} enregistrements importés depuis Airtable`,
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
    if (count !== null) return `✅ ${count} enregistrements importés`;
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
