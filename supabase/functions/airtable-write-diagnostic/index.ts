// DÉSACTIVÉE POUR RAISON DE SÉCURITÉ — 13/09/2026
//
// Cette fonction acceptait, SANS AUCUNE AUTHENTIFICATION, un nom de table
// arbitraire, un mapping arbitraire et un payload arbitraire, puis écrivait
// dans la base Airtable de production avec le PAT du projet.
// N'importe qui sur Internet pouvait créer des enregistrements de son choix,
// qui remontaient ensuite dans Supabase via import-airtable.
//
// Elle n'était plus appelée nulle part dans l'application.
// Corps remplacé par un stub inerte plutôt qu'une suppression sèche, pour que
// tout appel résiduel échoue de façon explicite et traçable.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn('[airtable-write-diagnostic] appel sur une fonction désactivée', {
    method: req.method,
    origin: req.headers.get('Origin'),
    ua: req.headers.get('User-Agent'),
  });

  return new Response(
    JSON.stringify({
      success: false,
      error: 'gone',
      message: 'Fonction de diagnostic désactivée pour raison de sécurité (écriture Airtable non authentifiée).',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
