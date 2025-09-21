import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export const EdgeFunctionDebugger = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>({});

  const runDiagnostics = async () => {
    setIsLoading(true);
    const diagnosticResults: any = {};

    try {
      // 1. Vérifier la session
      console.log('🔍 Test 1: Vérification session...');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      diagnosticResults.session = {
        hasToken: !!token,
        tokenPreview: token?.substring(0, 20) + '...',
        userId: sessionData.session?.user?.id
      };

      // 2. Vérifier l'événement IFTM
      console.log('🔍 Test 2: Vérification événement...');
      const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id_event, nom_event, slug, visible')
        .eq('slug', 'iftm');
      
      diagnosticResults.event = {
        found: events && events.length > 0,
        data: events?.[0],
        error: eventError?.message
      };

      // 3. Vérifier l'exposant
      console.log('🔍 Test 3: Vérification exposant...');
      const exhibitorId = "71faa1be-f5d7-4274-be1e-a2251eb411bf";
      const { data: exhibitor, error: exhibitorError } = await supabase
        .from('exhibitors')
        .select('id, name, approved')
        .eq('id', exhibitorId)
        .single();
      
      diagnosticResults.exhibitor = {
        found: !!exhibitor,
        data: exhibitor,
        error: exhibitorError?.message
      };

      // 4. Test table novelties
      console.log('🔍 Test 4: Structure table novelties...');
      const { data: novelties, error: noveltiesError } = await supabase
        .from('novelties')
        .select('*')
        .limit(1);
      
      diagnosticResults.novelties = {
        accessible: !noveltiesError,
        columns: novelties?.[0] ? Object.keys(novelties[0]) : [],
        error: noveltiesError?.message
      };

      // 5. Test Edge Function direct
      console.log('🔍 Test 5: Appel Edge Function...');
      if (token && events?.[0]) {
        const testPayload = {
          event_id: events[0].id_event,
          exhibitor_id: exhibitorId,
          title: "Test Debug",
          novelty_type: "Launch",
          reason: "Test de diagnostic pour identifier l'erreur 500",
          created_by: sessionData.session?.user?.id
        };

        try {
          const response = await fetch(
            `https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/novelties-create`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(testPayload)
            }
          );

          const responseText = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            responseData = responseText;
          }

          diagnosticResults.edgeFunction = {
            status: response.status,
            statusText: response.statusText,
            payload: testPayload,
            response: responseData,
            headers: Object.fromEntries(response.headers.entries())
          };

        } catch (fetchError: any) {
          diagnosticResults.edgeFunction = {
            error: fetchError.message,
            payload: testPayload
          };
        }
      }

      setResults(diagnosticResults);
      console.log('🎯 Résultats complets:', diagnosticResults);

    } catch (error: any) {
      console.error('🚨 Erreur diagnostic:', error);
      toast.error(`Erreur diagnostic: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Diagnostic Edge Function
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Diagnostic en cours...' : 'Lancer le diagnostic'}
        </Button>

        {Object.keys(results).length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Résultats du diagnostic:</h3>
            
            {/* Session */}
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium">🔑 Session</h4>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(results.session, null, 2)}
              </pre>
            </div>

            {/* Événement */}
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium">📅 Événement IFTM</h4>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(results.event, null, 2)}
              </pre>
            </div>

            {/* Exposant */}
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium">🏢 Exposant</h4>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(results.exhibitor, null, 2)}
              </pre>
            </div>

            {/* Table novelties */}
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium">📋 Table novelties</h4>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(results.novelties, null, 2)}
              </pre>
            </div>

            {/* Edge Function */}
            {results.edgeFunction && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">⚡ Edge Function</h4>
                <div className="space-y-2">
                  <div>
                    <strong>Status:</strong> {results.edgeFunction.status}
                  </div>
                  <div>
                    <strong>Payload envoyé:</strong>
                    <pre className="text-xs overflow-x-auto mt-1">
                      {JSON.stringify(results.edgeFunction.payload, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <strong>Réponse:</strong>
                    <pre className="text-xs overflow-x-auto mt-1">
                      {JSON.stringify(results.edgeFunction.response, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};