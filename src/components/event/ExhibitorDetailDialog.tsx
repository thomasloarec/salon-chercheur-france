import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Event } from '@/types/event';
import { ExternalLink, Building2, MapPin, Globe } from 'lucide-react';
import { hydrateExhibitor } from '@/lib/hydrateExhibitor';
import { normalizeExternalUrl } from '@/lib/url';
import { normalizeStandNumber } from '@/utils/standUtils';
interface Exhibitor {
  id_exposant: string;
  exhibitor_name: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
  urlexpo_event?: string;
  logo_url?: string;
}

interface ExhibitorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitor: Exhibitor | null;
  event: Event;
  onBackToAll?: () => void;
}

export const ExhibitorDetailDialog: React.FC<ExhibitorDetailDialogProps> = ({ 
  open, 
  onOpenChange, 
  exhibitor, 
  event,
  onBackToAll
}) => {
  const [details, setDetails] = useState<Exhibitor | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!open || !exhibitor) {
        setDetails(null);
        return;
      }
      // Hydrater si les champs website/description manquent
      if (!exhibitor.website_exposant || !exhibitor.exposant_description) {
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
  const websiteHref = normalizeExternalUrl(e?.website_exposant);
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
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate">{e.exhibitor_name}</div>
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
          {e.exposant_description && (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {e.exposant_description}
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

        </div>
      </DialogContent>
    </Dialog>
  );
};
