
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Search, TestTube, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticStep {
  step: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  data?: any;
  timestamp: string;
}

const AirtableDiagnostic = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [schemas, setSchemas] = useState<any>(null);
  const [codeAnalysis, setCodeAnalysis] = useState<any>(null);
  const [mappings, setMappings] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticStep[]>([]);

  const { toast } = useToast();

  const handleScanSchemas = async () => {
    setIsScanning(true);
    try {
      console.log('🔍 Lancement du scan des schémas Airtable...');
      
      const { data, error } = await supabase.functions.invoke('airtable-schema-discovery');
      
      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du scan');
      }

      setSchemas(data);
      toast({
        title: 'Scan terminé avec succès',
        description: `${data.summary.totalTables} tables analysées, ${data.summary.totalColumns} colonnes découvertes`,
      });

      console.log('✅ Schémas Airtable récupérés:', data);

    } catch (error) {
      console.error('❌ Erreur lors du scan:', error);
      toast({
        title: 'Erreur lors du scan',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleAnalyzeCode = async () => {
    setIsAnalyzing(true);
    try {
      console.log('🔍 Analyse du code existant...');
      
      const { data, error } = await supabase.functions.invoke('airtable-code-analysis');
      
      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de l\'analyse');
      }

      setCodeAnalysis(data.analysis);
      toast({
        title: 'Analyse terminée',
        description: `${data.analysis.summary.totalFields} champs analysés dans le code`,
      });

      console.log('✅ Analyse du code terminée:', data);

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse:', error);
      toast({
        title: 'Erreur lors de l\'analyse',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateMappings = async () => {
    if (!schemas || !codeAnalysis) {
      toast({
        title: 'Données manquantes',
        description: 'Veuillez d\'abord scanner les schémas et analyser le code',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    try {
      console.log('🔍 Génération des mappings automatiques...');
      
      const { data, error } = await supabase.functions.invoke('airtable-mapping-generator', {
        body: {
          airtableSchemas: schemas.schemas,
          codeAnalysis: codeAnalysis
        }
      });
      
      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la génération');
      }

      setMappings(data);
      toast({
        title: 'Mappings générés',
        description: `${data.globalStatistics.totalMappedFields} champs mappés avec ${data.globalStatistics.averageGlobalConfidence.toFixed(1)}% de confiance moyenne`,
      });

      console.log('✅ Mappings générés:', data);

    } catch (error) {
      console.error('❌ Erreur lors de la génération:', error);
      toast({
        title: 'Erreur lors de la génération',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestWrite = async (tableName: string) => {
    if (!mappings || !codeAnalysis) {
      toast({
        title: 'Données manquantes',
        description: 'Veuillez d\'abord générer les mappings',
        variant: 'destructive'
      });
      return;
    }

    setIsTesting(true);
    try {
      console.log(`🧪 Test d'écriture pour ${tableName}...`);
      
      const testPayload = codeAnalysis.testPayloads[tableName]?.[0];
      const mapping = mappings.mappings[tableName]?.mapping;

      if (!testPayload || !mapping) {
        throw new Error(`Données de test ou mapping manquants pour ${tableName}`);
      }

      const { data, error } = await supabase.functions.invoke('airtable-write-diagnostic', {
        body: {
          tableName,
          testPayload,
          mapping
        }
      });
      
      if (error) {
        throw error;
      }

      setTestResults(prev => ({ ...prev, [tableName]: data }));
      setDiagnosticLogs(data.diagnosticSteps || []);

      const status = data.success ? 'success' : 'error';
      toast({
        title: `Test ${tableName}`,
        description: data.success ? 'Création réussie !' : `Échec: ${data.error?.message}`,
        variant: status === 'error' ? 'destructive' : 'default'
      });

      console.log(`${data.success ? '✅' : '❌'} Test ${tableName} terminé:`, data);

    } catch (error) {
      console.error('❌ Erreur lors du test:', error);
      toast({
        title: 'Erreur lors du test',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const downloadConfiguration = () => {
    if (!mappings) return;

    const config = {
      timestamp: new Date().toISOString(),
      mappings: mappings.mappings,
      statistics: mappings.globalStatistics
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airtable-mapping-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Diagnostic complet Airtable - Résolution des erreurs 422
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Button
              onClick={handleScanSchemas}
              disabled={isScanning}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isScanning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              1. Scanner Airtable
            </Button>

            <Button
              onClick={handleAnalyzeCode}
              disabled={isAnalyzing || !schemas}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              2. Analyser Code
            </Button>

            <Button
              onClick={handleGenerateMappings}
              disabled={isGenerating || !schemas || !codeAnalysis}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              3. Générer Mappings
            </Button>

            <Button
              onClick={downloadConfiguration}
              disabled={!mappings}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              4. Télécharger Config
            </Button>
          </div>

          {/* Résultats du scan */}
          {schemas && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-sm">Schémas Airtable découverts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(schemas.schemas).map(([tableName, schema]: [string, any]) => (
                    <div key={tableName} className="p-3 border rounded-lg">
                      <h4 className="font-medium mb-2">{tableName}</h4>
                      <p className="text-sm text-gray-600">{schema.columns.length} colonnes</p>
                      <p className="text-sm text-gray-600">{schema.totalRecords} enregistrements</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mappings générés */}
          {mappings && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-sm">Mappings générés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(mappings.mappings).map(([tableName, tableMapping]: [string, any]) => (
                    <div key={tableName} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">{tableName}</h4>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {tableMapping.statistics.averageConfidence.toFixed(1)}% confiance
                          </Badge>
                          <Button
                            onClick={() => handleTestWrite(tableName)}
                            disabled={isTesting}
                            size="sm"
                            variant="outline"
                          >
                            {isTesting ? (
                              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <TestTube className="h-3 w-3 mr-1" />
                            )}
                            Tester
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {Object.entries(tableMapping.mapping).map(([codeField, airtableField]: [string, any]) => (
                          <div key={codeField} className="flex justify-between py-1">
                            <span className="text-blue-600">{codeField}</span>
                            <span>→</span>
                            <span className="text-green-600">{airtableField}</span>
                          </div>
                        ))}
                      </div>

                      {tableMapping.orphanFields.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded">
                          <p className="text-xs text-yellow-800">
                            Champs orphelins: {tableMapping.orphanFields.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Logs de diagnostic */}
          {diagnosticLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Logs de diagnostic détaillés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {diagnosticLogs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 border-l-2 border-gray-200">
                      {getStatusIcon(log.status)}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm">{log.step}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{log.message}</p>
                        {log.data && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-gray-600">
                              Voir les détails
                            </summary>
                            <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AirtableDiagnostic;
