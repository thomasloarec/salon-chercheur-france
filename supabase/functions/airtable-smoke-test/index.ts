
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestResult {
  name: string;
  status: 'success' | 'error';
  message: string;
  details?: any;
}

// Helper function to call airtable-proxy
async function callAirtableProxy(action: string, table: string, payload?: any, uniqueField?: string) {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/airtable-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify({ action, table, payload, uniqueField })
  });

  if (!response.ok) {
    throw new Error(`Airtable proxy error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown error from Airtable proxy');
  }

  return data.data;
}

async function runSmokeTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const testTimestamp = Date.now();

  try {
    // Test 1: Create exposant with https://test-smoke.com/
    console.log('🧪 Test 1: Create exposant with https://test-smoke.com/');
    const exposant1 = {
      exposant_nom: `Test Smoke 1 - ${testTimestamp}`,
      website_exposant: 'https://test-smoke.com/',
      exposant_description: 'Premier exposant de test'
    };

    const result1 = await callAirtableProxy('UPSERT', 'All_Exposants', [exposant1], 'website_exposant');
    results.push({
      name: 'Create exposant https://test-smoke.com/',
      status: 'success',
      message: `Created: ${result1.created.length}, Updated: ${result1.updated.length}`,
      details: result1
    });

    // Test 2: Try to create exposant with https://www.test-smoke.com (should update, not create)
    console.log('🧪 Test 2: Try to create exposant with https://www.test-smoke.com');
    const exposant2 = {
      exposant_nom: `Test Smoke 2 - ${testTimestamp}`,
      website_exposant: 'https://www.test-smoke.com',
      exposant_description: 'Deuxième exposant avec même URL'
    };

    const result2 = await callAirtableProxy('UPSERT', 'All_Exposants', [exposant2], 'website_exposant');
    
    if (result2.created.length === 0 && result2.updated.length === 1) {
      results.push({
        name: 'URL normalization test (www)',
        status: 'success',
        message: 'Correctly updated existing record instead of creating duplicate',
        details: result2
      });
    } else {
      results.push({
        name: 'URL normalization test (www)',
        status: 'error',
        message: `Expected 0 created, 1 updated. Got ${result2.created.length} created, ${result2.updated.length} updated`,
        details: result2
      });
    }

    // Test 3: Create participation with unique urlexpo_event
    console.log('🧪 Test 3: Create participation with unique urlexpo_event');
    const participation1 = {
      id_event: `Event_SMOKE_${testTimestamp}`,
      id_exposant: `exposant_smoke_${testTimestamp}`,
      urlexpo_event: `test-smoke.com_A${testTimestamp}`
    };

    const result3 = await callAirtableProxy('UPSERT', 'Participation', [participation1], 'urlexpo_event');
    results.push({
      name: 'Create participation',
      status: 'success',
      message: `Created: ${result3.created.length}, Updated: ${result3.updated.length}`,
      details: result3
    });

    // Test 4: Try to create another participation with same urlexpo_event
    console.log('🧪 Test 4: Try to create participation with same urlexpo_event');
    const participation2 = {
      id_event: `Event_SMOKE_2_${testTimestamp}`,
      id_exposant: `exposant_smoke_2_${testTimestamp}`,
      urlexpo_event: `test-smoke.com_A${testTimestamp}` // Same as before
    };

    const result4 = await callAirtableProxy('UPSERT', 'Participation', [participation2], 'urlexpo_event');
    
    if (result4.created.length === 0 && result4.updated.length === 1) {
      results.push({
        name: 'Participation duplicate prevention',
        status: 'success',
        message: 'Correctly updated existing participation instead of creating duplicate',
        details: result4
      });
    } else {
      results.push({
        name: 'Participation duplicate prevention',
        status: 'error',
        message: `Expected 0 created, 1 updated. Got ${result4.created.length} created, ${result4.updated.length} updated`,
        details: result4
      });
    }

    // Cleanup: Delete test records
    console.log('🧪 Cleanup: Deleting test records');
    
    // Find and delete test exposant
    const testExposant = await callAirtableProxy('FIND', 'All_Exposants', { 
      fieldName: 'website_exposant', 
      value: 'https://test-smoke.com/' 
    });
    
    if (testExposant && testExposant.id) {
      await callAirtableProxy('DELETE', 'All_Exposants', [testExposant.id]);
    }

    // Find and delete test participation
    const testParticipation = await callAirtableProxy('FIND', 'Participation', { 
      fieldName: 'urlexpo_event', 
      value: `test-smoke.com_A${testTimestamp}` 
    });
    
    if (testParticipation && testParticipation.id) {
      await callAirtableProxy('DELETE', 'Participation', [testParticipation.id]);
    }

    results.push({
      name: 'Cleanup test records',
      status: 'success',
      message: 'Test records cleaned up successfully'
    });

  } catch (error) {
    console.error('Smoke test error:', error);
    results.push({
      name: 'Smoke test execution',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
  }

  return results;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for required environment variables
    const REQUIRED_VARS = [
      'AIRTABLE_PAT',
      'AIRTABLE_BASE_ID', 
      'EVENTS_TABLE_NAME',
      'EXHIBITORS_TABLE_NAME',
      'PARTICIPATION_TABLE_NAME'
    ];
    
    const missing = REQUIRED_VARS.filter(key => !Deno.env.get(key));
    
    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'missing_env', 
          missing,
          message: `Missing required environment variables: ${missing.join(', ')}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🚀 Starting Airtable smoke tests');
    
    const results = await runSmokeTests();
    
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    };

    console.log('📊 Smoke test summary:', summary);

    return new Response(
      JSON.stringify({ success: true, data: summary }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Smoke test runner error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
