
import React, { useEffect } from 'react';
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

  useEffect(() => {
    if (autoRefresh) {
      checkStatus();
    }
  }, [autoRefresh, checkStatus]);

  const handleRefresh = async () => {
    await checkStatus();
    if (onSecretsConfigured) {
      onSecretsConfigured();
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
                      Manquants: {status.missing.join(', ')}
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AirtableStatusWidget;
