import type { 
  AirtableExposantRecord, 
  ExposantImportResult, 
  AirtableConfig,
  AirtableResponse 
} from '../_shared/types.ts';

async function fetchAllExposants(airtableConfig: AirtableConfig): Promise<AirtableExposantRecord[]> {
  const allRecords: AirtableExposantRecord[] = [];
  let offset: string | undefined;
  
  do {
    const url = new URL(`https://api.airtable.com/v0/${airtableConfig.baseId}/All_Exposants`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }
    
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${airtableConfig.pat}` }
    });
    
    if (!response.ok) {
      throw new Error(`Fetch exposants failed: ${response.status}`);
    }
    
    const data: AirtableResponse<AirtableExposantRecord> = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;
    
    console.log(`[DEBUG] Fetched ${data.records.length} exposants, total: ${allRecords.length}`);
  } while (offset);
  
  return allRecords;
}

export async function importExposants(supabaseClient: any, airtableConfig: AirtableConfig): Promise<ExposantImportResult> {
  console.log('Importing exposants standalone...');
  
  const allExposants = await fetchAllExposants(airtableConfig);
  console.log('[DEBUG] exposants records:', allExposants.length);

  const exposantErrors: Array<{ record_id: string; reason: string }> = [];

  // Filtrer les imports tests
  const exposantsRaw = allExposants
    .filter((r: any) =>
      !/^TEST/.test(r.fields.nom_exposant || '') &&
      !/test-/.test((r.fields.website_exposant || '').toLowerCase())
    );

  const exposantsToUpsert = [];
  
  for (const r of exposantsRaw) {
    const f = r.fields;
    
    if (!f['id_exposant']?.trim()) {
      exposantErrors.push({
        record_id: r.id,
        reason: 'id_exposant manquant'
      });
      continue;
    }
    
    if (!f['nom_exposant']?.trim()) {
      exposantErrors.push({
        record_id: r.id,
        reason: 'nom_exposant manquant'
      });
      continue;
    }
    
    exposantsToUpsert.push({
      id_exposant: f['id_exposant'].trim(),
      nom_exposant: f['nom_exposant'].trim(),
      website_exposant: f['website_exposant']?.trim() || null,
      exposant_description: f['exposant_description']?.trim() || null
    });
  }

  console.log('[DEBUG] exposantsToUpsert.length =', exposantsToUpsert.length);
  let exposantsImported = 0;
  
  if (exposantsToUpsert.length) {
    try {
      const { data, error } = await supabaseClient
        .from('exposants')
        .upsert(exposantsToUpsert, { onConflict: 'id_exposant' })
        .select();
        
      if (error) {
        console.error('[ERROR] Supabase exposants upsert error:', error);
        exposantErrors.push({
          record_id: 'UPSERT_ERROR',
          reason: `Erreur upsert: ${error.message}`
        });
        return { exposantsImported: 0, exposantErrors };
      }
      
      console.log('[DEBUG] exposants upserted:', data.length);
      exposantsImported = data.length;
    } catch (error) {
      console.error('[ERROR] Exception during exposants import:', error);
      exposantErrors.push({
        record_id: 'EXCEPTION_ERROR',
        reason: `Exception: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  return { exposantsImported, exposantErrors };
}