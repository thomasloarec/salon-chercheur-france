import type { 
  AirtableExposantRecord, 
  ExposantImportResult, 
  AirtableConfig,
  AirtableResponse 
} from '../_shared/types.ts';

// Configuration des batches pour éviter le CPU timeout
const SUPABASE_BATCH_SIZE = 500;

async function fetchAllExposants(airtableConfig: AirtableConfig): Promise<AirtableExposantRecord[]> {
  const allRecords: AirtableExposantRecord[] = [];
  let offset: string | undefined;
  let pageCount = 0;
  
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
    pageCount++;
    
    // Log moins fréquent
    if (pageCount % 10 === 0) {
      console.log(`[FETCH] ${allRecords.length} exposants chargés...`);
    }
  } while (offset);
  
  console.log(`[FETCH] Total: ${allRecords.length} exposants depuis Airtable`);
  return allRecords;
}

// Fonction utilitaire pour insérer par lots
async function batchUpsert(
  supabaseClient: any, 
  records: any[], 
  batchSize: number
): Promise<{ inserted: number; errors: string[] }> {
  let totalInserted = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(records.length / batchSize);
    
    try {
      const { data, error } = await supabaseClient
        .from('exposants')
        .upsert(batch, { onConflict: 'id_exposant' })
        .select();
      
      if (error) {
        console.error(`[BATCH ${batchNum}/${totalBatches}] Erreur:`, error.message);
        errors.push(`Batch ${batchNum}: ${error.message}`);
      } else {
        totalInserted += data?.length || 0;
        // Log seulement tous les 5 batches
        if (batchNum % 5 === 0 || batchNum === totalBatches) {
          console.log(`[BATCH ${batchNum}/${totalBatches}] ${totalInserted} exposants insérés`);
        }
      }
    } catch (e) {
      errors.push(`Batch ${batchNum}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  return { inserted: totalInserted, errors };
}

export async function importExposants(supabaseClient: any, airtableConfig: AirtableConfig): Promise<ExposantImportResult> {
  console.log('[EXPOSANTS] Début import...');
  
  // Fonction de normalisation de domaine
  function normalizeDomain(input?: string|null): string|null {
    if (!input) return null;
    let s = input.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
    s = s.split('/')[0].split('#')[0].split('?')[0];
    s = s.replace(/\.$/, '').replace(/:\d+$/, '');
    return s || null;
  }
  
  const allExposants = await fetchAllExposants(airtableConfig);
  const exposantErrors: Array<{ record_id: string; reason: string }> = [];

  // Filtrer uniquement les exposants de test Lovable (pas les vrais exposants comme TEST-OK)
  // On filtre seulement les entrées qui sont clairement des tests internes
  const exposantsRaw = allExposants.filter((r: any) => {
    const nom = (r.fields.nom_exposant || '').toLowerCase().trim();
    const website = (r.fields.website_exposant || '').toLowerCase().trim();
    
    // Exclure uniquement les tests internes évidents (ex: "Test special", "Zasp Test", entrées avec google.com comme site de test)
    const isInternalTest = 
      (nom === 'test' || nom === 'test special' || nom.endsWith(' test')) &&
      (website === 'google.com' || website === 'example.com' || !website);
    
    return !isInternalTest;
  });

  const exposantsToUpsert = [];
  
  for (const r of exposantsRaw) {
    const f = r.fields;
    
    if (!f['id_exposant']?.trim()) {
      exposantErrors.push({ record_id: r.id, reason: 'id_exposant manquant' });
      continue;
    }
    
    if (!f['nom_exposant']?.trim()) {
      exposantErrors.push({ record_id: r.id, reason: 'nom_exposant manquant' });
      continue;
    }
    
    const normalizedWebsite = normalizeDomain(f['website_exposant']);
    
    exposantsToUpsert.push({
      id_exposant: f['id_exposant'].trim(),
      nom_exposant: f['nom_exposant'].trim(),
      website_exposant: normalizedWebsite,
      exposant_description: f['exposant_description']?.trim() || null
    });
  }

  console.log(`[PREP] ${exposantsToUpsert.length} exposants à insérer (${exposantErrors.length} erreurs)`);
  
  let exposantsImported = 0;
  
  if (exposantsToUpsert.length > 0) {
    const { inserted, errors } = await batchUpsert(
      supabaseClient,
      exposantsToUpsert,
      SUPABASE_BATCH_SIZE
    );
    
    exposantsImported = inserted;
    errors.forEach(err => exposantErrors.push({ record_id: 'BATCH', reason: err }));
  }

  console.log(`[DONE] ${exposantsImported} exposants importés`);
  
  return { exposantsImported, exposantErrors };
}
