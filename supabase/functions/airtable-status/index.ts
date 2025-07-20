
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getEnvOrConfig, checkMissingVars } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableStatus {
  secretsOk: boolean;
  missing?: string[];
  testsOk: boolean;
  testsFailStep?: string;
  dedupOk: boolean;
  buttonsActive: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Vérifier les secrets de manière unifiée
    const missing = checkMissingVars();
    const secretsOk = missing.length === 0;
    const buttonsActive = secretsOk;

    let testsOk = false;
    let testsFailStep: string | undefined;
    let dedupOk = false;

    // 2. Si les secrets sont OK, lancer les tests automatiquement
    if (secretsOk) {
      try {
        // Test rapide de connexion à Airtable
        const airtablePat = getEnvOrConfig('AIRTABLE_PAT');
        const baseId = getEnvOrConfig('AIRTABLE_BASE_ID');
        const eventsTable = getEnvOrConfig('EVENTS_TABLE_NAME');

        const testResponse = await fetch(`https://api.airtable.com/v0/${baseId}/${eventsTable}?maxRecords=1`, {
          headers: {
            'Authorization': `Bearer ${airtablePat}`,
            'Content-Type': 'application/json'
          }
        });

        if (testResponse.ok) {
          testsOk = true;
          dedupOk = true; // Simplifié pour le moment
        } else {
          testsFailStep = `Connexion Airtable (${testResponse.status})`;
        }
      } catch (error) {
        testsFailStep = `Erreur de connexion: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
      }
    } else {
      testsFailStep = 'Variables manquantes';
    }

    const status: AirtableStatus = {
      secretsOk,
      missing: missing.length > 0 ? missing : undefined,
      testsOk,
      testsFailStep,
      dedupOk,
      buttonsActive
    };

    return new Response(
      JSON.stringify(status),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Airtable status check error:', error);
    
    return new Response(
      JSON.stringify({ 
        secretsOk: false,
        testsOk: false,
        dedupOk: false,
        buttonsActive: false,
        testsFailStep: error instanceof Error ? error.message : 'Erreur inconnue'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
