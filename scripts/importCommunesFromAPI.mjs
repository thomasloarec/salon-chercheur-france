/**
 * Import all French communes from geo.api.gouv.fr into Supabase
 * 
 * Usage:
 *   SUPABASE_URL=https://vxivdvzzhebobveedxbj.supabase.co \
 *   SUPABASE_SERVICE_KEY=<your_service_role_key> \
 *   node scripts/importCommunesFromAPI.js
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vxivdvzzhebobveedxbj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY environment variable');
  console.log('Please set your service role key:');
  console.log('SUPABASE_SERVICE_KEY=<your_service_role_key> node scripts/importCommunesFromAPI.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function fetchCommunesFromAPI() {
  console.log('🌍 Fetching communes from geo.api.gouv.fr...');
  
  const url = 'https://geo.api.gouv.fr/communes?fields=code,nom,codesPostaux,codeDepartement,codeRegion&format=json&limit=100000';
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Fetched ${data.length} communes from API`);
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch communes:', error);
    throw error;
  }
}

function transformData(apiData) {
  console.log('🔄 Transforming data (1 row per postal code)...');
  
  const rows = [];
  
  for (const commune of apiData) {
    // Create one row per postal code
    for (const codePostal of commune.codesPostaux) {
      rows.push({
        nom: commune.nom,
        code_postal: codePostal.padStart(5, '0'), // Ensure 5 digits
        dep_code: commune.codeDepartement,
        region_code: commune.codeRegion
      });
    }
  }
  
  console.log(`✅ Generated ${rows.length} rows (commune + postal code combinations)`);
  return rows;
}

async function insertInBatches(rows) {
  console.log('💾 Starting batch insert...');
  
  // Clear existing data first
  console.log('🗑️  Clearing existing communes...');
  const { error: deleteError } = await supabase
    .from('communes')
    .delete()
    .neq('nom', null);
  
  if (deleteError) {
    console.error('❌ Failed to clear existing data:', deleteError);
    throw deleteError;
  }
  
  const batchSize = 1000;
  let inserted = 0;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('communes')
      .insert(batch, {
        onConflict: 'nom,code_postal',
        ignoreDuplicates: true     // évite les erreurs de doublon
      });
    
    if (error) {
      console.error(`❌ Batch error at row ${i}:`, error);
      throw error;
    }
    
    inserted += batch.length;
    console.log(`📊 Inserted ${inserted}/${rows.length} rows (${Math.round(inserted/rows.length*100)}%)`);
  }
  
  console.log('✅ All batches inserted successfully!');
}

async function verifyImport() {
  console.log('🔍 Verifying import...');
  
  // Count total communes
  const { count, error: countError } = await supabase
    .from('communes')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Failed to count communes:', countError);
    return;
  }
  
  console.log(`📊 Total communes in database: ${count}`);
  
  // Check for Villepinte (93420)
  const { data: villepinte, error: villepinteError } = await supabase
    .from('communes')
    .select('nom, code_postal, dep_code, region_code')
    .eq('code_postal', '93420');
  
  if (villepinteError) {
    console.error('❌ Failed to check Villepinte:', villepinteError);
    return;
  }
  
  if (villepinte && villepinte.length > 0) {
    console.log('✅ Villepinte (93420) found:', villepinte);
  } else {
    console.log('⚠️  Villepinte (93420) not found');
  }
  
  // Test location suggestions
  const { data: suggestions, error: suggestionsError } = await supabase
    .rpc('get_location_suggestions', { q: 'ile de france' });
  
  if (suggestionsError) {
    console.error('❌ Failed to test suggestions:', suggestionsError);
    return;
  }
  
  console.log('✅ Location suggestions for "ile de france":', suggestions);
}

async function main() {
  try {
    const startTime = Date.now();
    
    // Step 1: Fetch from API
    const apiData = await fetchCommunesFromAPI();
    
    // Step 2: Transform data
    const rows = transformData(apiData);
    
    // Step 3: Insert in batches
    await insertInBatches(rows);
    
    // Step 4: Verify
    await verifyImport();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`🎉 Import completed successfully in ${duration}s`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
