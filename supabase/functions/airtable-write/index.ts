// airtable-write — durci le 13/09/2026
//
// AVANT : le contrôle d'accès était factice. La fonction acceptait toute requête
// portant l'en-tête `x-lovable-admin: true` (choisi librement par l'appelant) OU
// n'importe quel en-tête Authorization, jamais vérifié. Un anonyme pouvait donc
// créer des enregistrements dans la base Airtable de production.
//
// APRÈS : même pattern que premium-grant / novelties-moderate.
//   - soit la clé service_role (automatisations serveur, n8n, cron),
//   - soit un JWT utilisateur dont le compte porte le rôle admin dans user_roles
//     (même source de vérité que la fonction SQL is_admin()).
// Le reste du comportement (mapping, dédoublonnage, appel Airtable) est
// strictement identique à la version précédente.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-admin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const mapping: Record<string, Record<string, string>> = {
  All_Events: {
    id_event: 'id_event',
    nom_event: 'nom_event',
    type_event: 'type_event',
    date_debut: 'date_debut',
    date_fin: 'date_fin',
    secteur: 'secteur',
    url_image: 'url_image',
    url_site_officiel: 'url_site_officiel',
    description_event: 'description_event',
    affluence: 'affluence',
    tarif: 'tarif',
    nom_lieu: 'nom_lieu',
    rue: 'rue',
    code_postal: 'code_postal',
    ville: 'ville',
    pays: 'pays',
  },
  All_Exposants: {
    id_exposant: 'id_exposant',
    nom_exposant: 'nom_exposant',
    website_exposant: 'website_exposant',
    exposant_description: 'exposant_description',
  },
  Participation: {
    id_participation: 'id_participation',
    nom_exposant: 'nom_exposant',
    stand_exposant: 'stand_exposant',
    website_exposant: 'website_exposant',
    id_event: 'id_event',
    urlexpo_event: 'urlexpo_event',
  },
};

/** Retourne null si autorisé, sinon une Response d'erreur. */
async function authorize(req: Request): Promise<Response | null> {
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[airtable-write] refus : pas de Bearer token');
    return deny(401, 'unauthorized');
  }
  const token = authHeader.slice('Bearer '.length).trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('[airtable-write] configuration Supabase incomplète');
    return deny(500, 'server_misconfigured');
  }

  // Voie 1 : clé service_role (automatisations serveur).
  if (token === serviceKey) {
    console.log('[airtable-write] accès accordé : service_role');
    return null;
  }

  // Voie 2 : JWT utilisateur + rôle admin dans user_roles.
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    console.warn('[airtable-write] refus : JWT invalide');
    return deny(401, 'unauthorized');
  }

  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!role) {
    console.warn('[airtable-write] refus : utilisateur non admin', userData.user.id);
    return deny(403, 'forbidden');
  }

  console.log('[airtable-write] accès accordé : admin', userData.user.id);
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const denied = await authorize(req);
    if (denied) return denied;

    const { table, records } = await req.json();

    if (!table || !records) {
      return new Response(
        JSON.stringify({ success: false, error: 'Table and records parameters required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      console.error('[airtable-write] variables Airtable manquantes');
      return new Response(
        JSON.stringify({ success: false, error: 'missing_env' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tableMap = mapping[table];
    if (!tableMap) {
      return new Response(
        JSON.stringify({ success: false, schema: false, message: `Table ${table} non supportée` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const mappedRecords: Array<{ fields: Record<string, unknown> }> = [];
    for (const record of records) {
      const fields: Record<string, unknown> = {};
      const unknownKeys: string[] = [];

      for (const [payloadKey, value] of Object.entries(record as Record<string, unknown>)) {
        const airtableKey = tableMap[payloadKey];
        if (!airtableKey) {
          unknownKeys.push(payloadKey);
        } else {
          fields[airtableKey] = value;
        }
      }

      if (unknownKeys.length > 0) {
        console.warn('[airtable-write] champs ignorés :', unknownKeys);
      }

      if (Object.keys(fields).length === 0) {
        return new Response(
          JSON.stringify({ success: false, schema: false, message: `Aucun champ valide trouvé pour ${table}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      mappedRecords.push({ fields });
    }

    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;
    const payload = { records: mappedRecords };

    // Dédoublonnage avant création (comportement inchangé).
    if (mappedRecords.length > 0) {
      const firstRecord = mappedRecords[0].fields as Record<string, string>;
      let filterFormula = '';

      if (table === 'All_Exposants' && firstRecord.nom_exposant) {
        filterFormula = `{nom_exposant}='${String(firstRecord.nom_exposant).replace(/'/g, "\\'")}'`;
      } else if (table === 'Participation' && firstRecord.website_exposant) {
        filterFormula = `{website_exposant}='${String(firstRecord.website_exposant).replace(/'/g, "\\'")}'`;
      }

      if (filterFormula) {
        try {
          const duplicateResponse = await fetch(
            `${airtableUrl}?filterByFormula=${encodeURIComponent(filterFormula)}`,
            { method: 'GET', headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } },
          );
          if (duplicateResponse.ok) {
            const duplicateData = await duplicateResponse.json();
            if (duplicateData.records && duplicateData.records.length > 0) {
              return new Response(
                JSON.stringify({ success: true, duplicate: true, message: 'Duplicate record found' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          }
        } catch (duplicateError) {
          console.warn('[airtable-write] échec vérification doublon :', duplicateError);
        }
      }
    }

    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[airtable-write] erreur Airtable ${response.status}`);
      if (response.status === 422) {
        return new Response(
          JSON.stringify({ success: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'airtable_error', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = JSON.parse(responseText);
    console.log(`[airtable-write] succès ${table} : ${data.records?.length ?? 0} enregistrement(s)`);

    return new Response(
      JSON.stringify({ success: true, records: data.records ?? [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[airtable-write] exception :', error);
    return new Response(
      JSON.stringify({ success: false, error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
