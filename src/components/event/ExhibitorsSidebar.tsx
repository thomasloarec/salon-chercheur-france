import React, { useState } from 'react';
import { Search, Building2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useExhibitorsByEvent } from '@/hooks/useExhibitorsByEvent';
import { supabase } from '@/integrations/supabase/client';
import { ExhibitorsModal } from './ExhibitorsModal';
import { ExhibitorDialog } from './ExhibitorDialog';
import type { Event } from '@/types/event';
import { hydrateExhibitor } from '@/lib/hydrateExhibitor';

interface ExhibitorsSidebarProps {
  event: Event;
}

const MAX_PREVIEW = 7;

export default function ExhibitorsSidebar({ event }: ExhibitorsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showAllModal, setShowAllModal] = useState(false);
  const [allExhibitors, setAllExhibitors] = useState<any[] | null>(null);
  const [selectedExhibitor, setSelectedExhibitor] = useState<any | null>(null);
  const [openedFromModal, setOpenedFromModal] = useState(false);
  
  // Preview: load only 7 items
  const { data: previewData, isLoading, error } = useExhibitorsByEvent(
    event.slug || '', 
    debouncedSearch,
    MAX_PREVIEW,
    0
  );
  
  const preview = previewData?.exhibitors || [];
  const total = previewData?.total || 0;

  const handleOpenModal = async () => {
    setShowAllModal(true);
    setOpenedFromModal(false);
    if (allExhibitors === null) {
      // Fetch all exhibitors directly (no limit)
      try {
        const { data: eventData } = await supabase
          .from('events')
          .select('id_event')
          .eq('slug', event.slug || '')
          .single();

        if (eventData?.id_event) {
          const { data: participations } = await supabase
            .from('participations_with_exhibitors')
            .select('*')
            .eq('id_event_text', eventData.id_event)
            .order('exhibitor_name', { ascending: true });

          const mapped = (participations || []).map(p => ({
            id: p.id_exposant || String(p.exhibitor_uuid || ''),
            name: p.exhibitor_name || p.id_exposant || '',
            slug: p.id_exposant || String(p.exhibitor_uuid || ''),
            logo_url: null,
            stand: p.stand_exposant || null,
            hall: null,
            plan: 'free' as const
          })).filter(e => e.name);

          setAllExhibitors(mapped);
        }
      } catch (err) {
        console.error('[ExhibitorsSidebar] Error fetching all exhibitors', err);
        setAllExhibitors([]);
      }
    }
  };

  return (
    <>
      <div className="sticky top-24 bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            Exposants ({isLoading ? '...' : total})
          </h3>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un exposant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        <div className="mt-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-6 h-6 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-600">Erreur lors du chargement</p>
            </div>
          ) : preview.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                {debouncedSearch ? 'Aucun exposant trouvé' : 'Aucun exposant inscrit'}
              </p>
            </div>
          ) : (
            preview.map((exhibitor) => {
              return (
                <button
                  key={exhibitor.id}
                  onClick={async () => {
                    const exhibitorForDialog = {
                      id_exposant: exhibitor.id,
                      exhibitor_name: exhibitor.name,
                      stand_exposant: exhibitor.stand || undefined,
                      website_exposant: undefined,
                      exposant_description: undefined,
                      urlexpo_event: undefined,
                      logo_url: exhibitor.logo_url || null,
                    };

                    const full = await hydrateExhibitor(exhibitorForDialog);
                    // Convertir au format du nouveau ExhibitorDialog
                    setSelectedExhibitor({
                      id: exhibitor.id,
                      name: full.exhibitor_name,
                      slug: exhibitor.slug,
                      logo_url: full.logo_url || null,
                      description: full.exposant_description,
                      website: full.website_exposant,
                    });
                    setOpenedFromModal(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center">
                    {exhibitor.logo_url ? (
                      <img 
                        src={exhibitor.logo_url} 
                        alt={`${exhibitor.name} logo`}
                        className="w-full h-full object-contain rounded"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {exhibitor.name}
                    </div>
                    {(exhibitor.stand || exhibitor.hall) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[exhibitor.hall, exhibitor.stand].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                  
                  <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer CTA */}
        {total > MAX_PREVIEW && (
          <div className="mt-6 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleOpenModal}
            >
              Voir tous les exposants ({total})
            </Button>
          </div>
        )}
      </div>

      {/* Modale liste complète */}
      <ExhibitorsModal
        open={showAllModal}
        onOpenChange={setShowAllModal}
        exhibitors={allExhibitors?.map(ex => ({
          id_exposant: ex.id,
          exhibitor_name: ex.name,
          stand_exposant: ex.stand,
          website_exposant: undefined,
        })) || []}
        loading={allExhibitors === null}
        onSelect={async (ex) => {
          setShowAllModal(false);
          const full = await hydrateExhibitor(ex);
          // Convertir au format du nouveau ExhibitorDialog
          setSelectedExhibitor({
            id: ex.id_exposant,
            name: full.exhibitor_name,
            slug: ex.id_exposant,
            logo_url: full.logo_url || null,
            description: full.exposant_description,
            website: full.website_exposant,
          });
          setOpenedFromModal(true);
        }}
      />

      {/* Fiche exposant */}
      <ExhibitorDialog
        open={!!selectedExhibitor}
        onOpenChange={(open) => !open && setSelectedExhibitor(null)}
        exhibitor={selectedExhibitor}
        onBackToAll={openedFromModal ? () => {
          setSelectedExhibitor(null);
          setShowAllModal(true);
        } : undefined}
      />
    </>
  );
}