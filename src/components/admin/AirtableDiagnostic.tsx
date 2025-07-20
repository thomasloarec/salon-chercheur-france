
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Search, CheckCircle, XCircle, AlertTriangle, TestTube } from 'lucide-react';
import { fetchAirtableSchemas } from '@/utils/airtableUtils';
import { supabase } from '@/integrations/supabase/client';

const AirtableDiagnostic = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScanSchemas = async () => {
    setIsScanning(true);
    setError(null);
    setScanResults(null);

    try {
      console.log('🔍 Lancement du scan des schémas Airtable...');
      
      const data = await fetchAirtableSchemas();
      
      console.log('✅ Scan terminé avec succès:', data);
      setScanResults(data);
    } catch (err) {
      console.error('❌ Erreur lors du scan:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const testFunctionAccess = async () => {
    setIsTesting(true);
    setTestResults(null);
    
    try {
      console.log('🧪 Testing direct function access...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session ? 'authenticated' : 'anonymous');
      
      // Test direct avec logs détaillés
      const { data, error } = await supabase.functions.invoke('airtable-schema-discovery', {
        headers: {
          'X-Lovable-Admin': 'true'
        }
      });
      
      setTestResults({
        success: !error,
        session: session ? 'authenticated' : 'anonymous',
        data: data || null,
        error: error || null
      });
      
      console.log('Function test response:', { data, error });
    } catch (error) {
      console.error('Function test error:', error);
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Diagnostic Airtable
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleScanSchemas}
              disabled={isScanning}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              {isScanning ? 'Scan en cours...' : 'Scanner les schémas Airtable'}
            </Button>
            
            <Button
              onClick={testFunctionAccess}
              disabled={isTesting}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <TestTube className="h-4 w-4" />
              {isTesting ? 'Test...' : 'Test Fonction'}
            </Button>
          </div>

          {testResults && (
            <div className={`p-4 border rounded-lg ${testResults.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {testResults.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <h4 className="text-sm font-medium">Test d'accès à la fonction</h4>
              </div>
              <div className="text-xs space-y-1">
                <p><strong>Session:</strong> {testResults.session}</p>
                <p><strong>Succès:</strong> {testResults.success ? 'Oui' : 'Non'}</p>
                {testResults.error && <p><strong>Erreur:</strong> {JSON.stringify(testResults.error)}</p>}
                {testResults.data && <p><strong>Données:</strong> {JSON.stringify(testResults.data, null, 2)}</p>}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <h4 className="text-sm font-medium text-red-800">Erreur de scan</h4>
              </div>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {scanResults && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <h4 className="text-sm font-medium text-green-800">Scan terminé</h4>
                </div>
                <p className="text-sm text-green-600">
                  {scanResults.summary?.totalTables} tables analysées avec {scanResults.summary?.totalColumns} colonnes au total
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Résultats détaillés :</h4>
                {scanResults.tablesAnalyzed?.map((tableName: string) => {
                  const tableData = scanResults.schemas[tableName];
                  return (
                    <div key={tableName} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium">{tableName}</span>
                        <span className="text-sm text-gray-500">
                          ({tableData?.columns?.length || 0} colonnes)
                        </span>
                      </div>
                      
                      {tableData?.metadata && (
                        <div className="flex gap-4 text-xs text-gray-600">
                          {tableData.metadata.hasFormulas && (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-yellow-500" />
                              Formules
                            </span>
                          )}
                          {tableData.metadata.hasLookups && (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-orange-500" />
                              Lookups
                            </span>
                          )}
                          {tableData.metadata.hasLinkedRecords && (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-purple-500" />
                              Liens
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AirtableDiagnostic;
