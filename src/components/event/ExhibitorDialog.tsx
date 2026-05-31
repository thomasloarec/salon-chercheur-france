import React from 'react';
import { Link } from 'react-router-dom';
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
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import ExhibitorFullProfileCTA, { FullProfileSurface } from '@/components/exhibitor/ExhibitorFullProfileCTA';

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
  // Phase 4B — public profile CTA (prefetched slug, no per-card fetch)
  publicSlug?: string | null;
  seoIndexable?: boolean;
  isTest?: boolean;
  openInNewTab?: boolean;
  surface?: FullProfileSurface;
  eventSlug?: string;
}

export function ExhibitorDialog({ 
  exhibitor, 
  open, 
  onOpenChange,
  onBackToAll,
  publicSlug,
  seoIndexable,
  isTest,
  openInNewTab = false,
  surface = 'novelty_card',
  eventSlug,
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
            {(() => {
              const resolvedLogo = getExhibitorLogoUrl(exhibitor.logo_url, exhibitor.website);
              return resolvedLogo ? (
                <div className="w-20 h-20 rounded-lg bg-white border flex items-center justify-center flex-shrink-0 p-1">
                  <img
                    src={resolvedLogo}
                    alt={exhibitor.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
              );
            })()}
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

          {/* Phase 4B — full public profile CTA */}
          {publicSlug && !isTest && (
            <ExhibitorFullProfileCTA
              publicSlug={publicSlug}
              seoIndexable={seoIndexable}
              isTest={isTest}
              openInNewTab={openInNewTab}
              surface={surface}
              eventSlug={eventSlug}
              className="w-full"
            />
          )}

          {/* Chargement des participations */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          )}

          {/* Phase 4B-bis — résumé compact (détail complet sur la fiche exposant) */}
          {!isLoading && participations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-primary" />
                Présent sur {participations.length} salon
                {participations.length > 1 ? 's' : ''} à venir
              </div>
              <ul className="space-y-1">
                {participations.slice(0, 2).map((participation) => (
                  <li key={participation.id}>
                    <Link
                      to={`/events/${participation.event.slug}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{participation.event.nom_event}</span>
                      <span className="text-xs whitespace-nowrap">
                        {format(new Date(participation.event.date_debut), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
