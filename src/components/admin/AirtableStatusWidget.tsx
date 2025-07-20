
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, AlertCircle, Bug, ExternalLink, Search } from 'lucide-react';
import { useAirtableStatus } from '@/hooks/useAirtableStatus';
import { supabase } from '@/integrations/supabase/client';

interface AirtableStatusWidgetProps {
  onSecretsConfigured?: () => void;
  autoRefresh?: boolean;
}

const AirtableStatusWidget: React.FC<AirtableStatusWidgetProps> = ({
  onSecretsConfigured,
  autoRefresh = false
}) => {
  const { status, isLoading, checkStatus } = useAirtableStatus();
  const prevSecretsOk = useRef<boolean | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  useEffect(() => {
    if (autoRefresh) {
      checkStatus();
    }
  }, [autoRefresh, checkStatus]);

  // Auto-trigger callbacks when secrets become OK
  useEffect(() => {
    if (status && prevSecretsOk.current === false && status.secretsOk === true) {
      console.log('🎉 Secrets are now configured! Auto-triggering tests...');
      if (onSecretsConfigured) {
        onSecretsConfigured();
      }
    }
    prevSecretsOk.current = status?.secretsOk ?? null;
  }, [status?.secretsOk, onSecretsConfigured]);

  const handleRefresh = async () => {
    await checkStatus();
  };

  const handleInspectAirtable = async () => {
    setIsInspecting(true);
    try {
      console.log('🔍 Inspection Airtable en cours...');
      
      const { data, error } = await supabase.functions.invoke('airtable-debug');
      
      if (error) {
        console.error('❌ Erreur inspection Airtable:', error);
        return;
      }

      console.log('📊 Résultat inspection Airtable:', data);
      
      if (data.success && data.debug) {
        const debug = data.debug;
        
        console.group('🏢 BASES AIRTABLE ACCESSIBLES');
        if (debug.bases && debug.bases.length > 0) {
          debug.bases.forEach((base: any) => {
            const isCurrent = base.id === debug.baseId;
            console.log(`${isCurrent ? '👉' : '  '} ${base.name} (${base.id}) - ${base.permissionLevel}`);
          });
        } else {
          console.log('❌ Aucune base accessible ou erreur');
        }
        console.groupEnd();

        console.group(`📋 TABLES DANS LA BASE ${debug.baseId}`);
        if (debug.tables && debug.tables.length > 0) {
          debug.tables.forEach((table: any) => {
            console.log(`  📄 ${table.name} (${table.id})`);
          });
          
          if (debug.tablesCheck) {
            console.log('\n🔍 VÉRIFICATION DES TABLES REQUISES:');
            debug.tablesCheck.required.forEach((tableName: string) => {
              const found = debug.tablesCheck.found.includes(tableName);
              console.log(`  ${found ? '✅' : '❌'} ${tableName}`);
            });
            
            if (debug.tablesCheck.missing.length > 0) {
              console.log(`\n❌ Tables manquantes: ${debug.tablesCheck.missing.join(', ')}`);
            }
          }
        } else {
          console.log('❌ Aucune table trouvée ou base inaccessible');
        }
        console.groupEnd();

        if (debug.errors.length > 0) {
          console.group('⚠️ ERREURS DÉTECTÉES');
          debug.errors.forEach((error: string) => {
            console.error(`  • ${error}`);
          });
          console.groupEnd();
        }

        // Diagnostic automatique
        console.group('🔧 DIAGNOSTIC');
        if (!debug.bases || debug.bases.length === 0) {
          console.log('❌ Problème: PAT invalide ou pas de bases accessibles');
        } else if (!debug.bases.find((b: any) => b.id === debug.baseId)) {
          console.log(`❌ Problème: Base ID "${debug.baseId}" introuvable dans vos bases accessibles`);
        } else if (debug.tablesCheck && debug.tablesCheck.missing.length > 0) {
          console.log(`❌ Problème: Tables manquantes dans votre base: ${debug.tablesCheck.missing.join(', ')}`);
        } else {
          console.log('✅ Configuration semble correcte - vérifiez les logs détaillés ci-dessus');
        }
        console.groupEnd();
      }
      
    } catch (error) {
      console.error('❌ Exception lors de l\'inspection:', error);
    } finally {
      setIsInspecting(false);
    }
  };

  const getStatusIcon = (isOk: boolean, isLoading: boolean = false) => {
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    return isOk ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (isOk: boolean, label: string) => {
    return (
      <Badge variant={isOk ? "default" : "destructive"} className={isOk ? "bg-green-100 text-green-800" : ""}>
        {isOk ? '✅' : '❌'} {label}
      </Badge>
    );
  };

  const getErrorMessage = () => {
    if (!status?.testsError) return null;

    const { error, status: httpStatus, message, context } = status.testsError;

    switch (error) {
      case 'missing_env':
        return {
          title: 'Variables manquantes',
          message: `Variables Supabase manquantes: ${status.missing?.join(', ')}`,
          type: 'config' as const
        };
      case 'airtable_error':
        if (httpStatus === 404) {
          return {
            title: 'Airtable 404 - Base ou table introuvable',
            message: 'Vérifiez AIRTABLE_BASE_ID et que les tables All_Events, All_Exposants, Participation existent dans cette base',
            type: 'airtable' as const
          };
        } else if (httpStatus === 401) {
          return {
            title: 'Airtable 401 - Authentification échouée',
            message: 'Vérifiez votre AIRTABLE_PAT (Personal Access Token)',
            type: 'auth' as const
          };
        }
        return {
          title: `Airtable ${httpStatus}`,
          message: message || 'Erreur Airtable',
          type: 'airtable' as const
        };
      default:
        return {
          title: 'Erreur technique',
          message: message || error,
          type: 'technical' as const
        };
    }
  };

  const errorInfo = getErrorMessage();
  const isAirtable404Error = status?.testsError?.error === 'airtable_error' && status?.testsError?.status === 404;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Vérification finale
          </div>
          <div className="flex items-center gap-2">
            {isAirtable404Error && (
              <Button
                onClick={handleInspectAirtable}
                disabled={isInspecting}
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                {isInspecting ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Inspecter Airtable
              </Button>
            )}
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Actualiser
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!status && !isLoading && (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-2">Cliquez sur "Actualiser" pour vérifier l'état</p>
            </div>
          )}

          {status && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Secrets Status */}
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                {getStatusIcon(status.secretsOk, isLoading)}
                <div className="flex-1">
                  <div className="font-medium">Configuration secrets</div>
                  {status.missing && status.missing.length > 0 && (
                    <div className="text-sm text-red-600">
                      Variables manquantes: {status.missing.join(', ')}
                    </div>
                  )}
                </div>
                {getStatusBadge(status.secretsOk, status.secretsOk ? 'OK' : 'KO')}
              </div>

              {/* Tests Status */}
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                {getStatusIcon(status.testsOk, isLoading)}
                <div className="flex-1">
                  <div className="font-medium">Tests de validation</div>
                  {status.testsFailStep && (
                    <div className="text-sm text-red-600">
                      Échec: {status.testsFailStep}
                    </div>
                  )}
                </div>
                {getStatusBadge(status.testsOk, status.testsOk ? 'OK' : 'KO')}
              </div>

              {/* Dedup Status */}
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                {getStatusIcon(status.dedupOk, isLoading)}
                <div className="flex-1">
                  <div className="font-medium">Anti-doublons</div>
                </div>
                {getStatusBadge(status.dedupOk, status.dedupOk ? 'OK' : 'KO')}
              </div>

              {/* Buttons Status */}
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                {getStatusIcon(status.buttonsActive, isLoading)}
                <div className="flex-1">
                  <div className="font-medium">Boutons synchronisation</div>
                </div>
                {getStatusBadge(status.buttonsActive, status.buttonsActive ? 'Actifs' : 'Désactivés')}
              </div>
            </div>
          )}

          {/* Error Details */}
          {errorInfo && (
            <div className={`p-4 rounded-lg border-l-4 ${
              errorInfo.type === 'config' ? 'bg-orange-50 border-orange-400' :
              errorInfo.type === 'airtable' ? 'bg-red-50 border-red-400' :
              errorInfo.type === 'auth' ? 'bg-yellow-50 border-yellow-400' :
              'bg-gray-50 border-gray-400'
            }`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  errorInfo.type === 'config' ? 'text-orange-600' :
                  errorInfo.type === 'airtable' ? 'text-red-600' :
                  errorInfo.type === 'auth' ? 'text-yellow-600' :
                  'text-gray-600'
                }`} />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{errorInfo.title}</h4>
                  <p className="text-sm">{errorInfo.message}</p>
                  
                  {errorInfo.type === 'airtable' && status?.testsError?.status === 404 && (
                    <div className="mt-3 space-y-2 text-xs">
                      <p className="font-medium">Étapes de diagnostic :</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Cliquez sur le bouton "Inspecter Airtable" ci-dessus</li>
                        <li>Ouvrez la console de votre navigateur (F12)</li>
                        <li>Vérifiez que votre base Airtable ID est correct</li>
                        <li>
                          Connectez-vous à{' '}
                          <a 
                            href="https://airtable.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Airtable <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                        <li>Vérifiez que les tables existent : All_Events, All_Exposants, Participation</li>
                        <li>Vérifiez les permissions de votre Personal Access Token</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Global Status */}
          {status && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">État global:</span>
                <Badge 
                  variant={status.secretsOk && status.testsOk && status.dedupOk ? "default" : "destructive"}
                  className={status.secretsOk && status.testsOk && status.dedupOk ? "bg-green-100 text-green-800" : ""}
                >
                  {status.secretsOk && status.testsOk && status.dedupOk ? '🟢 Tout fonctionne' : '🔴 Action requise'}
                </Badge>
              </div>
              
              {/* Debug info toggle */}
              {status.debug && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-500 cursor-pointer flex items-center gap-1">
                    <Bug className="h-3 w-3" />
                    Informations de debug
                  </summary>
                  <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                    {JSON.stringify(status.debug, null, 2)}
                  </pre>
                </details>
              )}

              {status.missing && status.missing.length > 0 && (
                <div className="mt-2 text-sm text-red-600">
                  <strong>⚠️ Variables manquantes:</strong> {status.missing.join(', ')}
                  <br />
                  <span className="text-xs">Configurez ces variables puis redéployez toutes les functions avec: <code>supabase functions deploy --all</code></span>
                </div>
              )}

              {!status.secretsOk && status.missing && status.missing.length > 0 && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <strong>📋 Étapes suivantes:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1 text-xs">
                    <li>Copiez la commande depuis l'alerte rouge ci-dessus</li>
                    <li>Remplacez <code>AIRTABLE_PAT=""</code> par votre vraie clé</li>
                    <li>Exécutez: <code className="bg-gray-100 px-1 rounded">supabase functions deploy --all</code></li>
                    <li>Cliquez sur "Actualiser" ci-dessus</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AirtableStatusWidget;
