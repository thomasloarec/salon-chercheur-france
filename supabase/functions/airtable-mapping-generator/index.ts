
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAdmin } from '../_shared/admin-auth.ts';
// Correctif sécurité 07/10/2026 : réservée aux admins.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Algorithme de distance de Levenshtein pour fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
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
  
  return matrix[str2.length][str1.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return ((maxLength - distance) / maxLength) * 100;
}

function findBestMatch(codeField: string, airtableFields: string[]): { field: string, confidence: number } {
  let bestMatch = '';
  let bestConfidence = 0;
  
  for (const airtableField of airtableFields) {
    const confidence = calculateSimilarity(codeField, airtableField);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = airtableField;
    }
  }
  
  return { field: bestMatch, confidence: bestConfidence };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireAdmin(req, corsHeaders, 'airtable-mapping-generator');
  if (denied) return denied;

  try {
    console.log('[mapping-generator] 🔍 Début de la génération du mapping automatique');

    const { airtableSchemas, codeAnalysis } = await req.json();

    if (!airtableSchemas || !codeAnalysis) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_input_data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mappingResults: Record<string, any> = {};

    // Traiter chaque table
    for (const tableName of Object.keys(codeAnalysis.interfaces)) {
      console.log(`[mapping-generator] 🔍 Traitement de ${tableName}...`);
      
      const codeFields = codeAnalysis.interfaces[tableName];
      const airtableSchema = airtableSchemas[tableName];
      
      if (!airtableSchema) {
        console.warn(`[mapping-generator] ⚠️ Schema Airtable manquant pour ${tableName}`);
        continue;
      }
      
      const airtableFieldNames = airtableSchema.columns.map((col: any) => col.name);
      console.log(`[mapping-generator] 📋 ${tableName}: ${codeFields.length} champs code vs ${airtableFieldNames.length} champs Airtable`);
      
      const mapping: Record<string, string> = {};
      const confidenceScores: Record<string, number> = {};
      const orphanFields: string[] = [];
      const unmappedAirtableFields: string[] = [...airtableFieldNames];
      
      // Mapper chaque champ du code vers Airtable
      for (const codeField of codeFields) {
        const { field: bestMatch, confidence } = findBestMatch(codeField.fieldName, airtableFieldNames);
        
        console.log(`[mapping-generator] 🎯 ${codeField.fieldName} → ${bestMatch} (${confidence.toFixed(1)}% confiance)`);
        
        if (confidence >= 70) { // Seuil de confiance acceptable
          mapping[codeField.fieldName] = bestMatch;
          confidenceScores[codeField.fieldName] = confidence;
          
          // Retirer des champs non mappés
          const index = unmappedAirtableFields.indexOf(bestMatch);
          if (index > -1) {
            unmappedAirtableFields.splice(index, 1);
          }
        } else {
          orphanFields.push(codeField.fieldName);
          console.warn(`[mapping-generator] ⚠️ Champ orphelin: ${codeField.fieldName} (meilleur match: ${bestMatch} à ${confidence.toFixed(1)}%)`);
        }
      }
      
      // Détecter les mappings exacts (100% de confiance)
      const exactMatches = Object.entries(confidenceScores).filter(([_, conf]) => conf === 100);
      const fuzzyMatches = Object.entries(confidenceScores).filter(([_, conf]) => conf < 100 && conf >= 70);
      
      mappingResults[tableName] = {
        mapping,
        confidenceScores,
        orphanFields,
        unmappedAirtableFields,
        statistics: {
          totalCodeFields: codeFields.length,
          totalAirtableFields: airtableFieldNames.length,
          mappedFields: Object.keys(mapping).length,
          exactMatches: exactMatches.length,
          fuzzyMatches: fuzzyMatches.length,
          orphanFields: orphanFields.length,
          unmappedAirtableFields: unmappedAirtableFields.length,
          averageConfidence: Object.values(confidenceScores).length > 0 
            ? Object.values(confidenceScores).reduce((a, b) => a + b, 0) / Object.values(confidenceScores).length 
            : 0
        }
      };
      
      console.log(`[mapping-generator] ✅ ${tableName} terminé: ${Object.keys(mapping).length}/${codeFields.length} champs mappés (${mappingResults[tableName].statistics.averageConfidence.toFixed(1)}% confiance moyenne)`);
    }

    // Générer le rapport final
    const report = {
      success: true,
      timestamp: new Date().toISOString(),
      mappings: mappingResults,
      globalStatistics: {
        totalTables: Object.keys(mappingResults).length,
        totalMappedFields: Object.values(mappingResults).reduce((acc, table: any) => acc + table.statistics.mappedFields, 0),
        totalOrphanFields: Object.values(mappingResults).reduce((acc, table: any) => acc + table.statistics.orphanFields, 0),
        averageGlobalConfidence: Object.values(mappingResults).length > 0
          ? Object.values(mappingResults).reduce((acc, table: any) => acc + table.statistics.averageConfidence, 0) / Object.values(mappingResults).length
          : 0
      }
    };

    console.log('[mapping-generator] 🎉 Génération terminée avec succès');
    console.log(`[mapping-generator] 📊 Global: ${report.globalStatistics.totalMappedFields} champs mappés, ${report.globalStatistics.totalOrphanFields} orphelins, ${report.globalStatistics.averageGlobalConfidence.toFixed(1)}% confiance moyenne`);

    return new Response(
      JSON.stringify(report, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mapping-generator] ❌ Erreur:', error);
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
