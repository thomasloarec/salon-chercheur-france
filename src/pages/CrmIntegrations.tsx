
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCrmIntegrations, useSyncCrmAccounts } from '@/hooks/useCrmIntegrations';
import { handleOAuthLogin, handleOAuthCallback, handleDisconnectCrm } from '@/lib/oauthHandlers';
import { useHubSpotOAuth } from '@/hooks/useHubSpotOAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Unplug, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { CrmProvider } from '@/types/crm';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { HUBSPOT_CLIENT_ID, HUBSPOT_REDIRECT_URI, CRM_OAUTH_ENABLED, getEffectiveHubspotConfig, maskClientId } from '@/lib/hubspotConfig';

const CrmIntegrations = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDebug = searchParams.has('oauthDebug');
  const { data: integrations = [], isLoading, refetch } = useCrmIntegrations();
  const syncMutation = useSyncCrmAccounts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const effectiveConfig = getEffectiveHubspotConfig();
  const canConnectHubspot = CRM_OAUTH_ENABLED && effectiveConfig.source !== 'none';
  const { initiateOAuth: initiateHubSpotOAuth, loading: hubspotLoading } = useHubSpotOAuth();

  // Handle OAuth callback and other URL parameters
  useEffect(() => {
    const callback = searchParams.get('callback');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const connected = searchParams.get('connected');
    const disconnected = searchParams.get('disconnected');

    // Handle OAuth callback
    if (callback && code && state) {
      handleOAuthCallback(callback as CrmProvider, code, state)
        .then(() => {
          toast({
            title: "Connexion réussie",
            description: `${getProviderName(callback as CrmProvider)} a été connecté avec succès.`,
          });
          queryClient.invalidateQueries({ queryKey: ['crm-integrations', user?.id] });
          // Clean up URL parameters
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('callback');
          newParams.delete('code');
          newParams.delete('state');
          newParams.set('connected', callback);
          setSearchParams(newParams);
        })
        .catch((error) => {
          console.error('OAuth callback error:', error);
          toast({
            title: "Erreur de connexion",
            description: `Impossible de connecter ${getProviderName(callback as CrmProvider)}.`,
            variant: "destructive",
          });
          // Clean up URL parameters
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('callback');
          newParams.delete('code');
          newParams.delete('state');
          newParams.set('error', callback);
          setSearchParams(newParams);
        });
    }
    // Handle other feedback parameters
    else if (connected) {
      toast({
        title: "Connexion réussie",
        description: `${getProviderName(connected as CrmProvider)} a été connecté avec succès.`,
      });
      // Clean up the parameter after showing toast
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('connected');
      setSearchParams(newParams, { replace: true });
    } else if (error) {
      if (error === 'unauthorized') {
        toast({
          title: "Erreur d'authentification",
          description: "Vous devez être connecté pour gérer les intégrations CRM.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur de connexion",
          description: `Impossible de connecter ${getProviderName(error as CrmProvider)}.`,
          variant: "destructive",
        });
      }
      // Clean up the parameter after showing toast
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
      setSearchParams(newParams, { replace: true });
    } else if (disconnected) {
      toast({
        title: "Déconnexion réussie",
        description: `${getProviderName(disconnected as CrmProvider)} a été déconnecté.`,
      });
      // Clean up the parameter after showing toast
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('disconnected');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, user?.id, queryClient]);

  const handleConnect = async (provider: CrmProvider) => {
    try {
      if (provider === 'hubspot') {
        // Use new HubSpot OAuth flow with popup and state verification
        await initiateHubSpotOAuth();
        // Refresh integrations after successful connection
        queryClient.invalidateQueries({ queryKey: ['crm-integrations', user?.id] });
        toast({
          title: "Connexion réussie",
          description: "HubSpot a été connecté avec succès.",
        });
      } else {
        // Use legacy flow for other providers
        await handleOAuthLogin(provider);
      }
    } catch (error) {
      toast({
        title: "Erreur de connexion",
        description: error instanceof Error ? error.message : "Impossible d'initier la connexion OAuth.",
        variant: "destructive",
      });
    }
  };

  const handleSync = async (provider: CrmProvider) => {
    try {
      await syncMutation.mutateAsync(provider);
      toast({
        title: "Synchronisation réussie",
        description: `Les comptes ${getProviderName(provider)} ont été synchronisés.`,
      });
    } catch (error) {
      toast({
        title: "Erreur de synchronisation",
        description: "Impossible de synchroniser les comptes.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (provider: CrmProvider) => {
    try {
      await handleDisconnectCrm(provider);
      queryClient.invalidateQueries({ queryKey: ['crm-integrations', user?.id] });
      toast({
        title: "Déconnexion réussie",
        description: `${getProviderName(provider)} a été déconnecté.`,
      });
    } catch (error) {
      toast({
        title: "Erreur de déconnexion",
        description: "Impossible de déconnecter le CRM.",
        variant: "destructive",
      });
    }
  };

  const getProviderName = (provider: CrmProvider): string => {
    switch (provider) {
      case 'salesforce': return 'Salesforce';
      case 'hubspot': return 'HubSpot';
      case 'pipedrive': return 'Pipedrive';
      case 'zoho': return 'Zoho CRM';
      default: return provider;
    }
  };

  if (!user) {
    return (
      <MainLayout title="Intégrations CRM">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-600 mb-2">
              Connectez-vous pour gérer vos intégrations CRM
            </h2>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Intégrations CRM">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">
              Intégrations CRM
            </h1>
            <p className="text-gray-600">
              Connectez vos CRM pour synchroniser automatiquement vos comptes clients
            </p>
            
            {isDebug && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4 text-sm">
                <h3 className="font-semibold text-blue-900 mb-2">🔍 Configuration HubSpot (Debug)</h3>
                <div className="text-blue-800 space-y-1">
                  <div><span className="font-medium">Source:</span> <code className="bg-blue-100 px-1 rounded">{effectiveConfig.source === 'debug' ? 'Debug (sessionStorage)' : effectiveConfig.source === 'env' ? 'Variables d\'environnement' : 'Aucune'}</code></div>
                  <div><span className="font-medium">CRM OAuth Enabled:</span> <code className="bg-blue-100 px-1 rounded">{CRM_OAUTH_ENABLED ? 'Oui' : 'Non'}</code></div>
                  <div><span className="font-medium">Config Valid:</span> <code className="bg-blue-100 px-1 rounded">{effectiveConfig.source !== 'none' ? 'Oui' : 'Non'}</code></div>
                  <div><span className="font-medium">HubSpot CLIENT_ID:</span> <code className="bg-blue-100 px-1 rounded">{maskClientId(effectiveConfig.clientId) || 'manquant'}</code></div>
                  <div><span className="font-medium">Redirect URI:</span> <code className="bg-blue-100 px-1 rounded">{effectiveConfig.redirectUri || 'manquant'}</code></div>
                </div>
              </div>
            )}
            
            {!canConnectHubspot && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-4 text-sm">
                <div className="flex items-start gap-2">
                  <div className="text-yellow-600">⚠️</div>
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-1">Intégrations CRM indisponibles</h4>
                    <div className="text-yellow-700">
                      {!CRM_OAUTH_ENABLED ? (
                        <p>Intégrations CRM désactivées (flag CRM_OAUTH_ENABLED)</p>
                      ) : (
                        <div>
                          <p>Configuration HubSpot incomplète</p>
                          {isDebug && (
                            <p className="mt-1">
                              <a href="/oauth/hubspot/test?oauthDebug=1" className="underline">
                                → Mode debug disponible
                              </a>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {integrations.map((integration) => (
                <Card key={integration.provider}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {getProviderName(integration.provider)}
                        {integration.connected && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Connecté
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                    <CardDescription>
                      {integration.connected ? (
                        <div className="space-y-1">
                          <p>{integration.accountsCount} comptes synchronisés</p>
                          {integration.lastSync && (
                            <p className="text-xs">
                              Dernière sync : {formatDistanceToNow(new Date(integration.lastSync), { 
                                addSuffix: true, 
                                locale: fr 
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p>Connectez votre {getProviderName(integration.provider)} pour synchroniser vos comptes</p>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {integration.connected ? (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSync(integration.provider)}
                          disabled={syncMutation.isPending}
                          size="sm"
                          variant="outline"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Synchroniser
                        </Button>
                        <Button
                          onClick={() => handleDisconnect(integration.provider)}
                          size="sm"
                          variant="outline"
                        >
                          <Unplug className="h-4 w-4 mr-2" />
                          Déconnecter
                        </Button>
                      </div>
                    ) : (
                      (integration.provider === 'hubspot' && !canConnectHubspot) ? (
                        <div className="space-y-2">
                          <Button disabled className="w-full">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Connecter {getProviderName(integration.provider)} (indisponible)
                          </Button>
                          {isDebug && (
                            <p className="text-xs text-muted-foreground text-center">
                              <a href="/oauth/hubspot/test?oauthDebug=1" className="text-primary hover:underline">
                                → Mode diagnostic OAuth
                              </a>
                            </p>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleConnect(integration.provider)}
                          className="w-full"
                          disabled={integration.provider === 'hubspot' && hubspotLoading}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {integration.provider === 'hubspot' && hubspotLoading ? 'Connexion...' : `Connecter ${getProviderName(integration.provider)}`}
                        </Button>
                      )
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CrmIntegrations;
