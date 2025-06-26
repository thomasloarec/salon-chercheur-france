
/**
 * Test script to verify location suggestions are working
 * 
 * Usage:
 *   SUPABASE_SERVICE_KEY=<your_service_role_key> \
 *   npx ts-node scripts/test-location-suggestions.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vxivdvzzhebobveedxbj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function testSuggestions() {
  const testQueries = [
    'ile de france',
    'île de france',
    'Île-de-France',
    'villepinte',
    'paris',
    'seine saint denis'
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Testing: "${query}"`);
    
    const { data, error } = await supabase
      .rpc('get_location_suggestions', { q: query });
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Results:', data);
    }
  }

  // Test commune count
  console.log('\n📊 Database statistics:');
  const { count } = await supabase
    .from('communes')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total communes: ${count}`);

  // Test specific postal codes
  const { data: villepinte } = await supabase
    .from('communes')
    .select('*')
    .eq('code_postal', '93420');
  
  console.log(`Communes with postal code 93420: ${villepinte?.length || 0}`);
}

testSuggestions().catch(console.error);
