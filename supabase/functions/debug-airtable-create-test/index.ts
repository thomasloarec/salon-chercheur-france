// debug-airtable-create-test : NEUTRALISÉE (correctif sécurité, 07/10/2026).
// L'ancienne version écrivait un enregistrement de test dans la table Airtable
// All_Exposants sans aucune authentification. Fonction de diagnostic retirée :
// elle répond 410 à tout appel et ne contacte plus Airtable.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ success: false, error: 'gone', message: 'Fonction de diagnostic retirée.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
