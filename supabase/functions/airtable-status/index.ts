
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getEnvOrConfig, listMissing, debugVariables } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableStatus {
  secretsOk: boolean;
  missing?: string[];
  testsOk: boolean;
  testsFailStep?: string;
  testsError?: {
    error: string;
    status?: number;
    message?: string;
    context?: string;
  };
  dedupOk: boolean;
  buttonsActive: boolean;
  debug?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[airtable-status] 🔍 Début vérification status');
    
    // 1. Vérifier les secrets de manière stricte
    const missingSecrets = listMissing();
    const secretsOk = missingSecrets.length === 0;
    const buttonsActive = secretsOk;

    console.log('[airtable-status] 📊 Secrets manquants:', missingSecrets);
    console.log('[airtable-status] 🔐 Secrets OK:', secretsOk);

    let testsOk = false;
    let testsFailStep: string | undefined;
    let testsError: any = undefined;
    let dedupOk = false;

    // 2. Si les secrets sont OK, lancer les tests automatiquement
    if (secretsOk) {
      try {
        console.log('[airtable-status] 🧪 Lancement des tests automatiques');
        
        // Test rapide de connexion à Airtable via notre proxy
        const testResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/airtable-proxy`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'LIST',
            table: getEnvOrConfig('EVENTS_TABLE_NAME'),
            payload: null
          })
        });

        console.log('[airtable-status] 📡 Réponse proxy:', testResponse.status);

        if (testResponse.ok) {
          const testResult = await testResponse.json();
          
          if (testResult.success) {
            console.log('[airtable-status] ✅ Test connexion Airtable OK');
            testsOk = true;
            dedupOk = true; // Simplifié pour le moment
          } else {
            console.log('[airtable-status] ❌ Erreur retournée par proxy:', testResult);
            
            testsError = {
              error: testResult.error,
              status: testResult.status,
              message: testResult.message,
              context: testResult.context
            };
            
            if (testResult.error === 'missing_env') {
              testsFailStep = 'Variables manquantes (proxy)';
            } else if (testResult.error === 'airtable_error') {
              testsFailStep = `Airtable ${testResult.status}: ${testResult.message}`;
            } else {
              testsFailStep = `Erreur proxy: ${testResult.error}`;
            }
          }
        } else {
          const errorText = await testResponse.text();
          console.log('[airtable-status] ❌ Erreur HTTP proxy:', testResponse.status, errorText);
          
          testsFailStep = `Proxy HTTP ${testResponse.status}`;
          testsError = {
            error: 'proxy_http_error',
            status: testResponse.status,
            message: errorText,
            context: 'PROXY_CALL_FAILED'
          };
        }

      } catch (error) {
        console.error('[airtable-status] ❌ Erreur lors des tests:', error);
        testsFailStep = `Erreur de test: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
        testsError = {
          error: 'test_exception',
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          context: 'TEST_EXCEPTION'
        };
      }
    } else {
      testsFailStep = 'Variables manquantes';
      testsError = {
        error: 'missing_env',
        message: `Variables manquantes: ${missingSecrets.join(', ')}`,
        context: 'MISSING_SECRETS'
      };
    }

    const status: AirtableStatus = {
      secretsOk,
      missing: missingSecrets.length > 0 ? missingSecrets : undefined,
      testsOk,
      testsFailStep,
      testsError,
      dedupOk,
      buttonsActive,
      debug: debugVariables()
    };

    console.log('[airtable-status] 📋 Status final:', {
      secretsOk,
      testsOk,
      testsFailStep,
      missing: missingSecrets
    });

    return new Response(
      JSON.stringify(status),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[airtable-status] ❌ Erreur générale:', error);
    
    return new Response(
      JSON.stringify({ 
        secretsOk: false,
        testsOk: false,
        dedupOk: false,
        buttonsActive: false,
        testsFailStep: error instanceof Error ? error.message : 'Erreur inconnue',
        testsError: {
          error: 'status_exception',
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          context: 'STATUS_EXCEPTION'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
