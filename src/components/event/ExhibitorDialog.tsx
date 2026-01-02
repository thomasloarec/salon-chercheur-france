import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Calendar, MapPin, Globe, Building2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useExhibitorParticipations } from '@/hooks/useExhibitorParticipations';
import { normalizeExternalUrl } from '@/lib/url';
import { normalizeStandNumber } from '@/utils/standUtils';

interface ExhibitorDialogProps {
  exhibitor: {
    id: string;
    name: string;
    slug?: string;
    logo_url?: string | null;
    description?: string | null;
    website?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackToAll?: () => void;
}

export function ExhibitorDialog({ 
  exhibitor, 
  open, 
  onOpenChange,
  onBackToAll
}: ExhibitorDialogProps) {
  const { data: participations = [], isLoading } = useExhibitorParticipations(
    exhibitor?.id || '',
    exhibitor?.name
  );

  if (!exhibitor) return null;

  const websiteHref = normalizeExternalUrl(exhibitor.website);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <div className="space-y-4">
          {/* Bouton retour si disponible */}
          {onBackToAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToAll}
              className="w-fit -mt-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tous les exposants
            </Button>
          )}

          {/* PARTIE HAUTE : En-tête avec logo et nom */}
          <div className="flex items-start gap-4">
            {exhibitor.logo_url ? (
              <img
                src={exhibitor.logo_url}
                alt={exhibitor.name}
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Building2 className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold mb-1 break-words">
                {exhibitor.name}
              </h2>
            </div>
          </div>

          {/* Description */}
          {exhibitor.description && (
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-relaxed break-words">
                {exhibitor.description}
              </p>
            </div>
          )}

          {/* Site web */}
          {websiteHref && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => window.open(websiteHref, '_blank')}
            >
              <Globe className="h-4 w-4" />
              Visiter le site web
              <ExternalLink className="ml-auto h-3 w-3" />
            </Button>
          )}

          {/* Chargement des participations */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          )}

          {/* Liste des participations */}
          {!isLoading && participations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-primary" />
                Présence sur les salons à venir
              </div>

              <div className="space-y-2">
                {participations.map((participation) => (
                  <div
                    key={participation.id}
                    className="rounded-lg bg-muted/50 border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-sm flex-1 break-words">
                        {participation.event.nom_event}
                      </p>
                      {participation.stand && (
                        <Badge variant="secondary" className="flex-shrink-0 whitespace-nowrap">
                          Stand {normalizeStandNumber(participation.stand)}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        {format(new Date(participation.event.date_debut), 'dd MMM yyyy', { locale: fr })}
                        {participation.event.date_fin !== participation.event.date_debut && (
                          <> - {format(new Date(participation.event.date_fin), 'dd MMM', { locale: fr })}</>
                        )}
                      </span>
                      {participation.event.ville && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {participation.event.ville}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message si aucun événement à venir */}
          {!isLoading && participations.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aucune participation à venir pour le moment
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
