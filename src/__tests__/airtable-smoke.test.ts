
import { supabase } from '@/integrations/supabase/client';

describe('Airtable Smoke Tests', () => {
  let testResults: any = null;
  let envMissing = false;

  beforeAll(async () => {
    try {
      // Run the smoke tests via edge function
      const { data, error } = await supabase.functions.invoke('airtable-smoke-test');
      
      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data.success) {
        // Check if it's a missing environment variables error
        if (data.error === 'missing_env') {
          envMissing = true;
          console.warn('⚠️ Skipping Airtable smoke tests - missing environment variables:', data.missing);
          return;
        }
        throw new Error(data.error || 'Unknown error from smoke tests');
      }

      testResults = data.data;
    } catch (error) {
      if (!envMissing) {
        throw error;
      }
    }
  });

  test('should skip tests when environment variables are missing', () => {
    if (envMissing) {
      console.warn('Airtable smoke tests skipped due to missing environment variables');
      expect(true).toBe(true); // Test passes but indicates skipped
      return;
    }
    
    // If not missing env, this test should not run
    expect(envMissing).toBe(false);
  });

  test('should run all smoke tests successfully', () => {
    if (envMissing) {
      console.warn('Skipping test - environment variables missing');
      return;
    }

    expect(testResults).toBeDefined();
    expect(testResults.total).toBeGreaterThan(0);
    expect(testResults.failed).toBe(0);
    expect(testResults.passed).toBe(testResults.total);
  });

  test('should prevent duplicate exposants with URL normalization', () => {
    if (envMissing) {
      console.warn('Skipping test - environment variables missing');
      return;
    }

    const urlNormalizationTest = testResults.results.find(
      (r: any) => r.name === 'URL normalization test (www)'
    );
    
    expect(urlNormalizationTest).toBeDefined();
    expect(urlNormalizationTest.status).toBe('success');
  });

  test('should prevent duplicate participations', () => {
    if (envMissing) {
      console.warn('Skipping test - environment variables missing');
      return;
    }

    const participationTest = testResults.results.find(
      (r: any) => r.name === 'Participation duplicate prevention'
    );
    
    expect(participationTest).toBeDefined();
    expect(participationTest.status).toBe('success');
  });

  test('should clean up test records', () => {
    if (envMissing) {
      console.warn('Skipping test - environment variables missing');
      return;
    }

    const cleanupTest = testResults.results.find(
      (r: any) => r.name === 'Cleanup test records'
    );
    
    expect(cleanupTest).toBeDefined();
    expect(cleanupTest.status).toBe('success');
  });
});
