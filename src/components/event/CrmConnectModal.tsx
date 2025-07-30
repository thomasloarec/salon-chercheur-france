import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ExternalLink } from 'lucide-react';
import { handleOAuthLogin } from '@/lib/oauthHandlers';
import { useToast } from '@/hooks/use-toast';
import { CrmProvider } from '@/types/crm';

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
  const [isConnecting, setIsConnecting] = useState<CrmProvider | null>(null);
  const { toast } = useToast();

  const handleConnect = async (provider: CrmProvider) => {
    setIsConnecting(provider);
    try {
      await handleOAuthLogin(provider);
      // Le modal se ferme automatiquement lors de la redirection OAuth
    } catch (error) {
      console.error('Erreur lors de la connexion CRM:', error);
      toast({
        title: "Erreur de connexion",
        description: "Impossible d'initier la connexion OAuth.",
        variant: "destructive",
      });
      setIsConnecting(null);
    }
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
          {crmProviders.map((crm) => (
            <Button
              key={crm.provider}
              onClick={() => handleConnect(crm.provider)}
              disabled={isConnecting !== null}
              className={`w-full h-14 text-white ${crm.color} flex items-center justify-between p-4 rounded-lg transition-colors`}
              variant="default"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{crm.name}</span>
                <span className="text-xs opacity-90">{crm.description}</span>
              </div>
              {isConnecting === crm.provider ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <ExternalLink className="h-5 w-5" />
              )}
            </Button>
          ))}
        </div>

        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConnecting !== null}
            className="px-8"
          >
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};