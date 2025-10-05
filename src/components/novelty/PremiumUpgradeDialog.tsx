import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Check, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noveltyId: string;
}

export default function PremiumUpgradeDialog({ 
  open, 
  onOpenChange,
  noveltyId
}: PremiumUpgradeDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = React.useState(false);

  const handleContactSales = async () => {
    setSending(true);
    try {
      toast({
        title: 'Demande enregistrée',
        description: 'Notre équipe vous contactera sous 24h pour activer votre accès Premium. Nous vous contacterons à l\'adresse email de votre compte.',
        duration: 5000,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer la demande. Réessayez.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Crown className="h-6 w-6 text-yellow-500" />
            Passez en Premium
          </DialogTitle>
          <DialogDescription>
            Débloquez l'accès illimité à tous vos leads
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Price */}
          <div className="text-center py-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
            <p className="text-5xl font-bold mb-2">99€ <span className="text-xl font-normal text-muted-foreground">HT</span></p>
            <p className="text-muted-foreground">Par nouveauté et par événement</p>
          </div>
          
          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Leads illimités</p>
                <p className="text-sm text-muted-foreground">
                  Accédez à tous les contacts intéressés par votre nouveauté
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Coordonnées complètes</p>
                <p className="text-sm text-muted-foreground">
                  Email, téléphone, entreprise et fonction de chaque lead
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Export CSV</p>
                <p className="text-sm text-muted-foreground">
                  Téléchargez vos leads pour les importer dans votre CRM
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Statistiques détaillées</p>
                <p className="text-sm text-muted-foreground">
                  Suivez les performances de votre nouveauté en temps réel
                </p>
              </div>
            </div>
          </div>
          
          {/* CTA */}
          <Button 
            className="w-full" 
            size="lg" 
            onClick={handleContactSales}
            disabled={sending}
          >
            <Mail className="h-4 w-4 mr-2" />
            {sending ? 'Envoi...' : 'Être recontacté par l\'équipe LotExpo'}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Un membre de notre équipe vous contactera sous 24h pour finaliser votre commande
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
