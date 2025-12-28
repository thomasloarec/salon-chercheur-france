import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { PremiumLeadDialog } from '@/components/premium/PremiumLeadDialog';

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noveltyId?: string;
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  eventSlug?: string;
}

export default function PremiumUpgradeDialog({ 
  open, 
  onOpenChange,
  noveltyId,
  eventId: propEventId,
  eventName: propEventName,
  eventDate: propEventDate,
  eventSlug: propEventSlug,
}: PremiumUpgradeDialogProps) {
  const [showLeadForm, setShowLeadForm] = React.useState(false);

  // Récupérer les infos de la nouveauté pour le formulaire (seulement si noveltyId est fourni)
  // On garde staleTime: Infinity pour garder les données en cache même quand le dialog se ferme
  const { data: noveltyData } = useQuery({
    queryKey: ['novelty-details-premium', noveltyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('novelties')
        .select(`
          id,
          title,
          event_id,
          events!novelties_event_id_fkey (
            id,
            nom_event,
            date_debut,
            slug
          )
        `)
        .eq('id', noveltyId)
        .single();
      
      if (error) {
        console.error('PremiumUpgradeDialog: Failed to fetch novelty details', error);
        throw error;
      }
      console.log('PremiumUpgradeDialog: Fetched novelty data', data);
      return data;
    },
    enabled: !!noveltyId,
    staleTime: Infinity, // Keep data in cache
  });

  // Fallback: récupérer les infos de l'événement si eventId est fourni mais pas les autres props
  const needsEventFetch = !!propEventId && (!propEventName || !propEventDate || !propEventSlug) && !noveltyId;
  const { data: eventData } = useQuery({
    queryKey: ['event-details-premium', propEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, nom_event, date_debut, slug')
        .eq('id', propEventId)
        .single();
      
      if (error) {
        console.error('PremiumUpgradeDialog: Failed to fetch event details', error);
        throw error;
      }
      console.log('PremiumUpgradeDialog: Fetched event data', data);
      return data;
    },
    enabled: needsEventFetch,
    staleTime: Infinity, // Keep data in cache
  });

  // Priority: noveltyData > eventData > props
  const eventId = noveltyData?.events?.id || eventData?.id || propEventId;
  const eventName = noveltyData?.events?.nom_event || eventData?.nom_event || propEventName;
  const eventDate = noveltyData?.events?.date_debut || eventData?.date_debut || propEventDate;
  const eventSlug = noveltyData?.events?.slug || eventData?.slug || propEventSlug;
  
  // Debug logging
  console.log('PremiumUpgradeDialog: Event data resolved', { eventId, eventName, eventDate, eventSlug });

  const handleContactSales = () => {
    onOpenChange(false);
    setShowLeadForm(true);
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
            <p className="text-muted-foreground">par événement</p>
          </div>
          
          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Leads illimités visibles avant le salon</p>
                <p className="text-sm text-muted-foreground">
                  Accédez à tous les contacts intéressés par votre nouveauté
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Capture de leads pendant le salon (bêta)</p>
                <p className="text-sm text-muted-foreground">
                  Lien unique et QR code pour votre équipe sur le stand
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
          >
            <Mail className="h-4 w-4 mr-2" />
            Être recontacté par l'équipe LotExpo
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Un membre de notre équipe vous contactera sous 24h pour finaliser votre commande
          </p>
        </div>
      </DialogContent>

      <PremiumLeadDialog
        open={showLeadForm}
        onOpenChange={setShowLeadForm}
        eventId={eventId}
        eventName={eventName}
        eventDate={eventDate}
        eventSlug={eventSlug}
      />
    </Dialog>
  );
}
