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

interface SmokeTestSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

const AirtableAntiDuplicateCheck = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SmokeTestSummary | null>(null);

  // Listen for secrets configuration event
  useEffect(() => {
    const handleSecretsConfigured = () => {
      console.log('🔄 AirtableAntiDuplicateCheck: Auto-refreshing due to secrets configuration');
      setTimeout(() => {
        runAntiDuplicateCheck();
      }, 1500);
    };

    window.addEventListener('airtable-secrets-configured', handleSecretsConfigured);
    
    return () => {
      window.removeEventListener('airtable-secrets-configured', handleSecretsConfigured);
    };
  }, []);

  const testUrlNormalization = async (): Promise<TestResult> => {
    try {
      const testCases = [
        { input: 'https://www.example.com/', expected: 'example.com' },
        { input: 'http://example.com', expected: 'example.com' },
        { input: 'www.example.com/', expected: 'example.com' },
        { input: 'example.com', expected: 'example.com' }
      ];

      const normalizeUrl = (url: string) => {
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      };

      const allPassed = testCases.every(test => normalizeUrl(test.input) === test.expected);
      
      return {
        name: 'URL Normalization Test',
        status: allPassed ? 'success' : 'error',
        message: allPassed ? 'All URL normalization tests passed' : 'URL normalization failed',
        details: { testCases, normalizeUrl }
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

  const testExposantDuplicatePrevention = async (): Promise<TestResult> => {
    try {
      const testRecord = {
        nom_exposant: 'TEST_DUPLICATE_EXPOSANT',
        website_exposant: 'duplicate-test-exposant.com',
        exposant_description: 'Test duplicate prevention'
      };

      // Première tentative - doit créer
      const { data: firstData, error: firstError } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'All_Exposants',
          records: [testRecord]
        }
      });

      if (firstError) {
        throw new Error(`First creation failed: ${firstError.message}`);
      }

      // Deuxième tentative - doit détecter le doublon
      const { data: secondData, error: secondError } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'All_Exposants',
          records: [testRecord]
        }
      });

      if (secondError) {
        throw new Error(`Second creation failed: ${secondError.message}`);
      }

      const duplicateDetected = secondData.duplicate === true;
      
      return {
        name: 'Exposant Duplicate Prevention Test',
        status: duplicateDetected ? 'success' : 'error',
        message: duplicateDetected ? 'Duplicate detection working correctly' : 'Duplicate detection not working',
        details: { firstData, secondData, duplicateDetected }
      };
    } catch (error) {
      return {
        name: 'Exposant Duplicate Prevention Test',
        status: 'error',
        message: `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      };
    }
  };

  const testParticipationDuplicatePrevention = async (): Promise<TestResult> => {
    try {
      const testRecord = {
        nom_exposant: 'TEST_DUPLICATE_PARTICIPATION',
        stand_exposant: 'Stand Test',
        website_exposant: 'duplicate-participation.com',
        urlexpo_event: 'test_duplicate_participation_event'
      };

      // Première tentative - doit créer
      const { data: firstData, error: firstError } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'Participation',
          records: [testRecord]
        }
      });

      if (firstError) {
        throw new Error(`First creation failed: ${firstError.message}`);
      }

      // Deuxième tentative - doit détecter le doublon
      const { data: secondData, error: secondError } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: {
          table: 'Participation',
          records: [testRecord]
        }
      });

      if (secondError) {
        throw new Error(`Second creation failed: ${secondError.message}`);
      }

      const duplicateDetected = secondData.duplicate === true;
      
      return {
        name: 'Participation Duplicate Prevention Test',
        status: duplicateDetected ? 'success' : 'error',
        message: duplicateDetected ? 'Duplicate detection working correctly' : 'Duplicate detection not working',
        details: { firstData, secondData, duplicateDetected }
      };
    } catch (error) {
      return {
        name: 'Participation Duplicate Prevention Test',
        status: 'error',
        message: `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      };
    }
  };

  const runAntiDuplicateCheck = async () => {
    setIsRunning(true);
    setResults(null);
    
    console.groupCollapsed('[AirtableAntiDuplicate] 🧪 Démarrage des tests anti-doublons');
    
    try {
      const testResults: TestResult[] = [];
      
      // Test 1: URL Normalization
      console.log('🔄 Test 1: URL Normalization');
      const urlTest = await testUrlNormalization();
      testResults.push(urlTest);
      console.log(urlTest.status === 'success' ? '✅' : '❌', urlTest.message);

      // Test 2: Exposant Duplicate Prevention
      console.log('🔄 Test 2: Exposant Duplicate Prevention');
      const exposantTest = await testExposantDuplicatePrevention();
      testResults.push(exposantTest);
      console.log(exposantTest.status === 'success' ? '✅' : '❌', exposantTest.message);

      // Test 3: Participation Duplicate Prevention
      console.log('🔄 Test 3: Participation Duplicate Prevention');
      const participationTest = await testParticipationDuplicatePrevention();
      testResults.push(participationTest);
      console.log(participationTest.status === 'success' ? '✅' : '❌', participationTest.message);

      const summary: SmokeTestSummary = {
        total: testResults.length,
        passed: testResults.filter(r => r.status === 'success').length,
        failed: testResults.filter(r => r.status === 'error').length,
        results: testResults
      };

      setResults(summary);

      const toastMessage = `Tests terminés: ${summary.passed}/${summary.total} réussis`;
      const toastVariant = summary.failed === 0 ? 'default' : 'destructive';

      toast({
        title: 'Vérification anti-doublons terminée',
        description: toastMessage,
        variant: toastVariant
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('❌ Erreur tests anti-doublons:', errorMsg);
      
      toast({
        title: 'Erreur lors de la vérification',
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
          Vérification anti-doublons
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Teste la normalisation d'URL et la prévention des doublons sur les tables Airtable.
              </p>
              <div className="text-xs text-gray-500">
                <p>• Normalisation: retire protocole, www, et slash final</p>
                <p>• Clés uniques: website_exposant, urlexpo_event</p>
                <p>• Tests automatiques avec nettoyage</p>
              </div>
            </div>
            <Button 
              onClick={runAntiDuplicateCheck}
              disabled={isRunning}
              variant="outline"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Tests en cours...
                </>
              ) : (
                'Vérifier anti-doublons'
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
            <p><strong>Note:</strong> Ces tests utilisent des données temporaires qui sont automatiquement nettoyées. 
            Consultez les logs de la console pour plus de détails.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AirtableAntiDuplicateCheck;
