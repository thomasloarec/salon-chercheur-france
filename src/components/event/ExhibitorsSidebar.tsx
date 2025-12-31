import React, { useState } from 'react';
import { Search, Building2, ExternalLink, Info, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  // Passer id_event pour supporter les événements staging
  const { data: previewData, isLoading, error } = useExhibitorsByEvent(
    event.slug || '', 
    debouncedSearch,
    MAX_PREVIEW,
    0,
    event.id_event // id_event pour les événements staging (Event_XX)
  );
  
  const preview = previewData?.exhibitors || [];
  const total = previewData?.total || 0;

  const handleOpenModal = async () => {
    setShowAllModal(true);
    setOpenedFromModal(false);
    if (allExhibitors === null) {
      // Fetch all exhibitors directly (no limit)
      try {
        // Utiliser id_event directement si disponible (pour staging et events)
        let eventIdText = event.id_event;
        
        if (!eventIdText && event.slug) {
          // Fallback: chercher par slug dans events
          const { data: eventData } = await supabase
            .from('events')
            .select('id_event')
            .eq('slug', event.slug)
            .single();
          
          eventIdText = eventData?.id_event;
        }

        if (eventIdText) {
          const { data: participations } = await supabase
            .from('participations_with_exhibitors')
            .select('*')
            .eq('id_event_text', eventIdText)
            .order('exhibitor_name', { ascending: true });

          // Récupérer les exhibitor_id depuis la table participation
          const participationIds = (participations || [])
            .map(p => p.id_participation)
            .filter(Boolean);

          let exhibitorUUIDs: Record<string, string> = {};
          let exhibitorLogos: Record<string, string> = {};
          let exhibitorDescriptions: Record<string, string> = {};
          let exhibitorWebsites: Record<string, string> = {};
          let legacyExposantData: Record<string, any> = {};

          if (participationIds.length > 0) {
            // Récupérer les exhibitor_id depuis participation
            const { data: participationDetails } = await supabase
              .from('participation')
              .select('id_participation, exhibitor_id, id_exposant')
              .in('id_participation', participationIds);

            if (participationDetails) {
              participationDetails.forEach(p => {
                if (p.exhibitor_id && p.id_participation) {
                  exhibitorUUIDs[p.id_participation] = p.exhibitor_id;
                }
              });

              // Récupérer les logos, descriptions et websites depuis exhibitors (modern)
              const uuids = Object.values(exhibitorUUIDs).filter(Boolean);
              if (uuids.length > 0) {
                const { data: exhibitors } = await supabase
                  .from('exhibitors')
                  .select('id, logo_url, description, website')
                  .in('id', uuids);

                if (exhibitors) {
                  exhibitors.forEach(e => {
                    if (e.logo_url) exhibitorLogos[e.id] = e.logo_url;
                    if (e.description) exhibitorDescriptions[e.id] = e.description;
                    if (e.website) exhibitorWebsites[e.id] = e.website;
                  });
                }
              }

              // Pour les participations sans exhibitor_id, récupérer depuis exposants (legacy)
              const legacyIds = participationDetails
                .filter(p => !p.exhibitor_id && p.id_exposant)
                .map(p => p.id_exposant);

              if (legacyIds.length > 0) {
                const { data: legacyExposants } = await supabase
                  .from('exposants')
                  .select('id_exposant, nom_exposant, website_exposant, exposant_description')
                  .in('id_exposant', legacyIds);

                if (legacyExposants) {
                  legacyExposants.forEach(ex => {
                    legacyExposantData[ex.id_exposant] = {
                      name: ex.nom_exposant,
                      website: ex.website_exposant,
                      description: ex.exposant_description
                    };
                  });
                }
              }
            }
          }

          const mapped = (participations || []).map(p => {
            const exhibitorUUID = p.id_participation ? exhibitorUUIDs[p.id_participation] : undefined;
            const logoUrl = exhibitorUUID ? exhibitorLogos[exhibitorUUID] : null;
            const description = exhibitorUUID ? exhibitorDescriptions[exhibitorUUID] : 
                               (p.id_exposant && legacyExposantData[p.id_exposant]?.description) || 
                               p.exposant_description;
            const website = exhibitorUUID ? exhibitorWebsites[exhibitorUUID] :
                           (p.id_exposant && legacyExposantData[p.id_exposant]?.website) ||
                           p.exhibitor_website || 
                           p.participation_website;
            
            // Priorité: name_final (vue) > exhibitor_name > legacy_name > nom_exposant (lookup) > id_exposant
            const exhibitorName = p.name_final || 
                                  p.exhibitor_name || 
                                  p.legacy_name ||
                                  (p.id_exposant && legacyExposantData[p.id_exposant]?.name) ||
                                  p.id_exposant || '';

            return {
              id: exhibitorUUID || p.id_exposant || String(p.exhibitor_uuid || ''),
              id_exposant: p.id_exposant,
              exhibitor_uuid: exhibitorUUID,
              name: exhibitorName,
              exhibitor_name: exhibitorName,
              slug: p.id_exposant || String(p.exhibitor_uuid || ''),
              logo_url: logoUrl,
              description: description,
              exposant_description: description,
              website: website,
              website_exposant: website,
              stand: p.stand_exposant || null,
              stand_exposant: p.stand_exposant || null,
              urlexpo_event: p.urlexpo_event,
              hall: null,
              plan: 'free' as const
            };
          }).filter(e => e.name)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));

          setAllExhibitors(mapped);
        }
      } catch (err) {
        console.error('[ExhibitorsSidebar] Error fetching all exhibitors', err);
        setAllExhibitors([]);
      }
    }
  };

  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-24 bg-white rounded-lg shadow-sm border p-6" aria-label="Liste des exposants">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            Exposants ({isLoading ? '...' : total})
          </h2>
        </div>

        {/* Info bulle */}
        <Collapsible open={infoOpen} onOpenChange={setInfoOpen} className="mt-3">
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="underline underline-offset-2">À propos de cette liste</span>
            <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${infoOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3 leading-relaxed">
            Cette liste est constituée à partir des informations publiques disponibles. 
            Elle peut être incomplète : certains exposants n'annoncent pas leur participation en ligne. 
            Pour une liste exhaustive, consultez le site officiel de l'événement.
          </CollapsibleContent>
        </Collapsible>

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
                    // ✅ CORRECTION : Utiliser les données déjà disponibles de l'edge function
                    const exhibitorForDialog = {
                      id_exposant: exhibitor.id_exposant || exhibitor.id,
                      exhibitor_uuid: exhibitor.exhibitor_uuid,
                      exhibitor_name: exhibitor.exhibitor_name || exhibitor.name,
                      stand_exposant: exhibitor.stand_exposant || exhibitor.stand,
                      website_exposant: exhibitor.website_exposant,  // ✅ Utiliser les données
                      exposant_description: exhibitor.exposant_description,  // ✅ Utiliser les données
                      urlexpo_event: exhibitor.urlexpo_event,
                      logo_url: exhibitor.logo_url || null,
                    };

                    console.log('🔍 ExhibitorsSidebar - Données avant hydratation:', {
                      name: exhibitorForDialog.exhibitor_name,
                      has_description: !!exhibitorForDialog.exposant_description,
                      has_website: !!exhibitorForDialog.website_exposant,
                      description_length: exhibitorForDialog.exposant_description?.length || 0
                    });

                    const full = await hydrateExhibitor(exhibitorForDialog);
                    
                    console.log('🔍 ExhibitorsSidebar - Données après hydratation:', {
                      name: full.exhibitor_name,
                      has_description: !!full.exposant_description,
                      has_website: !!full.website_exposant,
                      description_length: full.exposant_description?.length || 0
                    });

                    // Convertir au format du nouveau ExhibitorDialog
                    // Utiliser id_exposant pour le hook de participations
                    setSelectedExhibitor({
                      id: exhibitor.id_exposant || exhibitor.id,
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
                      {exhibitor.exhibitor_name || exhibitor.name}
                    </div>
                    {(exhibitor.stand_exposant || exhibitor.stand || exhibitor.hall) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[exhibitor.hall, exhibitor.stand_exposant || exhibitor.stand].filter(Boolean).join(' • ')}
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
      </aside>

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
          
          // Trouver l'exposant complet dans allExhibitors
          const fullEx = allExhibitors?.find(e => e.id === ex.id_exposant);
          
          const exhibitorForDialog = {
            id_exposant: ex.id_exposant,
            exhibitor_uuid: fullEx?.exhibitor_uuid,
            exhibitor_name: ex.exhibitor_name,
            stand_exposant: ex.stand_exposant,
            website_exposant: fullEx?.website_exposant,
            exposant_description: fullEx?.exposant_description,
            urlexpo_event: fullEx?.urlexpo_event,
            logo_url: fullEx?.logo_url || null,
          };
          
          const full = await hydrateExhibitor(exhibitorForDialog);
          
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