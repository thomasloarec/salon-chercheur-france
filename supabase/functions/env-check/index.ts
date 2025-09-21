
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Environment checker for Airtable integration

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requiredVars = [
      'AIRTABLE_PAT',
      'AIRTABLE_BASE_ID',
      'EVENTS_TABLE_NAME',
      'EXHIBITORS_TABLE_NAME',
      'PARTICIPATION_TABLE_NAME'
    ];

    const missing: string[] = [];
    const defined: Record<string, string> = {};

    for (const varName of requiredVars) {
      const value = Deno.env.get(varName);
      if (!value) {
        missing.push(varName);
      } else {
        // Mask sensitive values
        defined[varName] = varName === 'AIRTABLE_PAT' ? '***masked***' : value;
      }
    }

    const result = {
      ok: missing.length === 0,
      missing,
      defined,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(result, null, 2),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error checking environment variables:', error);
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
