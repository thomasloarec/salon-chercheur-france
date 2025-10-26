import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Calendar, MapPin, Globe, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useExhibitorParticipations } from '@/hooks/useExhibitorParticipations';
import { normalizeExternalUrl } from '@/lib/url';

interface ExhibitorDialogProps {
  exhibitor: {
    id: string;
    name: string;
    slug?: string;
    logo_url?: string;
    description?: string;
    website?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExhibitorDialog({ 
  exhibitor, 
  open, 
  onOpenChange 
}: ExhibitorDialogProps) {
  const { data: participations = [], isLoading } = useExhibitorParticipations(
    exhibitor?.id || ''
  );

  if (!exhibitor) return null;

  const websiteHref = normalizeExternalUrl(exhibitor.website);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* PARTIE HAUTE : Infos génériques (sans stand) */}
        <DialogHeader>
          <div className="flex items-start gap-4">
            {exhibitor.logo_url ? (
              <img
                src={exhibitor.logo_url}
                alt={exhibitor.name}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">
                {exhibitor.name}
              </DialogTitle>
              {exhibitor.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {exhibitor.description}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Site web */}
        {websiteHref && (
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open(websiteHref, '_blank')}
            >
              <Globe className="h-4 w-4" />
              Visiter le site web
              <ExternalLink className="ml-auto h-3 w-3" />
            </Button>
          </div>
        )}

        {/* ✨ PARTIE BASSE : Participations aux événements */}
        {isLoading && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Chargement des participations...</span>
            </div>
          </div>
        )}

        {!isLoading && participations.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Présence sur les salons à venir
            </h3>

            <div className="space-y-3">
              {participations.map((participation) => (
                <div
                  key={participation.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {participation.event.nom_event}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(participation.event.date_debut), 'dd MMM yyyy', { locale: fr })}
                        {participation.event.date_fin !== participation.event.date_debut && (
                          <> - {format(new Date(participation.event.date_fin), 'dd MMM', { locale: fr })}</>
                        )}
                      </span>
                      {participation.event.ville && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {participation.event.ville}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ✨ Info du stand */}
                  {participation.stand && (
                    <Badge variant="secondary" className="ml-2 flex-shrink-0">
                      Stand {participation.stand}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message si aucun événement à venir */}
        {!isLoading && participations.length === 0 && (
          <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
            Aucune participation à venir pour le moment
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
