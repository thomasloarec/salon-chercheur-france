
import { supabase } from '@/integrations/supabase/client';

describe('Airtable Smoke Tests', () => {
  let testResults: any = null;

  beforeAll(async () => {
    // Run the smoke tests via edge function
    const { data, error } = await supabase.functions.invoke('airtable-smoke-test');
    
    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Unknown error from smoke tests');
    }

    testResults = data.data;
  });

  test('should run all smoke tests successfully', () => {
    expect(testResults).toBeDefined();
    expect(testResults.total).toBeGreaterThan(0);
    expect(testResults.failed).toBe(0);
    expect(testResults.passed).toBe(testResults.total);
  });

  test('should prevent duplicate exposants with URL normalization', () => {
    const urlNormalizationTest = testResults.results.find(
      (r: any) => r.name === 'URL normalization test (www)'
    );
    
    expect(urlNormalizationTest).toBeDefined();
    expect(urlNormalizationTest.status).toBe('success');
  });

  test('should prevent duplicate participations', () => {
    const participationTest = testResults.results.find(
      (r: any) => r.name === 'Participation duplicate prevention'
    );
    
    expect(participationTest).toBeDefined();
    expect(participationTest.status).toBe('success');
  });

  test('should clean up test records', () => {
    const cleanupTest = testResults.results.find(
      (r: any) => r.name === 'Cleanup test records'
    );
    
    expect(cleanupTest).toBeDefined();
    expect(cleanupTest.status).toBe('success');
  });
});
