import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Event } from '@/types/event';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, Building2, MapPin, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { hydrateExhibitor } from '@/lib/hydrateExhibitor';
import { normalizeExternalUrl } from '@/lib/url';

interface Exhibitor {
  id_exposant: string;
  exhibitor_name: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
  urlexpo_event?: string;
}

interface Novelty {
  id: string;
  title: string;
  type: string;
  reason_1?: string;
  media_urls?: string[];
  doc_url?: string;
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
  const [novelties, setNovelties] = useState<Novelty[] | null>(null);
  const [loading, setLoading] = useState(false);
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
        if (!cancelled) setDetails(full as any);
      } else {
        setDetails(exhibitor);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [open, exhibitor]);

  useEffect(() => {
    const fetchNovelties = async () => {
      if (!open || !details) {
        setNovelties(null);
        return;
      }
      
      setLoading(true);
      try {
        // Récupérer l'exhibitor_id depuis la table exhibitors
        const { data: exhibitorData } = await supabase
          .from('exhibitors')
          .select('id')
          .ilike('name', details.exhibitor_name)
          .single();

        if (!exhibitorData) {
          setNovelties([]);
          return;
        }

        // Récupérer les nouveautés pour cet exposant et cet événement
        const { data, error } = await supabase
          .from('novelties')
          .select('id, title, type, reason_1, media_urls, doc_url')
          .eq('exhibitor_id', exhibitorData.id)
          .eq('event_id', event.id)
          .eq('status', 'Published');

        if (error) {
          console.warn('[ExhibitorDetailDialog] novelties error', error);
        }
        setNovelties(data ?? []);
      } catch (err) {
        console.error('[ExhibitorDetailDialog] fetch error', err);
        setNovelties([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNovelties();
  }, [open, details, event]);

  if (!exhibitor) return null;
  
  const e = details ?? exhibitor;
  const websiteHref = normalizeExternalUrl(e?.website_exposant);
  const expoPageHref = normalizeExternalUrl(e?.urlexpo_event);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          {onBackToAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToAll}
              className="w-fit -ml-2 mb-2"
            >
              ← Tous les exposants
            </Button>
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
                  Stand {e.stand_exposant}
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

          {/* Nouveautés */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">Nouveautés sur ce salon</h4>
            
            {loading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            )}

            {!loading && novelties && novelties.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Aucune nouveauté publiée pour le moment
              </div>
            )}

            {!loading && novelties && novelties.length > 0 && (
              <div className="space-y-3">
                {novelties.map((novelty) => (
                  <div key={novelty.id} className="rounded-lg border p-4 hover:bg-accent transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h5 className="font-medium flex-1">{novelty.title}</h5>
                      <Badge variant="outline">{novelty.type}</Badge>
                    </div>
                    {novelty.reason_1 && (
                      <p className="text-sm text-muted-foreground mb-3">{novelty.reason_1}</p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" asChild>
                        <a href={`/nouveautes?novelty=${novelty.id}`} target="_blank" rel="noopener noreferrer">
                          Voir la nouveauté
                        </a>
                      </Button>
                      {novelty.doc_url && (
                        <Button size="sm" variant="secondary" asChild>
                          <a href={novelty.doc_url} target="_blank" rel="noopener noreferrer">
                            Documentation
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
