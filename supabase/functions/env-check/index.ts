// env-check (correctif sécurité, 07/10/2026)
// Réservée aux admins. Renvoie uniquement la présence des variables, jamais leur valeur.
import { requireAdmin } from '../_shared/admin-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireAdmin(req, corsHeaders, 'env-check');
  if (denied) return denied;

  const requiredVars = [
    'AIRTABLE_PAT',
    'AIRTABLE_BASE_ID',
    'EVENTS_TABLE_NAME',
    'EXHIBITORS_TABLE_NAME',
    'PARTICIPATION_TABLE_NAME',
  ];
  const missing: string[] = [];
  const defined: Record<string, boolean> = {};
  for (const name of requiredVars) {
    const present = !!Deno.env.get(name);
    defined[name] = present;
    if (!present) missing.push(name);
  }

  return new Response(
    JSON.stringify({ ok: missing.length === 0, missing, defined, timestamp: new Date().toISOString() }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
