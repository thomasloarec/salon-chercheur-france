
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import mapping from '../_shared/airtable-mapping.json' with { type: 'json' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-admin',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[airtable-write] 🔍 Début de la requête d\'écriture');
    console.log('[airtable-write] Headers reçus:', Object.fromEntries(req.headers.entries()));

    // Vérifier le header admin de façon plus flexible
    const adminHeader = req.headers.get('x-lovable-admin') || req.headers.get('X-Lovable-Admin');
    const isAdminRequest = adminHeader === 'true';
    
    console.log('[airtable-write] Admin header:', adminHeader, 'Is admin:', isAdminRequest);

    // Pour les requêtes admin ou authentifiées, on continue
    const authHeader = req.headers.get('authorization');
    const hasAuth = !!authHeader;
    
    console.log('[airtable-write] Auth present:', hasAuth);

    if (!isAdminRequest && !hasAuth) {
      console.log('[airtable-write] ❌ Access denied (no admin header and no auth)');
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { table, records } = await req.json();

    if (!table || !records) {
      return new Response(
        JSON.stringify({ success: false, error: 'Table and records parameters required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      console.error('[airtable-write] ❌ Variables manquantes');
      return new Response(
        JSON.stringify({ success: false, error: 'missing_env', missing: ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID'] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[airtable-write] 📋 Écriture table: ${table}`);
    console.log(`[airtable-write] 🔑 PAT présente: OUI (***${AIRTABLE_PAT.slice(-4)})`);
    console.log(`[airtable-write] 📦 Records à traiter: ${records.length}`);

    // Get mapping for this table
    const tableMap = mapping[table as keyof typeof mapping];
    if (!tableMap) {
      console.error(`[airtable-write] ❌ Pas de mapping pour la table: ${table}`);
      return new Response(
        JSON.stringify({
          success: false,
          schema: false,
          message: `Table ${table} non supportée`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[airtable-write] 🗺️ Mapping disponible pour ${table}:`, Object.keys(tableMap));

    // Process records with mapping
    const mappedRecords = [];
    for (const record of records) {
      const fields: Record<string, any> = {};
      const unknownKeys: string[] = [];
      const keysBefore = Object.keys(record);

      console.log(`[airtable-write] 🔍 Keys avant mapping:`, keysBefore);

      for (const [payloadKey, value] of Object.entries(record)) {
        const airtableKey = tableMap[payloadKey as keyof typeof tableMap];
        
        if (!airtableKey) {
          unknownKeys.push(payloadKey);
          console.warn(`[airtable-write] ⚠️ Champ inconnu ignoré: ${payloadKey}`);
        } else {
          fields[airtableKey] = value;
          console.log(`[airtable-write] 📍 Mapping appliqué: ${payloadKey} → ${airtableKey}`);
        }
      }

      const keysAfter = Object.keys(fields);
      console.log(`[airtable-write] ✅ Keys après mapping:`, keysAfter);
      console.log(`[airtable-write] 📊 Mapping stage: { stage: "map", keys_before: ${JSON.stringify(keysBefore)}, keys_after: ${JSON.stringify(keysAfter)} }`);
      
      if (unknownKeys.length > 0) {
        console.warn(`[airtable-write] ⚠️ Champs ignorés:`, unknownKeys);
      }

      if (Object.keys(fields).length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            schema: false,
            message: `Aucun champ valide trouvé pour ${table}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      mappedRecords.push({ fields });
    }

    // Build Airtable URL
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;
    console.log(`[airtable-write] 🌐 URL Airtable: ${airtableUrl}`);

    // Prepare payload
    const payload = { records: mappedRecords };
    console.log(`[airtable-write] 📤 Payload final:`, JSON.stringify(payload, null, 2));

    // Check for duplicates before creating
    if (mappedRecords.length > 0) {
      const firstRecord = mappedRecords[0].fields;
      let duplicateCheckUrl = '';
      let filterFormula = '';
      
      if (table === 'All_Exposants' && firstRecord.nom_exposant) {
        filterFormula = `{nom_exposant}='${firstRecord.nom_exposant.replace(/'/g, "\\'")}'`;
      } else if (table === 'Participation' && firstRecord.website_exposant) {
        filterFormula = `{website_exposant}='${firstRecord.website_exposant.replace(/'/g, "\\'")}'`;
      }
      
      if (filterFormula) {
        duplicateCheckUrl = `${airtableUrl}?filterByFormula=${encodeURIComponent(filterFormula)}`;
        console.log(`[airtable-write] 🔍 Vérification doublon: ${duplicateCheckUrl}`);
        
        try {
          const duplicateResponse = await fetch(duplicateCheckUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_PAT}`,
            },
          });
          
          if (duplicateResponse.ok) {
            const duplicateData = await duplicateResponse.json();
            if (duplicateData.records && duplicateData.records.length > 0) {
              console.log(`[airtable-write] 🔄 Doublon détecté pour ${table}, retour avec duplicate: true`);
              return new Response(
                JSON.stringify({
                  success: true,
                  duplicate: true,
                  message: 'Duplicate record found'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } catch (duplicateError) {
          console.warn(`[airtable-write] ⚠️ Erreur lors de la vérification doublon:`, duplicateError);
          // Continue with creation if duplicate check fails
        }
      }
    }

    try {
      // Make request to Airtable
      const response = await fetch(airtableUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`[airtable-write] ❌ Erreur Airtable ${response.status}: ${responseText}`);
        
        // Handle 422 as duplicate detection
        if (response.status === 422) {
          let errorBody;
          try {
            errorBody = JSON.parse(responseText);
          } catch {
            errorBody = { message: responseText };
          }

          console.log(`[airtable-write] 🔄 Doublon détecté sur ${table}, retour 200`);
          return new Response(
            JSON.stringify({
              success: true,
              duplicate: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'airtable_error',
            status: response.status,
            message: responseText
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = JSON.parse(responseText);
      console.log(`[airtable-write] ✅ Succès écriture ${table}: ${data.records?.length || 0} records créés`);

      return new Response(
        JSON.stringify({
          success: true,
          records: data.records || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError) {
      console.error('[airtable-write] ❌ Exception fetch:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'network_error',
          message: fetchError instanceof Error ? fetchError.message : String(fetchError)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[airtable-write] ❌ Exception générale:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
