import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScanQrCode, Sparkles } from 'lucide-react';
import PremiumUpgradeDialog from './PremiumUpgradeDialog';
import { track } from '@/lib/analytics';

interface LeadCaptureCardProps {
  isPremium: boolean;
  exhibitorId: string;
  eventId: string;
  eventName?: string;
}

export default function LeadCaptureCard({ 
  isPremium, 
  exhibitorId, 
  eventId,
  eventName 
}: LeadCaptureCardProps) {
  const [showModal, setShowModal] = useState(false);

  // Track card view
  useEffect(() => {
    track('lead_capture_card_viewed', { exhibitorId, eventId, isPremium });
  }, [exhibitorId, eventId, isPremium]);

  return (
    <>
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-background to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <ScanQrCode className="h-6 w-6 text-primary" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-base">
                  Capturer des leads avant et pendant le salon (bêta)
                </h4>
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Bêta
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                Débloquez les leads floutés avant le salon, puis capturez-en directement sur votre stand via un lien/QR unique partagé avec votre équipe.
              </p>

              <p className="text-xs text-muted-foreground italic">
                Les leads seront automatiquement tagués pour distinguer ceux capturés <strong>avant</strong> et <strong>pendant</strong> le salon.
              </p>

              {/* CTA */}
              <div className="pt-2">
                {isPremium ? (
                  <Button size="sm" onClick={() => setShowModal(true)}>
                    Obtenir mon lien d'équipe
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowModal(true)}>
                    En savoir plus sur le forfait Premium
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PremiumUpgradeDialog
        open={showModal}
        onOpenChange={setShowModal}
        eventId={eventId}
        eventName={eventName}
      />
    </>
  );
}
