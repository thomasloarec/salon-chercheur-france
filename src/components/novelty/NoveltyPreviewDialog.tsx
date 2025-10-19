import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, MapPin, Building2 } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

const TYPE_LABELS: Record<string, string> = {
  Launch: 'Lancement',
  Prototype: 'Prototype',
  MajorUpdate: 'Mise à jour majeure',
  LiveDemo: 'Démo live',
  Partnership: 'Partenariat',
  Offer: 'Offre',
  Talk: 'Conférence',
};

interface NoveltyPreviewDialogProps {
  novelty: {
    id: string;
    title: string;
    type: string;
    status: string;
    media_urls: string[];
    doc_url?: string;
    reason_1?: string;
    stand_info?: string;
    exhibitors: {
      name: string;
      slug: string;
    };
    events: {
      nom_event: string;
      slug: string;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NoveltyPreviewDialog({ novelty, open, onOpenChange }: NoveltyPreviewDialogProps) {
  const getStatusBadge = (status: string) => {
    const statusMap = {
      draft: { label: 'En attente', variant: 'secondary' as const },
      under_review: { label: 'En révision', variant: 'default' as const },
      published: { label: 'Publié', variant: 'default' as const },
      rejected: { label: 'Rejeté', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.draft;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="novelty-preview-desc">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{novelty.title}</DialogTitle>
              <DialogDescription id="novelty-preview-desc" className="sr-only">
                Aperçu de la nouveauté {novelty.title} proposée par {novelty.exhibitors.name} pour l'événement {novelty.events.nom_event}
              </DialogDescription>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{novelty.exhibitors.name}</span>
                <span>•</span>
                <MapPin className="h-4 w-4" />
                <span>{novelty.events.nom_event}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(novelty.status)}
              <Badge variant="outline">{TYPE_LABELS[novelty.type] || novelty.type}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Images Carousel */}
          {novelty.media_urls && novelty.media_urls.length > 0 && (
            <div className="relative">
              <Carousel className="w-full">
                <CarouselContent>
                  {novelty.media_urls.map((url, index) => (
                    <CarouselItem key={index}>
                      <div className="aspect-video relative rounded-lg overflow-hidden bg-muted">
                        <img
                          src={url}
                          alt={`${novelty.title} - Image ${index + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {novelty.media_urls.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur px-3 py-1 rounded-full text-sm">
                {novelty.media_urls.length} image{novelty.media_urls.length > 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Description */}
          {novelty.reason_1 && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed">{novelty.reason_1}</p>
            </div>
          )}

          {/* Stand Info */}
          {novelty.stand_info && (
            <div>
              <h3 className="font-semibold mb-2">Informations stand</h3>
              <p className="text-muted-foreground">{novelty.stand_info}</p>
            </div>
          )}

          {/* PDF Brochure */}
          {novelty.doc_url && (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <ExternalLink className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Brochure PDF disponible</p>
                <p className="text-sm text-muted-foreground">Document avec informations détaillées</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(novelty.doc_url, '_blank')}
              >
                Télécharger
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
