import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, Loader2, Link2, QrCode, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import PremiumUpgradeDialog from './PremiumUpgradeDialog';

interface LeadCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium: boolean;
  exhibitorId: string;
  eventId: string;
  eventName?: string;
  onRequestSuccess: () => void;
}

export default function LeadCaptureModal({
  open,
  onOpenChange,
  isPremium,
  exhibitorId,
  eventId,
  eventName,
  onRequestSuccess,
}: LeadCaptureModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPremiumUpgrade, setShowPremiumUpgrade] = useState(false);
  const { toast } = useToast();

  const handleRequest = async (topic: 'lead_capture_beta' | 'lead_capture_waitlist') => {
    setIsSubmitting(true);
    track(topic === 'lead_capture_beta' ? 'lead_capture_request_sent' : 'lead_capture_beta_waitlist_joined', {
      exhibitorId,
      eventId,
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.functions.invoke('premium-lead-submit', {
        body: {
          topic,
          exhibitorId,
          eventId,
          eventName: eventName || '',
          requestedByUserId: user?.id || '',
          context: 'exhibitor_dashboard',
        },
      });

      if (error) throw error;

      toast({
        title: 'Demande enregistrée',
        description: topic === 'lead_capture_beta'
          ? 'Un membre de l\'équipe vous recontactera sous 24h pour finaliser votre accès.'
          : 'Un membre de l\'équipe vous recontactera sous 24h pour vous présenter l\'offre.',
      });

      onRequestSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Lead capture request error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer la demande, réessayez.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePremiumClick = () => {
    track('lead_capture_premium_click', { exhibitorId, eventId });
    setShowPremiumUpgrade(true);
  };

  // Track modal open
  if (open) {
    track('lead_capture_open_modal', {
      variant: isPremium ? 'premium' : 'non_premium',
      exhibitorId,
      eventId,
    });
  }

  if (isPremium) {
    // Premium variant (fake-door)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <DialogTitle>Accès illimité à vos leads avant le salon</DialogTitle>
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Bêta
              </Badge>
            </div>
            <DialogDescription className="text-base">
              Obtenez les coordonnées complètes des visiteurs intéressés par votre nouveauté avant le salon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Leads illimités visibles avant le salon</p>
                <p className="text-sm text-muted-foreground">Accédez à tous les contacts intéressés par votre nouveauté</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Coordonnées complètes</p>
                <p className="text-sm text-muted-foreground">Email, téléphone, entreprise et fonction de chaque lead</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Export CSV</p>
                <p className="text-sm text-muted-foreground">Téléchargez vos leads pour les importer dans votre CRM</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => handleRequest('lead_capture_beta')}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Générer mon lien d'équipe (bêta)
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground w-full">
              Activation progressive — vous serez notifié(e) quand c'est prêt.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Non-Premium variant
  return (
    <>
      <Dialog open={open && !showPremiumUpgrade} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mb-3">
              <Badge className="bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 mb-3">
                Inclus avec Premium (99€ HT)
              </Badge>
            </div>
            <DialogTitle>Capture de leads pendant le salon</DialogTitle>
            <DialogDescription className="text-base">
              Centralisez vos leads avant et pendant le salon sur LotExpo. Un seul outil, moins de perte, plus de ROI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Lien unique par salon</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">QR à partager à l'équipe</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Export CSV illimité</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handlePremiumClick} className="w-full">
              Passer en Premium – 99€ HT
            </Button>
            <Button
              onClick={() => handleRequest('lead_capture_waitlist')}
              disabled={isSubmitting}
              variant="ghost"
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Se pré-inscrire à la bêta'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PremiumUpgradeDialog
        open={showPremiumUpgrade}
        onOpenChange={setShowPremiumUpgrade}
        noveltyId="" // Not needed for this context
      />
    </>
  );
}
