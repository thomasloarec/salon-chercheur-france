
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getEnvOrConfig, listMissing, debugVariables } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-secrets] 🔍 Vérification des secrets');
    
    const missingSecrets = listMissing();
    const defined: string[] = [];

    // Liste des variables définies
    const REQUIRED_VARS = [
      'AIRTABLE_PAT',
      'AIRTABLE_BASE_ID',
      'EVENTS_TABLE_NAME',
      'EXHIBITORS_TABLE_NAME',
      'PARTICIPATION_TABLE_NAME'
    ];

    for (const key of REQUIRED_VARS) {
      if (!missingSecrets.includes(key)) {
        const hasConfigFallback = ['AIRTABLE_BASE_ID', 'EVENTS_TABLE_NAME', 'EXHIBITORS_TABLE_NAME', 'PARTICIPATION_TABLE_NAME'].includes(key);
        if (Deno.env.get(key)) {
          defined.push(key);
        } else if (hasConfigFallback) {
          defined.push(`${key} (via config)`);
        }
      }
    }

    const isComplete = missingSecrets.length === 0;

    console.log('[check-secrets] 📊 Résultat:', { isComplete, defined: defined.length, missing: missingSecrets.length });

    const result = {
      ok: isComplete,
      defined,
      missing: missingSecrets,
      message: isComplete 
        ? 'All required secrets are configured' 
        : `Missing ${missingSecrets.length} required secret(s): ${missingSecrets.join(', ')}`,
      debug: debugVariables()
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[check-secrets] ❌ Erreur:', error);
    
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
