
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiagnosticStep {
  step: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  data?: any;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableName, testPayload, mapping } = await req.json();
    
    if (!tableName || !testPayload || !mapping) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_required_parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const diagnosticSteps: DiagnosticStep[] = [];
    const addStep = (step: string, status: 'success' | 'warning' | 'error', message: string, data?: any) => {
      diagnosticSteps.push({
        step,
        status,
        message,
        data,
        timestamp: new Date().toISOString()
      });
      console.log(`[write-diagnostic] ${status.toUpperCase()}: ${step} - ${message}`);
    };

    addStep('initialization', 'success', `Début du diagnostic d'écriture pour ${tableName}`, { tableName, payloadKeys: Object.keys(testPayload) });

    // Étape 1: Validation de l'environnement
    const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      addStep('environment_check', 'error', 'Variables d\'environnement manquantes', { 
        AIRTABLE_PAT: !!AIRTABLE_PAT, 
        AIRTABLE_BASE_ID: !!AIRTABLE_BASE_ID 
      });
      
      return new Response(
        JSON.stringify({ success: false, diagnosticSteps }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    addStep('environment_check', 'success', 'Variables d\'environnement OK', {
      pat_length: AIRTABLE_PAT.length,
      base_id: AIRTABLE_BASE_ID.substring(0, 8) + '...'
    });

    // Étape 2: Application du mapping
    addStep('mapping_start', 'success', 'Application du mapping', { originalPayload: testPayload, mapping });

    const mappedPayload: Record<string, any> = {};
    const unmappedFields: string[] = [];
    const mappingLog: Record<string, any> = {};

    for (const [originalKey, value] of Object.entries(testPayload)) {
      const mappedKey = mapping[originalKey];
      
      if (mappedKey) {
        mappedPayload[mappedKey] = value;
        mappingLog[originalKey] = { mappedTo: mappedKey, value, status: 'mapped' };
      } else {
        unmappedFields.push(originalKey);
        mappingLog[originalKey] = { mappedTo: null, value, status: 'unmapped' };
      }
    }

    if (unmappedFields.length > 0) {
      addStep('mapping_warning', 'warning', `${unmappedFields.length} champs non mappés`, { unmappedFields });
    }

    addStep('mapping_complete', 'success', `Mapping appliqué: ${Object.keys(mappedPayload).length} champs mappés`, { 
      mappedPayload, 
      mappingLog 
    });

    // Étape 3: Préparation de la requête Airtable
    const airtablePayload = {
      records: [{ fields: mappedPayload }]
    };

    addStep('request_preparation', 'success', 'Requête Airtable préparée', { airtablePayload });

    // Étape 4: Tentative de création
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`;
    
    addStep('request_sending', 'success', `Envoi de la requête vers ${airtableUrl}`);

    try {
      const response = await fetch(airtableUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(airtablePayload),
      });

      const responseText = await response.text();
      
      addStep('response_received', 'success', `Réponse reçue: HTTP ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyLength: responseText.length
      });

      if (response.ok) {
        // Succès !
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }
        
        addStep('creation_success', 'success', 'Enregistrement créé avec succès !', { 
          responseData,
          recordId: responseData?.records?.[0]?.id 
        });

        return new Response(
          JSON.stringify({
            success: true,
            created: true,
            recordId: responseData?.records?.[0]?.id,
            diagnosticSteps
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } else {
        // Erreur - Analyse détaillée
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText };
        }

        addStep('request_failed', 'error', `Requête échouée: HTTP ${response.status}`, { errorData });

        // Analyse spécifique des erreurs 422
        if (response.status === 422) {
          addStep('error_422_analysis', 'error', 'Analyse de l\'erreur 422', { errorData });

          const errorType = errorData.error?.type;
          const errorMessage = errorData.error?.message;

          // Diagnostics spécifiques selon le type d'erreur
          if (errorType === 'UNKNOWN_FIELD_NAME') {
            const fieldMatch = errorMessage?.match(/Unknown field name: "([^"]+)"/);
            const unknownField = fieldMatch?.[1];
            
            addStep('unknown_field_detected', 'error', `Champ inconnu détecté: ${unknownField}`, {
              unknownField,
              suggestion: 'Vérifier le mapping ou le nom exact du champ dans Airtable',
              availableFields: 'Utilisez airtable-schema-discovery pour obtenir la liste exacte'
            });

          } else if (errorType === 'INVALID_VALUE_FOR_COLUMN') {
            addStep('invalid_value_detected', 'error', `Valeur invalide pour une colonne`, {
              errorMessage,
              suggestion: 'Vérifier le type de données attendu par Airtable',
              sentData: mappedPayload
            });

          } else if (errorType === 'MISSING_REQUIRED_FIELD') {
            addStep('missing_required_field', 'error', `Champ obligatoire manquant`, {
              errorMessage,
              suggestion: 'Ajouter le champ obligatoire au payload',
              sentFields: Object.keys(mappedPayload)
            });

          } else {
            addStep('unknown_422_error', 'error', `Erreur 422 non reconnue`, {
              errorType,
              errorMessage,
              fullError: errorData
            });
          }

          // Tentative de suggestion de correction
          addStep('correction_suggestions', 'warning', 'Suggestions de correction', {
            suggestions: [
              'Relancer airtable-schema-discovery pour obtenir les noms exacts des champs',
              'Vérifier que tous les champs obligatoires sont présents',
              'Contrôler les types de données envoyés',
              'Tester avec un payload minimal'
            ]
          });
        }

        return new Response(
          JSON.stringify({
            success: false,
            created: false,
            error: {
              status: response.status,
              type: errorData.error?.type,
              message: errorData.error?.message,
              fullError: errorData
            },
            diagnosticSteps
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } catch (fetchError) {
      addStep('network_error', 'error', 'Erreur réseau lors de la requête', { 
        error: fetchError.message,
        stack: fetchError.stack 
      });

      return new Response(
        JSON.stringify({
          success: false,
          created: false,
          error: {
            type: 'network_error',
            message: fetchError.message
          },
          diagnosticSteps
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[write-diagnostic] ❌ Erreur générale:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
