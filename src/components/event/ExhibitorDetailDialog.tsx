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
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { useExhibitorParticipations } from '@/hooks/useExhibitorParticipations';
import { useExhibitorGovernance } from '@/hooks/useExhibitorGovernance';
import VerifiedBadge from '@/components/exhibitor/VerifiedBadge';
import ExhibitorGovernanceBanner from '@/components/exhibitor/ExhibitorGovernanceBanner';
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
  // AI enrichment
  ai_resume_court?: string;
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

// Nettoie les descriptions bilingues (FR + EN concaténés) en ne gardant que le français
const cleanBilingualDescription = (text: string): string => {
  // Détecte un bloc anglais après un double saut de ligne
  const parts = text.split(/\n\s*\n\s*\n/);
  if (parts.length >= 2) {
    // Vérifie si la 2e partie ressemble à de l'anglais
    const secondPart = parts.slice(1).join('\n').trim();
    const englishIndicators = /\b(is a|based in|the company|specializ|founded in|its range|the brand)\b/i;
    if (englishIndicators.test(secondPart)) {
      return parts[0].trim();
    }
  }
  return text;
};

// Récupère la description — priorité : AI resume_court > description_final > exposant_description
const getDescription = (exhibitor: Exhibitor): string | undefined => {
  const raw = exhibitor.ai_resume_court || exhibitor.description_final || exhibitor.exposant_description;
  return raw ? cleanBilingualDescription(raw) : undefined;
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
  const governance = useExhibitorGovernance(exhibitorId || undefined, exhibitorName);

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
  // Valider que urlexpo_event est une vraie URL (pas un identifiant composite)
  const rawExpoUrl = e?.urlexpo_event;
  const isValidUrl = rawExpoUrl && /^https?:\/\//.test(rawExpoUrl);
  const expoPageHref = isValidUrl ? normalizeExternalUrl(rawExpoUrl) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
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
            {(() => {
              const resolvedLogo = getExhibitorLogoUrl(e.logo_url, e.website_exposant);
              return resolvedLogo ? (
                <div className="h-12 w-12 rounded bg-white border flex items-center justify-center flex-shrink-0 p-1">
                  <img
                    src={resolvedLogo}
                    alt={displayName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="truncate">{displayName}</span>
                {governance.isVerified && <VerifiedBadge />}
              </div>
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

          {/* Gouvernance / Claim CTA */}
          <ExhibitorGovernanceBanner
            governance={governance}
            exhibitorId={exhibitorId}
            exhibitorName={displayName}
            exhibitorWebsite={getWebsite(e)}
            idExposant={e.id_exposant}
            isLegacyOnly={!e.exhibitor_uuid && !governance.resolvedExhibitorId}
          />

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
                  <Link
                    key={participation.id}
                    to={`/events/${participation.event.slug}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-start gap-3 rounded-lg border p-2 hover:border-primary/40 hover:shadow-sm transition-all group overflow-hidden"
                  >
                    {/* Event image */}
                    <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                      {participation.event.url_image ? (
                        <img
                          src={participation.event.url_image}
                          alt={participation.event.nom_event}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    {/* Event info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {participation.event.nom_event}
                      </p>
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {format(new Date(participation.event.date_debut), 'dd MMM yyyy', { locale: fr })}
                          {participation.event.date_fin !== participation.event.date_debut && (
                            <> – {format(new Date(participation.event.date_fin), 'dd MMM', { locale: fr })}</>
                          )}
                        </span>
                        {participation.event.ville && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {participation.event.ville}
                          </span>
                        )}
                      </div>
                      {participation.stand && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          Stand {normalizeStandNumber(participation.stand)}
                        </Badge>
                      )}
                    </div>
                  </Link>
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
