import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticResult {
  success: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasRedirectUri: boolean;
  hasEncryptionKey: boolean;
  hasStateSigningKey: boolean;
  hasSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
  redirectUri: string;
  expectedScopes: string;
  timestamp?: string;
  message?: string;
}

export const OAuthHubSpotDiagnostic = () => {
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔍 Running OAuth HubSpot diagnostics...');
      
      const { data, error } = await supabase.functions.invoke('oauth-hubspot-diagnostics', {
        method: 'GET'
      });

      if (error) {
        console.error('❌ Diagnostics failed:', error);
        setError(`Erreur lors du diagnostic: ${error.message}`);
        return;
      }

      console.log('✅ Diagnostics completed:', data);
      setResult(data);

    } catch (err) {
      console.error('❌ Diagnostics error:', err);
      setError(`Erreur inattendue: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const ConfigItem = ({ label, value, expected }: { label: string; value: boolean; expected?: string }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex flex-col">
        <span className="font-medium text-gray-900">{label}</span>
        {expected && (
          <span className="text-xs text-gray-500 mt-1">{expected}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {value ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Configuré
          </Badge>
        ) : (
          <Badge variant="destructive" className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Manquant
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Diagnostic OAuth HubSpot</h3>
      </div>

      <div className="space-y-4">
        <p className="text-gray-600">
          Vérifiez que toutes les variables d'environnement nécessaires à l'OAuth HubSpot sont correctement configurées.
        </p>

        <Button
          onClick={runDiagnostics}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Test en cours...
            </>
          ) : (
            <>
              <Settings className="w-4 h-4 mr-2" />
              Tester la configuration OAuth HubSpot
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            {/* Status global */}
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <AlertDescription className="font-medium">
                  {result.message || (result.success ? 'Configuration complète' : 'Configuration incomplète')}
                </AlertDescription>
              </div>
            </Alert>

            {/* Détails des variables */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 mb-3">Variables d'environnement:</h4>
              
              <ConfigItem 
                label="HUBSPOT_CLIENT_ID" 
                value={result.hasClientId}
                expected="UUID v4 de l'app HubSpot"
              />
              
              <ConfigItem 
                label="HUBSPOT_CLIENT_SECRET" 
                value={result.hasClientSecret}
                expected="Secret de l'app HubSpot"
              />
              
              <ConfigItem 
                label="HUBSPOT_REDIRECT_URI" 
                value={result.hasRedirectUri}
                expected="https://lotexpo.com/oauth/hubspot/callback"
              />
              
              <ConfigItem 
                label="CRM_ENCRYPTION_KEY" 
                value={result.hasEncryptionKey}
                expected="Clé base64 de 32 bytes pour AES-GCM"
              />
              
              <ConfigItem 
                label="OAUTH_STATE_SIGNING_KEY" 
                value={result.hasStateSigningKey}
                expected="Clé HMAC pour signature d'état"
              />
              
              <ConfigItem 
                label="SUPABASE_URL" 
                value={result.hasSupabaseUrl}
              />
              
              <ConfigItem 
                label="SUPABASE_SERVICE_ROLE_KEY" 
                value={result.hasServiceRoleKey}
              />
            </div>

            {/* Informations de configuration */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Configuration actuelle:</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Redirect URI:</span> 
                  <code className="ml-2 text-xs bg-white px-1 py-0.5 rounded">
                    {result.redirectUri}
                  </code>
                </div>
                <div>
                  <span className="font-medium">Scopes attendus:</span>
                  <code className="ml-2 text-xs bg-white px-1 py-0.5 rounded">
                    {result.expectedScopes}
                  </code>
                </div>
                {result.timestamp && (
                  <div className="text-gray-600 text-xs mt-2">
                    Testé le: {new Date(result.timestamp).toLocaleString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};