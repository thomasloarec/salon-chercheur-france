import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Event } from '@/types/event';
import { ExternalLink, Building2, MapPin, Globe, Calendar } from 'lucide-react';
import { hydrateExhibitor } from '@/lib/hydrateExhibitor';
import { normalizeExternalUrl } from '@/lib/url';
import { normalizeStandNumber } from '@/utils/standUtils';
import { useExhibitorParticipations } from '@/hooks/useExhibitorParticipations';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Exhibitor {
  id_exposant: string;
  exhibitor_name?: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
  urlexpo_event?: string;
  logo_url?: string;
  // Fields from participations_with_exhibitors view
  name_final?: string;
  legacy_name?: string;
  exhibitor_uuid?: string;
  description_final?: string;
  website_final?: string;
}

interface ExhibitorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitor: Exhibitor | null;
  event: Event;
  onBackToAll?: () => void;
}

// Récupère le nom réel de l'exposant
const getDisplayName = (exhibitor: Exhibitor): string => {
  return exhibitor.name_final || exhibitor.exhibitor_name || exhibitor.legacy_name || '';
};

// Récupère la description
const getDescription = (exhibitor: Exhibitor): string | undefined => {
  return exhibitor.description_final || exhibitor.exposant_description;
};

// Récupère le website
const getWebsite = (exhibitor: Exhibitor): string | undefined => {
  return exhibitor.website_final || exhibitor.website_exposant;
};

export const ExhibitorDetailDialog: React.FC<ExhibitorDetailDialogProps> = ({ 
  open, 
  onOpenChange, 
  exhibitor, 
  event,
  onBackToAll
}) => {
  const [details, setDetails] = useState<Exhibitor | null>(null);
  
  // Utiliser le hook pour récupérer les participations futures
  const exhibitorId = exhibitor?.exhibitor_uuid || exhibitor?.id_exposant || '';
  const exhibitorName = exhibitor ? getDisplayName(exhibitor) : undefined;
  
  const { data: participations = [], isLoading: loadingParticipations } = useExhibitorParticipations(
    exhibitorId,
    exhibitorName
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!open || !exhibitor) {
        setDetails(null);
        return;
      }
      // Hydrater si les champs website/description manquent
      const hasDescription = getDescription(exhibitor);
      const hasWebsite = getWebsite(exhibitor);
      
      if (!hasWebsite && !hasDescription) {
        const full = await hydrateExhibitor(exhibitor as any);
        // Préserver le stand_exposant de l'exhibitor original
        if (!cancelled) setDetails({ 
          ...full as any,
          stand_exposant: exhibitor.stand_exposant || (full as any).stand_exposant 
        });
      } else {
        setDetails(exhibitor);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [open, exhibitor]);


  if (!exhibitor) return null;
  
  const e = details ?? exhibitor;
  const displayName = getDisplayName(e);
  const description = getDescription(e);
  const websiteHref = normalizeExternalUrl(getWebsite(e));
  const expoPageHref = normalizeExternalUrl(e?.urlexpo_event);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          {typeof onBackToAll === 'function' && (
            <div className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToAll}
                className="px-2 -ml-2 h-8"
                aria-label="Retour à tous les exposants"
              >
                ← Tous les exposants
              </Button>
            </div>
          )}
          <DialogTitle className="flex items-center gap-3">
            {e.logo_url ? (
              <div className="h-12 w-12 rounded bg-white border flex items-center justify-center flex-shrink-0 p-1">
                <img
                  src={e.logo_url}
                  alt={displayName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="truncate">{displayName}</div>
              {e.stand_exposant && (
                <Badge variant="secondary" className="mt-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  Stand {normalizeStandNumber(e.stand_exposant)}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          {description && (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {description}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {websiteHref && (
              <Button asChild variant="default">
                <a href={websiteHref} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4 mr-2" />
                  Site Web
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            )}
            {expoPageHref && (
              <Button variant="outline" asChild>
                <a href={expoPageHref} target="_blank" rel="noopener noreferrer">
                  Fiche Salon
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            )}
          </div>

          {/* Chargement des participations */}
          {loadingParticipations && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Chargement des participations...</span>
            </div>
          )}

          {/* Liste des participations futures */}
          {!loadingParticipations && participations.length > 0 && (
            <div className="space-y-3 border-t pt-4">
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
                        <Link 
                          to={`/events/${participation.event.slug}`}
                          className="hover:text-primary hover:underline transition-colors"
                          onClick={() => onOpenChange(false)}
                        >
                          {participation.event.nom_event}
                        </Link>
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
          {!loadingParticipations && participations.length === 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Calendar className="h-4 w-4 text-primary" />
                Présence sur les salons à venir
              </div>
              <p className="text-sm text-muted-foreground">
                Aucune participation à venir pour le moment
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
