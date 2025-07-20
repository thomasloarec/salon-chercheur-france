
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getEnvOrConfig, checkMissingVars } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const missing = checkMissingVars();
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
      if (!missing.includes(key)) {
        const hasConfigFallback = ['AIRTABLE_BASE_ID', 'EVENTS_TABLE_NAME', 'EXHIBITORS_TABLE_NAME', 'PARTICIPATION_TABLE_NAME'].includes(key);
        if (Deno.env.get(key)) {
          defined.push(key);
        } else if (hasConfigFallback) {
          defined.push(`${key} (via config)`);
        }
      }
    }

    const isComplete = missing.length === 0;

    const result = {
      ok: isComplete,
      defined,
      missing,
      message: isComplete 
        ? 'All required secrets are configured' 
        : `Missing ${missing.length} required secret(s): ${missing.join(', ')}`
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Check secrets error:', error);
    
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
