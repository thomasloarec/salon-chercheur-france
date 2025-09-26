import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getEnvOrConfig, listMissing, debugVariables } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[airtable-smoke-test] 🔍 Début des tests');
    
    // Check for required environment variables avec fonction stricte
    const missingSecrets = listMissing();

    if (missingSecrets.length > 0) {
      console.error(`[airtable-smoke-test] ❌ Variables Supabase manquantes:`, missingSecrets);
      console.log('[airtable-smoke-test] 📊 Debug variables:', debugVariables());
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'missing_env', 
          missing: missingSecrets,
          message: `Variables Supabase manquantes: ${missingSecrets.join(', ')}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get values using unified function
    const AIRTABLE_PAT = getEnvOrConfig('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = getEnvOrConfig('AIRTABLE_BASE_ID');
    const EVENTS_TABLE_NAME = getEnvOrConfig('EVENTS_TABLE_NAME');
    const EXHIBITORS_TABLE_NAME = getEnvOrConfig('EXHIBITORS_TABLE_NAME');
    const PARTICIPATION_TABLE_NAME = getEnvOrConfig('PARTICIPATION_TABLE_NAME');

    console.log('[airtable-smoke-test] ✅ Variables OK, Base ID:', AIRTABLE_BASE_ID.substring(0, 10) + '...');

    // --------------------------------------------------------------------
    // 1. Helpers & Utils
    // --------------------------------------------------------------------

    const normalizeUrl = (url: string): string => {
      if (!url) return '';
      let normalized = url.trim();

      // Remove protocol (http/https)
      normalized = normalized.replace(/^https?:\/\//i, '');

      // Remove "www."
      normalized = normalized.replace(/^www\./i, '');

      // Remove trailing slash
      normalized = normalized.replace(/\/$/, '');

      return normalized.toLowerCase();
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // --------------------------------------------------------------------
    // 2. Airtable Interaction
    // --------------------------------------------------------------------

    const fetchAirtable = async (table: string, params: URLSearchParams) => {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}?${params.toString()}`;
      const headers = {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error(`Airtable API Error for table ${table}:`, response.status, response.statusText);
        try {
          const errorBody = await response.json();
          console.error('Error Details:', JSON.stringify(errorBody, null, 2));
        } catch (parseError) {
          console.error('Failed to parse error body:', parseError);
        }
        throw new Error(`Airtable API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    };

    const createRecord = async (table: string, fields: any) => {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;
      const headers = {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        console.error(`Error creating record in ${table}:`, response.status, response.statusText);
        try {
          const errorBody = await response.json();
          console.error('Error Details:', JSON.stringify(errorBody, null, 2));
        } catch (parseError) {
          console.error('Failed to parse error body:', parseError);
        }
        throw new Error(`Failed to create record: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    };

    const updateRecord = async (table: string, recordId: string, fields: any) => {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}/${recordId}`;
      const headers = {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        console.error(`Error updating record ${recordId} in ${table}:`, response.status, response.statusText);
        try {
          const errorBody = await response.json();
          console.error('Error Details:', JSON.stringify(errorBody, null, 2));
        } catch (parseError) {
          console.error('Failed to parse error body:', parseError);
        }
        throw new Error(`Failed to update record: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    };

    const deleteRecord = async (table: string, recordId: string) => {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}/${recordId}`;
      const headers = {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        console.error(`Error deleting record ${recordId} from ${table}:`, response.status, response.statusText);
        try {
          const errorBody = await response.json();
          console.error('Error Details:', JSON.stringify(errorBody, null, 2));
        } catch (parseError) {
          console.error('Failed to parse error body:', parseError);
        }
        throw new Error(`Failed to delete record: ${response.status} ${response.statusText}`);
      }

      return { deleted: true, id: recordId };
    };

    const findRecordByField = async (table: string, fieldName: string, fieldValue: string) => {
      const params = new URLSearchParams({
        filterByFormula: `{${fieldName}}="${fieldValue}"`,
      });

      const data = await fetchAirtable(table, params);

      if (data.records && data.records.length > 0) {
        return data.records[0];
      }

      return null;
    };

    // --------------------------------------------------------------------
    // 3. Test Functions
    // --------------------------------------------------------------------

    const testUrlNormalization = async (): Promise<TestResult> => {
      const testCases = [
        { input: 'https://example.com', expected: 'example.com' },
        { input: 'http://www.example.com', expected: 'example.com' },
        { input: 'example.com/', expected: 'example.com' },
        { input: '  https://www.example.com/  ', expected: 'example.com' },
      ];

      for (const testCase of testCases) {
        const normalized = normalizeUrl(testCase.input);
        if (normalized !== testCase.expected) {
          return {
            name: 'URL Normalization Test',
            status: 'error',
            message: `Normalization failed for ${testCase.input}. Expected ${testCase.expected}, got ${normalized}`,
            details: { input: testCase.input, expected: testCase.expected, actual: normalized },
          };
        }
      }

      return {
        name: 'URL Normalization Test',
        status: 'success',
        message: 'All URL normalization tests passed',
      };
    };

    const testExposantDuplicatePrevention = async (): Promise<TestResult> => {
      const testWebsite = `test${Date.now()}.com`;
      const testExposant1 = { exposant_nom: 'Test Exposant 1', website_exposant: `https://${testWebsite}` };
      const testExposant2 = { exposant_nom: 'Test Exposant 2', website_exposant: `http://www.${testWebsite}/` };

      try {
        // Clean up any existing records with the test website
        const existingRecord = await findRecordByField(EXHIBITORS_TABLE_NAME, 'website_exposant', normalizeUrl(testWebsite));
        if (existingRecord) {
          await deleteRecord(EXHIBITORS_TABLE_NAME, existingRecord.id);
          await sleep(1000); // Wait for deletion to propagate
        }

        // Create the first record
        await createRecord(EXHIBITORS_TABLE_NAME, testExposant1);
        await sleep(1000); // Wait for creation to propagate

        // Attempt to create the second record (should update the first)
        await createRecord(EXHIBITORS_TABLE_NAME, testExposant2);
        await sleep(1000); // Wait for creation to propagate

        // Verify that only one record exists with the normalized URL
        const records = await fetchAirtable(EXHIBITORS_TABLE_NAME, new URLSearchParams({
          filterByFormula: `{website_exposant}="${normalizeUrl(testWebsite)}"`
        }));

        if (records.records.length !== 1) {
          return {
            name: 'Exposant Duplicate Prevention Test',
            status: 'error',
            message: `Expected 1 record, found ${records.records.length}`,
            details: { records: records.records },
          };
        }

        return {
          name: 'Exposant Duplicate Prevention Test',
          status: 'success',
          message: 'Duplicate exposants were successfully prevented',
        };
      } catch (error) {
        return {
          name: 'Exposant Duplicate Prevention Test',
          status: 'error',
          message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`,
          details: { error: error instanceof Error ? error.message : String(error) },
        };
      } finally {
        // Clean up the test record
        const testRecord = await findRecordByField(EXHIBITORS_TABLE_NAME, 'website_exposant', normalizeUrl(testWebsite));
        if (testRecord) {
          await deleteRecord(EXHIBITORS_TABLE_NAME, testRecord.id);
        }
      }
    };

    const testParticipationDuplicatePrevention = async (): Promise<TestResult> => {
      const testEventId = `event${Date.now()}`;
      const testExposantId = `exposant${Date.now()}`;
      const testUrlexpoEvent = `${testExposantId}_${testEventId}`;

      const testParticipation1 = { id_event: testEventId, id_exposant: testExposantId, urlexpo_event: testUrlexpoEvent };
      const testParticipation2 = { id_event: testEventId, id_exposant: testExposantId, urlexpo_event: testUrlexpoEvent };

      try {
        // Clean up any existing records
        const existingRecord = await findRecordByField(PARTICIPATION_TABLE_NAME, 'urlexpo_event', testUrlexpoEvent);
        if (existingRecord) {
          await deleteRecord(PARTICIPATION_TABLE_NAME, existingRecord.id);
          await sleep(1000); // Wait for deletion to propagate
        }

        // Create the first record
        await createRecord(PARTICIPATION_TABLE_NAME, testParticipation1);
        await sleep(1000); // Wait for creation to propagate

        // Attempt to create the second record (should update the first)
        await createRecord(PARTICIPATION_TABLE_NAME, testParticipation2);
        await sleep(1000); // Wait for creation to propagate

        // Verify that only one record exists
        const records = await fetchAirtable(PARTICIPATION_TABLE_NAME, new URLSearchParams({
          filterByFormula: `{urlexpo_event}="${testUrlexpoEvent}"`
        }));

        if (records.records.length !== 1) {
          return {
            name: 'Participation Duplicate Prevention Test',
            status: 'error',
            message: `Expected 1 record, found ${records.records.length}`,
            details: { records: records.records },
          };
        }

        return {
          name: 'Participation Duplicate Prevention Test',
          status: 'success',
          message: 'Duplicate participations were successfully prevented',
        };
      } catch (error) {
        return {
          name: 'Participation Duplicate Prevention Test',
          status: 'error',
          message: `Test failed with error: ${error.message}`,
          details: { error: error.message },
        };
      } finally {
        // Clean up the test record
        const testRecord = await findRecordByField(PARTICIPATION_TABLE_NAME, 'urlexpo_event', testUrlexpoEvent);
        if (testRecord) {
          await deleteRecord(PARTICIPATION_TABLE_NAME, testRecord.id);
        }
      }
    };

    // --------------------------------------------------------------------
    // 4. Orchestration & Response
    // --------------------------------------------------------------------

    interface TestResult {
      name: string;
      status: 'success' | 'error';
      message: string;
      details?: any;
    }

    interface SmokeTestSummary {
      total: number;
      passed: number;
      failed: number;
      results: TestResult[];
    }

    const runAllTests = async (): Promise<SmokeTestSummary> => {
      const testFunctions = [
        testUrlNormalization,
        testExposantDuplicatePrevention,
        testParticipationDuplicatePrevention,
      ];

      const results: TestResult[] = [];
      let passed = 0;
      let failed = 0;

      for (const testFunction of testFunctions) {
        try {
          const result = await testFunction();
          results.push(result);

          if (result.status === 'success') {
            passed++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Test ${testFunction.name} crashed:`, error);
          failed++;
          results.push({
            name: testFunction.name,
            status: 'error',
            message: `Test crashed: ${error.message}`,
            details: { error: error.message },
          });
        }
      }

      const total = testFunctions.length;

      return {
        total,
        passed,
        failed,
        results,
      };
    };

    const summary = await runAllTests();

    return new Response(
      JSON.stringify({
        success: true,
        data: summary,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[airtable-smoke-test] ❌ Erreur générale:', error);
    
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
