
import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useAirtableStatus } from '@/hooks/useAirtableStatus';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Vérification finale
          </div>
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
                      {status.testsFailStep === 'Variables manquantes' && status.missing ? (
                        <>Échec: variables manquantes ({status.missing.join(', ')})</>
                      ) : (
                        <>Échec: {status.testsFailStep}</>
                      )}
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
                  {!status.dedupOk && status.testsFailStep === 'Variables manquantes' && status.missing && (
                    <div className="text-sm text-red-600">
                      Variables manquantes: {status.missing.join(', ')}
                    </div>
                  )}
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
