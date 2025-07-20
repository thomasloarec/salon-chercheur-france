
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { AIRTABLE_CONFIG, listMissing, getEnvOrConfig, debugVariables } from '../_shared/airtable-config.ts';

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
    console.log('[airtable-proxy] 🔍 Début de la requête');
    
    // 1. Vérification stricte des secrets Supabase (sans fallback)
    const missingSecrets = listMissing();
    if (missingSecrets.length > 0) {
      console.error('[airtable-proxy] ❌ Variables Supabase manquantes:', missingSecrets);
      console.log('[airtable-proxy] 📊 Debug variables:', debugVariables());
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'missing_env', 
          missing: missingSecrets,
          message: `Variables Supabase manquantes: ${missingSecrets.join(', ')}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Récupération des valeurs (avec fallbacks)
    const AIRTABLE_PAT = getEnvOrConfig('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = getEnvOrConfig('AIRTABLE_BASE_ID');
    
    console.log('[airtable-proxy] ✅ Variables OK, Base ID:', AIRTABLE_BASE_ID.substring(0, 10) + '...');

    // 3. Vérification API key Supabase
    const apiKey = req.headers.get('apikey');
    if (apiKey !== Deno.env.get('SUPABASE_ANON_KEY')) {
      console.error('[airtable-proxy] ❌ Clé API Supabase invalide');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'unauthorized', 
          message: 'Invalid API key' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Parsing des paramètres
    const { action, table, payload, uniqueField } = await req.json();

    if (!table) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'missing_table', 
          message: 'Table name is required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!action) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'missing_action', 
          message: 'Action is required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[airtable-proxy] 📋 Action: ${action}, Table: ${table}`);

    // 5. Construction de l'URL Airtable
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;
    
    // 🔍 NOUVEAU: Log détaillé de l'URL (sans exposer la PAT)
    console.log(`[airtable-proxy] 🌐 URL Airtable: https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`);
    console.log(`[airtable-proxy] 🔑 PAT présente: ${AIRTABLE_PAT ? 'OUI (***' + AIRTABLE_PAT.slice(-4) + ')' : 'NON'}`);

    // 6. Exécution de l'action
    let response;
    try {
      switch (action) {
        case 'LIST':
          response = await fetch(`${airtableUrl}`, {
            headers: {
              Authorization: `Bearer ${AIRTABLE_PAT}`,
              'Content-Type': 'application/json',
            },
          });
          break;
          
        case 'CREATE':
          response = await fetch(`${airtableUrl}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${AIRTABLE_PAT}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records: payload.map((item: any) => ({ fields: item })) }),
          });
          break;
          
        case 'FIND':
          const findUrl = `${airtableUrl}?filterByFormula=({${payload.fieldName}}="${payload.value}")`;
          console.log(`[airtable-proxy] 🔍 FIND URL: ${findUrl}`);
          response = await fetch(findUrl, {
            headers: {
              Authorization: `Bearer ${AIRTABLE_PAT}`,
              'Content-Type': 'application/json',
            },
          });
          break;
          
        case 'UPSERT':
          if (!uniqueField) {
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'missing_unique_field', 
                message: 'Unique field is required for upsert' 
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          // Logique UPSERT complète...
          const findExistingUrl = `${airtableUrl}?filterByFormula=OR(${payload
            .map((item: any) => `({${uniqueField}}="${item[uniqueField]}")`)
            .join(',')})`;

          console.log(`[airtable-proxy] 🔍 UPSERT FIND URL: ${findExistingUrl}`);

          const findExistingResponse = await fetch(findExistingUrl, {
            headers: {
              Authorization: `Bearer ${AIRTABLE_PAT}`,
              'Content-Type': 'application/json',
            },
          });

          if (!findExistingResponse.ok) {
            const errorText = await findExistingResponse.text();
            console.error(`[airtable-proxy] ❌ Erreur FIND pour UPSERT (${findExistingResponse.status}):`, errorText);
            
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'airtable_error',
                status: findExistingResponse.status,
                statusText: findExistingResponse.statusText,
                body: errorText,
                context: 'UPSERT_FIND'
              }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          const findResult = await findExistingResponse.json();
          const existingRecords = findResult.records || [];

          const toCreate = payload.filter(
            (item: any) => !existingRecords.find((record: any) => record.fields[uniqueField] === item[uniqueField])
          );
          const toUpdate = payload.filter((item: any) =>
            existingRecords.find((record: any) => record.fields[uniqueField] === item[uniqueField])
          );

          const results = { created: [], updated: [], toCreate: toCreate.length, toUpdate: toUpdate.length };

          if (toCreate.length > 0) {
            const createResponse = await fetch(`${airtableUrl}`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${AIRTABLE_PAT}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ records: toCreate.map((item: any) => ({ fields: item })) }),
            });

            if (createResponse.ok) {
              const createResult = await createResponse.json();
              results.created = createResult.records || [];
            }
          }

          if (toUpdate.length > 0) {
            const updateResponse = await fetch(`${airtableUrl}`, {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${AIRTABLE_PAT}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                records: toUpdate.map((item: any) => {
                  const existingRecord = existingRecords.find((record: any) => record.fields[uniqueField] === item[uniqueField]);
                  return { id: existingRecord.id, fields: item };
                }),
              }),
            });

            if (updateResponse.ok) {
              const updateResult = await updateResponse.json();
              results.updated = updateResult.records || [];
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              data: results,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );

        case 'DELETE':
          response = await fetch(`${airtableUrl}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${AIRTABLE_PAT}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records: payload.map((id: string) => ({ id })) }),
          });
          break;

        default:
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'invalid_action', 
              message: `Invalid action: ${action}` 
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
      }

      // 7. Gestion de la réponse Airtable
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[airtable-proxy] ❌ Erreur Airtable (${response.status} ${response.statusText}):`, errorText);
        console.error(`[airtable-proxy] 🔍 URL qui a échoué: https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`);
        
        // Diagnostic détaillé selon le code d'erreur
        let errorMessage = `Airtable API Error: ${response.status} ${response.statusText}`;
        let context = '';
        
        switch (response.status) {
          case 401:
            errorMessage = 'Authentification Airtable échouée - vérifiez AIRTABLE_PAT';
            context = 'INVALID_PAT';
            break;
          case 404:
            errorMessage = `Table "${table}" introuvable dans la base "${AIRTABLE_BASE_ID}" - vérifiez AIRTABLE_BASE_ID et le nom de table`;
            context = 'TABLE_NOT_FOUND';
            break;
          case 422:
            errorMessage = 'Données invalides envoyées à Airtable';
            context = 'INVALID_DATA';
            break;
          case 429:
            errorMessage = 'Quota Airtable dépassé - trop de requêtes';
            context = 'RATE_LIMIT';
            break;
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: 'airtable_error',
            status: response.status,
            statusText: response.statusText,
            message: errorMessage,
            body: errorText,
            context: context,
            debug: {
              action,
              table,
              baseId: AIRTABLE_BASE_ID.substring(0, 10) + '...',
              url: `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const result = await response.json();
      console.log(`[airtable-proxy] ✅ Succès ${action} sur ${table}`);

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (fetchError) {
      console.error('[airtable-proxy] ❌ Erreur réseau/fetch:', fetchError);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'network_error',
          message: `Network/Fetch error: ${fetchError.message}`,
          context: 'FETCH_FAILED'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error) {
    console.error('[airtable-proxy] ❌ Erreur générale:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        context: 'GENERAL_ERROR'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
