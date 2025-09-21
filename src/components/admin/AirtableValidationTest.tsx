import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertTriangle, Play, RefreshCw } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'success' | 'error';
  message: string;
  details?: any;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

const AirtableValidationTest = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestSummary | null>(null);

  // Listen for secrets configuration event
  useEffect(() => {
    const handleSecretsConfigured = () => {
      setTimeout(() => {
        runValidationTests();
      }, 1000);
    };

    window.addEventListener('airtable-secrets-configured', handleSecretsConfigured);
    
    return () => {
      window.removeEventListener('airtable-secrets-configured', handleSecretsConfigured);
    };
  }, []);

  const testUrlNormalization = async (): Promise<TestResult> => {
    try {
      const testUrls = [
        'https://www.example.com/',
        'http://example.com',
        'www.example.com',
        'example.com/'
      ];

      const normalizedUrls = testUrls.map(url => {
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      });

      const allNormalized = normalizedUrls.every(url => url === 'example.com');
      
      return {
        name: 'URL Normalization Test',
        status: allNormalized ? 'success' : 'error',
        message: allNormalized ? 'All URL normalization tests passed' : 'URL normalization failed',
        details: { testUrls, normalizedUrls }
      };
    } catch (error) {
      return {
        name: 'URL Normalization Test',
        status: 'error',
        message: `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      };
    }
  };

  const testExposantCreation = async (): Promise<TestResult> => {
    try {
      const testRecord = {
        nom_exposant: 'TEST_EXPOSANT_' + Date.now(),
        website_exposant: 'test-' + Date.now() + '.com',
        exposant_description: 'Test description'
      };

      const { data, error } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'All_Exposants',
          records: [testRecord]
        }
      });

      if (error) {
        throw new Error(`Supabase function error: ${error.message}`);
      }

      if (data.duplicate) {
        return {
          name: 'Exposant Duplicate Prevention Test',
          status: 'success',
          message: 'Duplicate detection working correctly',
          details: { duplicate: true }
        };
      }

      if (data.success) {
        return {
          name: 'Exposant Duplicate Prevention Test',
          status: 'success',
          message: 'Record created successfully',
          details: { created: true, records: data.records }
        };
      }

      throw new Error(data.message || 'Unknown error');
    } catch (error) {
      return {
        name: 'Exposant Duplicate Prevention Test',
        status: 'error',
        message: `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      };
    }
  };

  const testParticipationCreation = async (): Promise<TestResult> => {
    try {
      const testRecord = {
        nom_exposant: 'TEST_PARTICIPATION_' + Date.now(),
        stand_exposant: 'Stand A' + Date.now(),
        website_exposant: 'participation-' + Date.now() + '.com',
        urlexpo_event: 'test_participation_' + Date.now()
      };

      const { data, error } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'Participation',
          records: [testRecord]
        }
      });

      if (error) {
        throw new Error(`Supabase function error: ${error.message}`);
      }

      if (data.duplicate) {
        return {
          name: 'Participation Duplicate Prevention Test',
          status: 'success',
          message: 'Duplicate detection working correctly',
          details: { duplicate: true }
        };
      }

      if (data.success) {
        return {
          name: 'Participation Duplicate Prevention Test',
          status: 'success',
          message: 'Record created successfully',
          details: { created: true, records: data.records }
        };
      }

      throw new Error(data.message || 'Unknown error');
    } catch (error) {
      return {
        name: 'Participation Duplicate Prevention Test',
        status: 'error',
        message: `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      };
    }
  };

  const runValidationTests = async () => {
    setIsRunning(true);
    setResults(null);
    
    console.groupCollapsed('[AirtableValidation] 🧪 Démarrage des tests de validation');
    
    try {
      const testResults: TestResult[] = [];
      
      // Test 1: URL Normalization
      console.log('🔄 Test 1: URL Normalization');
      const urlTest = await testUrlNormalization();
      testResults.push(urlTest);
      console.log(urlTest.status === 'success' ? '✅' : '❌', urlTest.message);

      // Test 2: Exposant Creation
      console.log('🔄 Test 2: Exposant Creation');
      const exposantTest = await testExposantCreation();
      testResults.push(exposantTest);
      console.log(exposantTest.status === 'success' ? '✅' : '❌', exposantTest.message);

      // Test 3: Participation Creation
      console.log('🔄 Test 3: Participation Creation');
      const participationTest = await testParticipationCreation();
      testResults.push(participationTest);
      console.log(participationTest.status === 'success' ? '✅' : '❌', participationTest.message);

      const summary: TestSummary = {
        total: testResults.length,
        passed: testResults.filter(r => r.status === 'success').length,
        failed: testResults.filter(r => r.status === 'error').length,
        results: testResults
      };

      setResults(summary);

      const toastMessage = `Tests terminés: ${summary.passed}/${summary.total} réussis`;
      const toastVariant = summary.failed === 0 ? 'default' : 'destructive';

      toast({
        title: 'Tests de validation terminés',
        description: toastMessage,
        variant: toastVariant
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('❌ Erreur tests de validation:', errorMsg);
      
      toast({
        title: 'Erreur lors des tests',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      console.groupEnd();
      setIsRunning(false);
    }
  };

  const getResultIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getResultBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge variant="default" className="bg-green-100 text-green-800">Succès</Badge>;
      case 'error': return <Badge variant="destructive">Erreur</Badge>;
      default: return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Tests de validation Airtable
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Vérifie la connexion à Airtable et l'accès aux tables principales.
              </p>
              <div className="text-xs text-gray-500">
                <p>• Authentification Personal Access Token</p>
                <p>• Lecture des tables : All_Events, All_Exposants, Participation</p>
                <p>• Validation des formats de données</p>
              </div>
            </div>
            <Button 
              onClick={runValidationTests}
              disabled={isRunning}
              variant="outline"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Tests en cours...
                </>
              ) : (
                'Lancer la batterie de tests'
              )}
            </Button>
          </div>

          {results && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <span className="font-semibold">Résumé:</span> {results.passed}/{results.total} tests réussis
                </div>
                {results.failed === 0 ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Tous les tests passés
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {results.failed} test(s) échoué(s)
                  </Badge>
                )}
              </div>

              {/* Detailed Results */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Résultats détaillés:</h4>
                {results.results.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getResultIcon(result.status)}
                      <span className="font-medium text-sm">{index + 1}. {result.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getResultBadge(result.status)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Messages */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Messages:</h4>
                <div className="space-y-1 text-sm">
                  {results.results.map((result, index) => (
                    <div key={index} className={`p-2 rounded text-xs ${
                      result.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      <span className="font-medium">{result.name}:</span> {result.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
            <p><strong>Note:</strong> Ces tests vérifient l'authentification et l'accès aux données. 
            En cas d'échec, vérifiez vos secrets Airtable et les permissions de votre Personal Access Token.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AirtableValidationTest;
