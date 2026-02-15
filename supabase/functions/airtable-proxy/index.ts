
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { AIRTABLE_CONFIG, listMissing, getEnvOrConfig, debugVariables } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cache pour stocker les champs valides de chaque table
const tableFieldsCache = new Map<string, string[]>();

// Fonction pour calculer la distance de Levenshtein
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Fonction pour normaliser une chaîne (supprime accents, espaces, met en minuscules)
function normalizeString(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Fonction pour trouver le champ le plus proche
function findClosestField(key: string, validFields: string[]): string | null {
  const normalizedKey = normalizeString(key);
  let bestMatch = null;
  let bestScore = Infinity;
  
  for (const field of validFields) {
    const normalizedField = normalizeString(field);
    
    // Correspondance exacte après normalisation
    if (normalizedKey === normalizedField) {
      return field;
    }
    
    // Calcul de la distance de Levenshtein
    const distance = levenshteinDistance(normalizedKey, normalizedField);
    const maxLength = Math.max(normalizedKey.length, normalizedField.length);
    const similarity = 1 - (distance / maxLength);
    
    // Accepter seulement si similarité > 70%
    if (similarity > 0.7 && distance < bestScore) {
      bestScore = distance;
      bestMatch = field;
    }
  }
  
  return bestScore <= 2 ? bestMatch : null;
}

// Fonction pour récupérer les champs valides d'une table
async function getValidFields(tableName: string, AIRTABLE_PAT: string, AIRTABLE_BASE_ID: string): Promise<string[]> {
  const cacheKey = `${AIRTABLE_BASE_ID}_${tableName}`;
  
  // Vérifier le cache d'abord
  if (tableFieldsCache.has(cacheKey)) {
    console.log(`[airtable-proxy] 📋 Using cached fields for ${tableName}`);
    return tableFieldsCache.get(cacheKey)!;
  }
  
  try {
    console.log(`[airtable-proxy] 📡 Fetching metadata for table: ${tableName}`);
    
    const metadataUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}`;
    const response = await fetch(metadataUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[airtable-proxy] ❌ Failed to fetch metadata: ${response.status}`);
      return [];
    }
    
    const metadata = await response.json();
    const table = metadata.tables?.find((t: any) => t.name === tableName);
    
    if (!table) {
      console.error(`[airtable-proxy] ❌ Table ${tableName} not found in metadata`);
      return [];
    }
    
    const validFields = table.fields?.map((field: any) => field.name) || [];
    console.log(`[airtable-proxy] ✅ Retrieved ${validFields.length} fields for ${tableName}:`, validFields);
    
    // Mettre en cache pour 5 minutes
    tableFieldsCache.set(cacheKey, validFields);
    setTimeout(() => tableFieldsCache.delete(cacheKey), 5 * 60 * 1000);
    
    return validFields;
  } catch (error) {
    console.error(`[airtable-proxy] ❌ Error fetching metadata for ${tableName}:`, error);
    return [];
  }
}

// Fonction pour normaliser le payload
function normalizePayload(payload: any[], validFields: string[], tableName: string): any[] {
  console.log(`[airtable-proxy] 🔧 Normalizing payload for ${tableName}`);
  console.log(`[airtable-proxy] 📋 Valid fields:`, validFields);
  
  return payload.map((record, index) => {
    console.log(`[airtable-proxy] 📝 Record ${index + 1} - Keys before normalization:`, Object.keys(record));
    
    const normalizedRecord: any = {};
    const ignoredKeys: string[] = [];
    
    for (const [key, value] of Object.entries(record)) {
      // Vérifier si le champ existe exactement
      if (validFields.includes(key)) {
        normalizedRecord[key] = value;
        continue;
      }
      
      // Chercher le champ le plus proche
      const closestField = findClosestField(key, validFields);
      if (closestField) {
        console.log(`[airtable-proxy] 🔄 Mapping "${key}" → "${closestField}"`);
        normalizedRecord[closestField] = value;
      } else {
        console.log(`[airtable-proxy] ⚠️ Ignored unknown field: "${key}"`);
        ignoredKeys.push(key);
      }
    }
    
    console.log(`[airtable-proxy] 📝 Record ${index + 1} - Keys after normalization:`, Object.keys(normalizedRecord));
    if (ignoredKeys.length > 0) {
      console.log(`[airtable-proxy] 🗑️ Record ${index + 1} - Ignored keys:`, ignoredKeys);
    }
    
    return normalizedRecord;
  });
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
    console.log(`[airtable-proxy] 🔑 PAT présente: ${AIRTABLE_PAT ? 'OUI' : 'NON'}`);

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
          // 🆕 RÉCUPÉRATION DES CHAMPS VALIDES ET NORMALISATION
          console.log(`[airtable-proxy][DEBUG] CREATE sur table: ${table}`);
          
          // Récupérer les champs valides pour cette table
          const validFields = await getValidFields(table, AIRTABLE_PAT, AIRTABLE_BASE_ID);
          
          if (validFields.length === 0) {
            console.warn(`[airtable-proxy] ⚠️ No valid fields found for table ${table}, proceeding without normalization`);
          }
          
          // Normaliser le payload
          const normalizedPayload = validFields.length > 0 
            ? normalizePayload(payload, validFields, table)
            : payload;
          
          console.log(`[airtable-proxy][DEBUG] Payload normalisé: ${normalizedPayload?.length || 0} records`);
          console.log(`[airtable-proxy][DEBUG] URL complète: ${airtableUrl}`);
          
          try {
            response = await fetch(`${airtableUrl}`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${AIRTABLE_PAT}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ records: normalizedPayload.map((item: any) => ({ fields: item })) }),
            });

            // Gestion spéciale des erreurs 422 (doublons) avec debug détaillé
            if (!response.ok && response.status === 422) {
              const errorBody = await response.text();
              
              // 🔍 DEBUG AVANCÉ: Logging détaillé de l'erreur 422
              console.log(`[airtable-proxy][DEBUG] 422 on ${normalizedPayload?.length || 0} records`);
              console.log(`[airtable-proxy][DEBUG] 422 error type:`, errorBody.slice(0, 100));
              
              try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson.error?.type === 'UNPROCESSABLE_ENTITY') {
                  console.log(`[airtable-proxy] Duplicate detected on ${table}, returning 200.`);
                  return new Response(
                    JSON.stringify({
                      success: true,
                      duplicate: true,
                      message: 'Record already exists'
                    }),
                    {
                      status: 200,
                      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    }
                  );
                }
              } catch (parseError) {
                console.log(`[airtable-proxy] Could not parse 422 error body as JSON:`, parseError);
              }
              
              // Si ce n'est pas un doublon reconnu, provisoirement renvoyer l'erreur 422 avec le body complet pour diagnostic
              return new Response(
                JSON.stringify({
                  success: false,
                  error: 'airtable_422_debug',
                  status: 422,
                  table: table,
                  payload: normalizedPayload,
                  airtableErrorBody: errorBody,
                  message: 'Debug 422 - voir logs pour détails'
                }),
                {
                  status: 422,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          } catch (createError) {
            console.error(`[airtable-proxy] ❌ Erreur lors de la création:`, createError);
            throw createError;
          }
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
          message: `Network/Fetch error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
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
