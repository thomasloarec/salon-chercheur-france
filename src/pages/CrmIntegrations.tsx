import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrmConnections } from '@/hooks/useCrmConnections';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Unplug, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import { CrmProvider } from '@/types/crm';
import { CrmClaimModal } from '@/components/crm/CrmClaimModal';

const CrmIntegrations = () => {
  const { user } = useAuth();
  const { 
    connections, 
    loading, 
    claimData, 
    connectCrm, 
    disconnectCrm,
    claimConnection,
    clearClaimData,
    refreshConnections 
  } = useCrmConnections();
  const { toast } = useToast();

  // Si l'utilisateur est connecté et qu'il y a des données de claim, déclencher automatiquement le claim
  useEffect(() => {
    if (user && claimData) {
      claimConnection();
    }
  }, [user, claimData]);

  const getProviderName = (provider: CrmProvider): string => {
    const names = {
      hubspot: 'HubSpot',
      salesforce: 'Salesforce',
      pipedrive: 'Pipedrive',
      zoho: 'Zoho CRM'
    };
    return names[provider] || provider;
  };

  const getProviderIcon = (provider: CrmProvider) => {
    switch (provider) {
      case 'hubspot': return '🧡';
      case 'salesforce': return '⚡';
      case 'pipedrive': return '💼';
      case 'zoho': return '📊';
      default: return '🔗';
    }
  };

  const supportedProviders: CrmProvider[] = ['hubspot', 'salesforce', 'pipedrive', 'zoho'];

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="heading-display text-3xl font-bold mb-2 text-foreground">Intégrations CRM</h1>
          <p className="text-muted-foreground">
            Connecte tes outils CRM pour synchroniser tes données d'entreprise et événements.
            {!user && (
              <span className="block mt-2 text-primary font-medium">
                Tu peux commencer la connexion même sans compte - nous te guiderons ensuite !
              </span>
            )}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {supportedProviders.map((provider) => {
            const isConnected = connections[provider];
            const isCurrentlyLoading = loading;
            
            return (
              <Card key={provider} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getProviderIcon(provider)}</span>
                      <div>
                        <CardTitle className="heading-display text-xl">{getProviderName(provider)}</CardTitle>
                        <CardDescription>
                          {provider === 'hubspot' && 'Synchronise tes entreprises et contacts'}
                          {provider === 'salesforce' && 'Accède à tes comptes Salesforce'}
                          {provider === 'pipedrive' && 'Importe tes organisations'}
                          {provider === 'zoho' && 'Connecte tes comptes Zoho CRM'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Connecté
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Non connecté
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    {isConnected ? (
                      <>
                        <Button 
                          onClick={() => refreshConnections()}
                          variant="outline" 
                          size="sm"
                          disabled={isCurrentlyLoading}
                        >
                          Actualiser
                        </Button>
                        <Button 
                          onClick={() => disconnectCrm(provider)}
                          variant="destructive" 
                          size="sm"
                          disabled={isCurrentlyLoading}
                        >
                          <Unplug className="h-4 w-4 mr-1" />
                          Déconnecter
                        </Button>
                      </>
                    ) : (
                      <div>
                        {/* Bouton Connecter CRM désactivé temporairement - à réactiver plus tard */}
                        {false && (
                          <Button 
                            onClick={() => connectCrm(provider)}
                            className="gap-2"
                            disabled={isCurrentlyLoading}
                          >
                            <ExternalLink className="h-4 w-4" />
                            {isCurrentlyLoading ? 'Connexion...' : `Connecter ${getProviderName(provider)}`}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {provider === 'hubspot' && !isConnected && (
                    <p className="text-sm text-muted-foreground mt-3">
                      Première fois ? Pas de souci ! Tu pourras créer ton compte après avoir autorisé la connexion.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Section d'aide */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="heading-display">Aide et Support</CardTitle>
            <CardDescription>
              Des questions sur les intégrations CRM ?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              • Les connexions sont sécurisées et chiffrées
            </p>
            <p className="text-sm text-muted-foreground">
              • Tu peux te déconnecter à tout moment
            </p>
            <p className="text-sm text-muted-foreground">
              • Les données ne sont jamais partagées avec des tiers
            </p>
          </CardContent>
        </Card>

        {/* Modal de réclamation de connexion */}
        {claimData && (
          <CrmClaimModal
            isOpen={!!claimData}
            onClose={clearClaimData}
            claimData={claimData}
            onClaimSuccess={claimConnection}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default CrmIntegrations;