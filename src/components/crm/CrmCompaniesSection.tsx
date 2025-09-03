import { useState } from 'react';
import { Building, Plus } from 'lucide-react';
import { useCrmMatches } from '@/hooks/useCrmMatches';
import { useCrmIntegrations } from '@/hooks/useCrmIntegrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CrmConnectModal } from '@/components/event/CrmConnectModal';
import { CrmCompanyCard } from './CrmCompanyCard';

export const CrmCompaniesSection = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { data: crmMatches, isLoading: matchesLoading } = useCrmMatches();
  const { data: integrations, isLoading: integrationsLoading } = useCrmIntegrations();

  const hasConnectedCrm = integrations?.some(integration => integration.connected) ?? false;
  const isLoading = matchesLoading || integrationsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Mes entreprises CRM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Cas non connecté au CRM
  if (!hasConnectedCrm) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Mes entreprises CRM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Connectez votre CRM pour voir automatiquement les salons auxquels vos prospects participent.
            </p>
            {/* Bouton Connecter CRM désactivé temporairement - à réactiver plus tard */}
            {false && (
              <Button onClick={() => setShowConnectModal(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Connecter mon CRM
              </Button>
            )}
          </CardContent>
        </Card>
        
        <CrmConnectModal 
          open={showConnectModal} 
          onOpenChange={setShowConnectModal} 
        />
      </>
    );
  }

  // Cas connecté mais sans correspondances
  if (!crmMatches?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Mes entreprises CRM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aucune entreprise trouvée dans votre CRM correspondant aux exposants de nos salons.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Cas avec correspondances
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Mes entreprises CRM ({crmMatches.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {crmMatches.map((company) => (
          <CrmCompanyCard key={`${company.id}-${company.provider}`} company={company} />
        ))}
      </CardContent>
    </Card>
  );
};