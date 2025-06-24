
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCrmIntegrations, useSyncCrmAccounts, useDisconnectCrm } from '@/hooks/useCrmIntegrations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Unplug, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import { CrmProvider } from '@/types/crm';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const CrmIntegrations = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { data: integrations = [], isLoading, refetch } = useCrmIntegrations();
  const syncMutation = useSyncCrmAccounts();
  const disconnectMutation = useDisconnectCrm();
  const { toast } = useToast();

  // Handle URL parameters for feedback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const disconnected = searchParams.get('disconnected');

    if (connected) {
      toast({
        title: "Connexion réussie",
        description: `${getProviderName(connected as CrmProvider)} a été connecté avec succès.`,
      });
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
    } else if (disconnected) {
      toast({
        title: "Déconnexion réussie",
        description: `${getProviderName(disconnected as CrmProvider)} a été déconnecté.`,
      });
    }
  }, [searchParams, toast]);

  const handleConnect = (provider: CrmProvider) => {
    // Redirect to OAuth flow
    window.location.href = `/api/integrations/${provider}/login`;
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
      await disconnectMutation.mutateAsync(provider);
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
                          disabled={disconnectMutation.isPending}
                          size="sm"
                          variant="outline"
                        >
                          <Unplug className="h-4 w-4 mr-2" />
                          Déconnecter
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleConnect(integration.provider)}
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connecter {getProviderName(integration.provider)}
                      </Button>
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
