import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExhibitorsModal } from './ExhibitorsModal';
import { ExhibitorDetailDialog } from './ExhibitorDetailDialog';
import type { Event } from '@/types/event';

interface Exhibitor {
  id_exposant: string;
  exhibitor_name: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
  urlexpo_event?: string;
}

interface EventExhibitorsSectionProps {
  event: Event;
}

const MAX_SIDEBAR_EXHIBITORS = 7;

export const EventExhibitorsSection: React.FC<EventExhibitorsSectionProps> = ({ event }) => {
  const [exhibitorsPreview, setExhibitorsPreview] = useState<Exhibitor[]>([]);
  const [totalExhibitors, setTotalExhibitors] = useState<number>(0);
  const [exhibitorsAll, setExhibitorsAll] = useState<Exhibitor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllModal, setShowAllModal] = useState(false);
  const [selectedExhibitor, setSelectedExhibitor] = useState<Exhibitor | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true);
      try {
        const eventIdText = event.id_event;
        
        console.log('🔍 EventExhibitorsSection - Fetching preview for', eventIdText);
        
        // Requête preview: 7 premiers + count total
        const { data: previewData, count, error } = await supabase
          .from('participations_with_exhibitors')
          .select('*', { count: 'exact' })
          .eq('id_event_text', eventIdText)
          .order('exhibitor_name', { ascending: true })
          .range(0, 6); // 7 items (0-6)

        if (error) {
          console.warn('[EventExhibitorsSection] Preview query error', error, { eventIdText });
        }

        let finalPreview = previewData ?? [];
        let finalCount = count ?? 0;

        // Fallback vers id_event (UUID) si aucun résultat
        if (finalPreview.length === 0 && event.id) {
          console.log('🔄 Fallback to UUID for event', event.slug);
          const { data: fallbackData, count: fallbackCount } = await supabase
            .from('participations_with_exhibitors')
            .select('*', { count: 'exact' })
            .eq('id_event', event.id)
            .order('exhibitor_name', { ascending: true })
            .range(0, 6);

          finalPreview = fallbackData ?? [];
          finalCount = fallbackCount ?? 0;
          
          if (fallbackData && fallbackData.length > 0) {
            console.warn('[ADMIN] Fallback to UUID worked for event', event.slug, 'but id_event_text should be preferred');
          }
        }

        console.log('✅ Loaded preview:', finalPreview.length, 'of', finalCount, 'exhibitors');
        setExhibitorsPreview(finalPreview);
        setTotalExhibitors(finalCount);
      } catch (err) {
        console.error('[EventExhibitorsSection] Fetch error', err);
        setExhibitorsPreview([]);
        setTotalExhibitors(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [event.id_event, event.id, event.slug]);

  const fetchAllExhibitors = async () => {
    if (exhibitorsAll !== null) return; // Already loaded
    
    try {
      const eventIdText = event.id_event;
      console.log('🔍 Fetching all exhibitors for', eventIdText);
      
      const { data: allData, error } = await supabase
        .from('participations_with_exhibitors')
        .select('*')
        .eq('id_event_text', eventIdText)
        .order('exhibitor_name', { ascending: true });

      if (error) {
        console.warn('[EventExhibitorsSection] Full list query error', error);
      }

      let finalAll = allData ?? [];

      // Fallback to UUID if needed
      if (finalAll.length === 0 && event.id) {
        const { data: fallbackData } = await supabase
          .from('participations_with_exhibitors')
          .select('*')
          .eq('id_event', event.id)
          .order('exhibitor_name', { ascending: true });
        finalAll = fallbackData ?? [];
      }

      console.log('✅ Loaded all exhibitors:', finalAll.length);
      setExhibitorsAll(finalAll);
    } catch (err) {
      console.error('[EventExhibitorsSection] Full list fetch error', err);
      setExhibitorsAll([]);
    }
  };

  const handleOpenModal = () => {
    setShowAllModal(true);
    fetchAllExhibitors();
  };

  const hasMore = totalExhibitors > MAX_SIDEBAR_EXHIBITORS;

  return (
    <>
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              Exposants ({totalExhibitors})
            </h2>
            {hasMore && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenModal}
              >
                Voir tous les exposants
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : exhibitorsPreview.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucun exposant inscrit pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exhibitorsPreview.slice(0, 7).map((exhibitor) => (
                <button
                  key={exhibitor.id_exposant}
                  className="w-full text-left rounded-lg border p-3 hover:bg-accent transition-colors"
                  onClick={() => setSelectedExhibitor(exhibitor)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{exhibitor.exhibitor_name}</div>
                      {exhibitor.stand_exposant && (
                        <div className="text-xs text-muted-foreground">
                          Stand {exhibitor.stand_exposant}
                        </div>
                      )}
                    </div>
                    {exhibitor.website_exposant && (
                      <a
                        href={exhibitor.website_exposant}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex-shrink-0 opacity-70 hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Site exposant"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modale liste complète */}
      <ExhibitorsModal
        open={showAllModal}
        onOpenChange={setShowAllModal}
        exhibitors={exhibitorsAll ?? []}
        loading={exhibitorsAll === null}
        onSelect={(ex) => {
          setShowAllModal(false);
          setSelectedExhibitor(ex);
        }}
      />

      {/* Fiche exposant */}
      <ExhibitorDetailDialog
        open={!!selectedExhibitor}
        onOpenChange={(open) => !open && setSelectedExhibitor(null)}
        exhibitor={selectedExhibitor}
        event={event}
      />
    </>
  );
};

export default EventExhibitorsSection;
