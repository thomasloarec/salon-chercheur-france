// check-secrets (correctif sécurité, 07/10/2026)
// Réservée aux admins. Ne renvoie plus aucun fragment de valeur : seulement
// la présence (booléens) des variables attendues.
import { listMissing } from '../_shared/airtable-config.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REQUIRED_VARS = [
  'AIRTABLE_PAT',
  'AIRTABLE_BASE_ID',
  'EVENTS_TABLE_NAME',
  'EXHIBITORS_TABLE_NAME',
  'PARTICIPATION_TABLE_NAME',
];
const CONFIG_FALLBACK = ['AIRTABLE_BASE_ID', 'EVENTS_TABLE_NAME', 'EXHIBITORS_TABLE_NAME', 'PARTICIPATION_TABLE_NAME'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireAdmin(req, corsHeaders, 'check-secrets');
  if (denied) return denied;

  try {
    const missingSecrets = listMissing();
    const defined: string[] = [];
    const presence: Record<string, boolean> = {};

    for (const key of REQUIRED_VARS) {
      const hasEnv = !!Deno.env.get(key);
      presence[key] = hasEnv;
      if (hasEnv) defined.push(key);
      else if (CONFIG_FALLBACK.includes(key)) defined.push(`${key} (via config)`);
    }

    const isComplete = missingSecrets.length === 0;
    return new Response(
      JSON.stringify({
        ok: isComplete,
        defined,
        missing: missingSecrets,
        message: isComplete
          ? 'All required secrets are configured'
          : `Missing ${missingSecrets.length} required secret(s): ${missingSecrets.join(', ')}`,
        debug: presence,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
