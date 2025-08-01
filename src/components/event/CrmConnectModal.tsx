import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2 } from 'lucide-react';
import { CrmProvider } from '@/types/crm';
import { useCrmConnections } from '@/hooks/useCrmConnections';

interface CrmConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const crmProviders: Array<{
  provider: CrmProvider;
  name: string;
  description: string;
  color: string;
}> = [
  {
    provider: 'salesforce',
    name: 'Salesforce',
    description: 'CRM leader mondial',
    color: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    provider: 'hubspot',
    name: 'HubSpot',
    description: 'Plateforme marketing et ventes',
    color: 'bg-orange-500 hover:bg-orange-600',
  },
  {
    provider: 'pipedrive',
    name: 'Pipedrive',
    description: 'CRM pour équipes commerciales',
    color: 'bg-green-600 hover:bg-green-700',
  },
  {
    provider: 'zoho',
    name: 'Zoho CRM',
    description: 'Suite CRM complète',
    color: 'bg-purple-600 hover:bg-purple-700',
  },
];

export const CrmConnectModal = ({ open, onOpenChange }: CrmConnectModalProps) => {
  const { connections, loading, connectCrm, disconnectCrm } = useCrmConnections();
  
  console.log('🔍 CrmConnectModal - rendered, open:', open, 'connections:', connections, 'loading:', loading);

  const handleConnect = async (provider: CrmProvider) => {
    await connectCrm(provider);
  };

  const handleDisconnect = async (provider: CrmProvider) => {
    await disconnectCrm(provider);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Connectez votre CRM
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            Synchronisez vos prospects avec les exposants de l'événement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {crmProviders.map((crm) => {
            const isConnected = connections[crm.provider];
            
            return (
              <div key={crm.provider} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex flex-col">
                  <span className="font-medium">{crm.name}</span>
                  <span className="text-xs text-muted-foreground">{crm.description}</span>
                </div>
                
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Connecté
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(crm.provider)}
                      disabled={loading}
                    >
                      Déconnecter
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleConnect(crm.provider)}
                    disabled={loading}
                    className={`text-white ${crm.color}`}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        Connecter
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-8"
          >
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};