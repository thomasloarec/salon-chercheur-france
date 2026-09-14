// import-airtable-exposants — NEUTRALISEE le 14/09/2026 (lot 0, import listes exposants organisateur).
//
// Raison de la neutralisation :
//   Cette fonction ecrivait directement dans `participation` SANS la clause
//   `WHERE participation.source <> 'organizer'` que porte le pipeline vivant
//   (RPC load_participations_from_staging). Elle constituait le seul chemin
//   capable d'ecraser un stand fourni par un organisateur.
//   Son upsert visait par ailleurs un conflit `id_event,id_exposant` qui ne
//   correspond a AUCUNE contrainte UNIQUE existante : la seule est
//   `participation_exposant_event_unique (id_exposant, id_event_text)`.
//
// Verifications faites avant neutralisation :
//   - 0 appelant dans le repo (grep sur .ts/.tsx/.js/.json/.sql/.toml)
//   - 0 appel dans les logs edge sur 24 h
//
// Pipeline de remplacement : import-airtable + RPC load_participations_from_staging.
//
// Ne pas reactiver. Si un besoin d'import exposants reapparait, passer par le
// pipeline de staging, qui porte les garde-fous `source` et `stand_locked`.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Journalisation des appels residuels, sans jamais relayer le corps de la requete
  // (il contiendrait une cle API Airtable).
  console.warn(
    '[import-airtable-exposants] appel sur une fonction neutralisee',
    JSON.stringify({
      method: req.method,
      origin: req.headers.get('Origin'),
      referer: req.headers.get('Referer'),
      user_agent: req.headers.get('User-Agent'),
      at: new Date().toISOString(),
    }),
  );

  return new Response(
    JSON.stringify({
      error: 'gone',
      message:
        "Fonction retiree le 14/09/2026. L'import des exposants et des participations passe desormais par import-airtable et la RPC load_participations_from_staging, qui respectent les garde-fous source='organizer' et stand_locked.",
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
