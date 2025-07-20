
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { AIRTABLE_CONFIG } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REQUIRED_VARS = [
      'AIRTABLE_PAT',
      'AIRTABLE_BASE_ID',
      'EVENTS_TABLE_NAME',
      'EXHIBITORS_TABLE_NAME',
      'PARTICIPATION_TABLE_NAME'
    ];

    const defined: string[] = [];
    const missing: string[] = [];

    for (const key of REQUIRED_VARS) {
      const envValue = Deno.env.get(key);
      const hasConfigFallback = ['AIRTABLE_BASE_ID', 'EVENTS_TABLE_NAME', 'EXHIBITORS_TABLE_NAME', 'PARTICIPATION_TABLE_NAME'].includes(key);
      
      if (envValue) {
        defined.push(key);
      } else if (hasConfigFallback) {
        // Check if config has the value
        const hasValue = key === 'AIRTABLE_BASE_ID' ? !!AIRTABLE_CONFIG.BASE_ID :
                         key === 'EVENTS_TABLE_NAME' ? !!AIRTABLE_CONFIG.TABLES.EVENTS :
                         key === 'EXHIBITORS_TABLE_NAME' ? !!AIRTABLE_CONFIG.TABLES.EXHIBITORS :
                         key === 'PARTICIPATION_TABLE_NAME' ? !!AIRTABLE_CONFIG.TABLES.PARTICIPATION :
                         false;
        
        if (hasValue) {
          defined.push(`${key} (via config)`);
        } else {
          missing.push(key);
        }
      } else {
        missing.push(key);
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
