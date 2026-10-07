
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-auth.ts'
// Correctif sécurité 07/10/2026 (2) : réservée aux admins ou à la clé service_role.
// L'ancien contrôle (en-tête X-Lovable-Admin: true) était falsifiable par n'importe qui.

interface ColumnInfo {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface TableSchema {
  columns: ColumnInfo[];
  sampleRecords: any[];
  totalRecords: number;
  metadata: {
    hasFormulas: boolean;
    hasLookups: boolean;
    hasLinkedRecords: boolean;
  };
}

serve(async (req) => {
  // 🚨 DEBUG CRITIQUE - Ces logs doivent apparaître même avec JWT ON
  console.log('🔥 CRITICAL DEBUG - Function called at all:', new Date().toISOString());
  console.log('🔥 Method:', req.method);
  console.log('🔥 URL:', req.url);
  console.log('🔥 Headers count:', Array.from(req.headers).length);
  
  // Log pour vérifier qu'on entre dans la fonction
  console.log('🔍 FUNCTION ENTRY - Method:', req.method);
  console.log('🔍 FUNCTION ENTRY - URL:', req.url);
  console.log('🔍 FUNCTION ENTRY - Headers preview:', req.headers.get('authorization') ? 'AUTH present' : 'NO AUTH');

  if (req.method === 'OPTIONS') return handleOptions(req);

  // 🔍 DEBUG: Logger tous les détails de la requête
  console.log('=== DEBUG SCHEMA DISCOVERY ===');
  console.log('Method:', req.method);
  
  try {
    const body = await req.clone().text();
    console.log('Body:', body);
  } catch (e) {
    console.log('No body or body read error:', e);
  }
  
  const denied = await requireAdmin(req, corsHeaders(req), 'airtable-schema-discovery');
  if (denied) return denied;

  try {
    console.log('[airtable-schema-discovery] 🔍 Début de la découverte des schémas');

    const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      return json({ success: false, error: 'missing_env' }, 500, req);
    }

    const TABLES_TO_SCAN = ['All_Events', 'All_Exposants', 'Participation'];
    const results: Record<string, TableSchema> = {};

    // Étape 1: Découvrir les métadonnées de la base
    console.log('[schema-discovery] 📋 Récupération des métadonnées de la base...');
    const baseMetaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
    
    const metaResponse = await fetch(baseMetaUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
    });

    if (!metaResponse.ok) {
      console.error('[schema-discovery] ❌ Erreur métadonnées:', metaResponse.status);
      return json({ 
        success: false, 
        error: 'metadata_error',
        status: metaResponse.status 
      }, metaResponse.status, req);
    }

    const metaData = await metaResponse.json();
    console.log('[schema-discovery] ✅ Métadonnées récupérées:', metaData.tables?.length, 'tables trouvées');

    // Étape 2: Analyser chaque table
    for (const tableName of TABLES_TO_SCAN) {
      console.log(`[schema-discovery] 🔍 Analyse de la table: ${tableName}`);
      
      try {
        // Trouver les métadonnées de cette table
        const tableMetadata = metaData.tables?.find((t: any) => t.name === tableName);
        
        if (!tableMetadata) {
          console.warn(`[schema-discovery] ⚠️ Table ${tableName} non trouvée dans les métadonnées`);
          continue;
        }

        // Extraire les informations des colonnes
        const columns: ColumnInfo[] = tableMetadata.fields.map((field: any) => ({
          name: field.name,
          type: field.type,
          required: field.options?.isRequired || false,
          description: field.description || undefined
        }));

        console.log(`[schema-discovery] 📊 ${tableName}: ${columns.length} colonnes détectées`);

        // Récupérer des échantillons de données
        console.log(`[schema-discovery] 📥 Récupération d'échantillons pour ${tableName}...`);
        const dataUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?maxRecords=10`;
        
        const dataResponse = await fetch(dataUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
        });

        let sampleRecords = [];
        let totalRecords = 0;

        if (dataResponse.ok) {
          const data = await dataResponse.json();
          sampleRecords = data.records || [];
          totalRecords = sampleRecords.length;
          console.log(`[schema-discovery] 📦 ${totalRecords} échantillons récupérés pour ${tableName}`);
        } else {
          console.warn(`[schema-discovery] ⚠️ Impossible de récupérer les données de ${tableName}:`, dataResponse.status);
        }

        // Analyser les métadonnées avancées
        const metadata = {
          hasFormulas: columns.some(col => col.type === 'formula'),
          hasLookups: columns.some(col => col.type === 'lookup'),
          hasLinkedRecords: columns.some(col => col.type === 'multipleRecordLinks')
        };

        results[tableName] = {
          columns,
          sampleRecords,
          totalRecords,
          metadata
        };

        console.log(`[schema-discovery] ✅ ${tableName} analysée: ${columns.length} colonnes, ${totalRecords} échantillons`);

      } catch (tableError) {
        console.error(`[schema-discovery] ❌ Erreur lors de l'analyse de ${tableName}:`, tableError);
        results[tableName] = {
          columns: [],
          sampleRecords: [],
          totalRecords: 0,
          metadata: { hasFormulas: false, hasLookups: false, hasLinkedRecords: false }
        };
      }
    }

    // Étape 3: Générer le rapport de diagnostic
    console.log('[schema-discovery] 📋 Génération du rapport final...');
    
    const diagnosticReport = {
      success: true,
      timestamp: new Date().toISOString(),
      baseId: AIRTABLE_BASE_ID,
      tablesAnalyzed: Object.keys(results),
      schemas: results,
      summary: {
        totalTables: Object.keys(results).length,
        totalColumns: Object.values(results).reduce((acc, table) => acc + table.columns.length, 0),
        totalSampleRecords: Object.values(results).reduce((acc, table) => acc + table.totalRecords, 0),
        tablesWithFormulas: Object.values(results).filter(table => table.metadata.hasFormulas).length,
        tablesWithLookups: Object.values(results).filter(table => table.metadata.hasLookups).length,
        tablesWithLinkedRecords: Object.values(results).filter(table => table.metadata.hasLinkedRecords).length
      }
    };

    console.log('[schema-discovery] 🎉 Diagnostic terminé avec succès');
    console.log(`[schema-discovery] 📊 Résumé: ${diagnosticReport.summary.totalTables} tables, ${diagnosticReport.summary.totalColumns} colonnes au total`);

    return json(diagnosticReport, 200, req);

  } catch (error) {
    console.error('[schema-discovery] ❌ Erreur générale:', error);
    return json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error)
    }, 500, req);
  }
});

function json(body: unknown, status = 200, request?: Request) {
  const headers = request ? corsHeaders(request) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
