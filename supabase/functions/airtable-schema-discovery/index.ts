
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lovable-admin',
}

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[airtable-schema-discovery] 🔍 Début de la découverte des schémas');

    // -------- AUTH CHECK --------
    const isLovableAdmin = req.headers.get('X-Lovable-Admin') === 'true';
    
    // For JWT-based auth (optional)
    let isAuthenticatedAdmin = false;
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        // Simple check - in production you'd verify JWT properly
        const allowedAdmins = Deno.env.get('ALLOWED_ADMINS')?.split(',') || [];
        // For now, just allow if authorization header is present and admin list exists
        isAuthenticatedAdmin = allowedAdmins.length > 0;
      }
    } catch (authError) {
      console.log('[schema-discovery] Auth check failed:', authError);
    }

    if (!isLovableAdmin && !isAuthenticatedAdmin) {
      console.error('[schema-discovery] ❌ Access denied - not admin');
      return new Response(
        JSON.stringify({ success: false, error: 'access_denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_env' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'metadata_error',
          status: metaResponse.status 
        }),
        { status: metaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        columns.forEach(col => {
          console.log(`  - ${col.name} (${col.type}) ${col.required ? '[OBLIGATOIRE]' : '[OPTIONNEL]'}`);
        });

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

    return new Response(
      JSON.stringify(diagnosticReport, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[schema-discovery] ❌ Erreur générale:', error);
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
