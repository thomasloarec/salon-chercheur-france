
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CodeFieldInfo {
  fieldName: string;
  type: string;
  required: boolean;
  source: string; // 'interface' | 'test' | 'mapping'
}

interface CodeAnalysisResult {
  interfaces: Record<string, CodeFieldInfo[]>;
  testPayloads: Record<string, any[]>;
  currentMappings: Record<string, any>;
  summary: {
    totalFields: number;
    requiredFields: number;
    optionalFields: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[code-analysis] 🔍 Début de l\'analyse du code existant');

    // Analyse des interfaces TypeScript actuelles (simulé - données extraites manuellement)
    const codeAnalysis: CodeAnalysisResult = {
      interfaces: {
        'All_Events': [
          { fieldName: 'id_event', type: 'string', required: true, source: 'interface' },
          { fieldName: 'nom_event', type: 'string', required: true, source: 'interface' },
          { fieldName: 'type_event', type: 'string', required: true, source: 'interface' },
          { fieldName: 'date_debut', type: 'string', required: true, source: 'interface' },
          { fieldName: 'date_fin', type: 'string', required: true, source: 'interface' },
          { fieldName: 'secteur', type: 'string', required: true, source: 'interface' },
          { fieldName: 'url_image', type: 'string', required: false, source: 'interface' },
          { fieldName: 'url_site_officiel', type: 'string', required: false, source: 'interface' },
          { fieldName: 'description_event', type: 'string', required: false, source: 'interface' },
          { fieldName: 'affluence', type: 'number', required: false, source: 'interface' },
          { fieldName: 'tarif', type: 'string', required: false, source: 'interface' },
          { fieldName: 'nom_lieu', type: 'string', required: false, source: 'interface' },
          { fieldName: 'rue', type: 'string', required: false, source: 'interface' },
          { fieldName: 'code_postal', type: 'string', required: false, source: 'interface' },
          { fieldName: 'ville', type: 'string', required: false, source: 'interface' },
          { fieldName: 'pays', type: 'string', required: false, source: 'interface' }
        ],
        'All_Exposants': [
          { fieldName: 'id_exposant', type: 'string', required: false, source: 'interface' },
          { fieldName: 'nom_exposant', type: 'string', required: true, source: 'interface' },
          { fieldName: 'exposant_nom', type: 'string', required: false, source: 'interface' }, // Alias
          { fieldName: 'website_exposant', type: 'string', required: true, source: 'interface' },
          { fieldName: 'exposant_description', type: 'string', required: false, source: 'interface' }
        ],
        'Participation': [
          { fieldName: 'id_participation', type: 'string', required: false, source: 'interface' },
          { fieldName: 'id_event', type: 'string', required: false, source: 'interface' },
          { fieldName: 'nom_exposant', type: 'string', required: false, source: 'interface' },
          { fieldName: 'exposant_nom', type: 'string', required: false, source: 'interface' }, // Alias
          { fieldName: 'stand_exposant', type: 'string', required: false, source: 'interface' },
          { fieldName: 'website_exposant', type: 'string', required: false, source: 'interface' },
          { fieldName: 'urlexpo_event', type: 'string', required: true, source: 'interface' }
        ]
      },
      testPayloads: {
        'All_Events': [
          {
            id_event: 'test-event-001',
            nom_event: 'Test Event',
            type_event: 'salon',
            date_debut: '2024-06-01',
            date_fin: '2024-06-03',
            secteur: 'Technology',
            ville: 'Paris',
            pays: 'France'
          }
        ],
        'All_Exposants': [
          {
            nom_exposant: 'Test Company',
            website_exposant: 'https://test-company.com',
            exposant_description: 'Test description'
          }
        ],
        'Participation': [
          {
            id_participation: crypto.randomUUID(),
            nom_exposant: 'Test Company',
            stand_exposant: 'A123',
            website_exposant: 'https://test-company.com',
            urlexpo_event: `test-participation-${Date.now()}`
          }
        ]
      },
      currentMappings: {
        'All_Events': {
          'id_event': 'id_event',
          'nom_event': 'nom_event',
          'type_event': 'type_event',
          'date_debut': 'date_debut',
          'date_fin': 'date_fin',
          'secteur': 'secteur',
          'url_image': 'url_image',
          'url_site_officiel': 'url_site_officiel',
          'description_event': 'description_event',
          'affluence': 'affluence',
          'tarif': 'tarif',
          'nom_lieu': 'nom_lieu',
          'rue': 'rue',
          'code_postal': 'code_postal',
          'ville': 'ville',
          'pays': 'pays'
        },
        'All_Exposants': {
          'id_exposant': 'id_exposant',
          'nom_exposant': 'nom_exposant',
          'exposant_nom': 'nom_exposant',
          'website_exposant': 'website_exposant',
          'exposant_description': 'exposant_description'
        },
        'Participation': {
          'id_participation': 'id_participation',
          'nom_exposant': 'nom_exposant',
          'exposant_nom': 'nom_exposant',
          'stand_exposant': 'stand_exposant',
          'website_exposant': 'website_exposant',
          'id_event': 'id_event',
          'urlexpo_event': 'urlexpo_event'
        }
      },
      summary: {
        totalFields: 0,
        requiredFields: 0,
        optionalFields: 0
      }
    };

    // Calculer les statistiques
    let totalFields = 0;
    let requiredFields = 0;
    let optionalFields = 0;

    Object.values(codeAnalysis.interfaces).forEach(fields => {
      totalFields += fields.length;
      requiredFields += fields.filter(f => f.required).length;
      optionalFields += fields.filter(f => !f.required).length;
    });

    codeAnalysis.summary = { totalFields, requiredFields, optionalFields };

    console.log('[code-analysis] 📊 Analyse terminée:');
    console.log(`  - ${totalFields} champs au total`);
    console.log(`  - ${requiredFields} champs obligatoires`);
    console.log(`  - ${optionalFields} champs optionnels`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        analysis: codeAnalysis
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[code-analysis] ❌ Erreur:', error);
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
