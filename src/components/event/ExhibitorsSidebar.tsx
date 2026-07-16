import React, { useState } from 'react';
import { Search, Building2, ExternalLink, Info, ChevronDown, Route } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDebounce } from '@/hooks/useDebounce';
import { useExhibitorsByEvent } from '@/hooks/useExhibitorsByEvent';
import { supabase } from '@/integrations/supabase/client';
import { ExhibitorsModal } from './ExhibitorsModal';
import { ExhibitorDetailDialog } from './ExhibitorDetailDialog';
import type { Event } from '@/types/event';
import { hydrateExhibitor } from '@/lib/hydrateExhibitor';
import { normalizeStandNumber } from '@/utils/standUtils';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { fetchExhibitorPublicSlugs, resolvePublicSlug } from '@/lib/exhibitorPublicSlug';
import ExhibitorFullProfileCTA from '@/components/exhibitor/ExhibitorFullProfileCTA';

interface ExhibitorsSidebarProps {
  event: Event;
  /** 'sidebar' (défaut) : sticky dans la colonne latérale. 'main' : pleine largeur dans le contenu principal (sans sticky). */
  variant?: 'sidebar' | 'main';
  /** Le parcours IA est-il disponible pour cet événement (≥ 80 exposants & à venir) ? */
  aiAvailable?: boolean;
  /** Ouvre le PrepareVisitWizard (même action que le bloc IA principal). */
  onPrepareVisit?: () => void;
}

const MAX_PREVIEW = 8;

export default function ExhibitorsSidebar({
  event,
  variant = 'sidebar',
  aiAvailable = false,
  onPrepareVisit,
}: ExhibitorsSidebarProps) {
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
          let exhibitorAiDescriptions: Record<string, string> = {};
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
                // Fetch exhibitor data + AI resume_court in parallel
                const [{ data: exhibitors }, { data: aiRows }] = await Promise.all([
                  supabase
                    .from('exhibitors')
                    .select('id, logo_url, description, website')
                    .in('id', uuids),
                  supabase
                    .from('exhibitor_ai')
                    .select('exhibitor_id, resume_court')
                    .in('exhibitor_id', uuids)
                    .not('resume_court', 'is', null),
                ]);

                if (aiRows) {
                  aiRows.forEach(ai => {
                    if (ai.resume_court) exhibitorAiDescriptions[ai.exhibitor_id] = ai.resume_court;
                  });
                }

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
                // Fetch legacy exhibitor data + AI descriptions in parallel
                const [{ data: legacyExposants }, { data: legacyAiRows }] = await Promise.all([
                  supabase
                    .from('exposants')
                    .select('id_exposant, nom_exposant, website_exposant, exposant_description')
                    .in('id_exposant', legacyIds),
                  supabase
                    .from('exhibitor_ai')
                    .select('exhibitor_id, resume_court')
                    .in('exhibitor_id', legacyIds)
                    .not('resume_court', 'is', null),
                ]);

                if (legacyAiRows) {
                  legacyAiRows.forEach(ai => {
                    if (ai.resume_court) exhibitorAiDescriptions[ai.exhibitor_id] = ai.resume_court;
                  });
                }

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

            // AI resume_court has highest priority — check both UUID and legacy id_exposant
            const lookupKey = exhibitorUUID || p.id_exposant;
            const aiDesc = lookupKey ? exhibitorAiDescriptions[lookupKey] : undefined;

            return {
              id: exhibitorUUID || p.id_exposant || String(p.exhibitor_uuid || ''),
              id_exposant: p.id_exposant,
              exhibitor_uuid: exhibitorUUID,
              name: exhibitorName,
              exhibitor_name: exhibitorName,
              slug: p.id_exposant || String(p.exhibitor_uuid || ''),
              logo_url: logoUrl,
              description: aiDesc || description,
              exposant_description: description,
              ai_resume_court: aiDesc,
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

          // Phase 4B — batch attach public slugs (single query, no N+1)
          const slugMaps = await fetchExhibitorPublicSlugs(
            mapped.map((e) => e.exhibitor_uuid || null),
            mapped.map((e) => e.id_exposant || null),
          );
          const mappedWithSlugs = mapped.map((e) => {
            const info = resolvePublicSlug(slugMaps, {
              exhibitorId: e.exhibitor_uuid,
              legacyId: e.id_exposant,
            });
            return {
              ...e,
              public_slug: info?.public_slug ?? null,
              seo_indexable: info?.seo_indexable ?? false,
              is_test: info?.is_test ?? false,
            };
          });

          setAllExhibitors(mappedWithSlugs);
        }
      } catch (err) {
        console.error('[ExhibitorsSidebar] Error fetching all exhibitors', err);
        setAllExhibitors([]);
      }
    }
  };

  // Phase 4B — open the detail popup, carrying the prefetched public slug fields.
  const openExhibitor = async (exhibitor: any, fromModal: boolean) => {
    const exhibitorForDialog = {
      id_exposant: exhibitor.id_exposant || exhibitor.id,
      exhibitor_uuid: exhibitor.exhibitor_uuid,
      exhibitor_name: exhibitor.exhibitor_name || exhibitor.name,
      stand_exposant: exhibitor.stand_exposant || exhibitor.stand,
      website_exposant: exhibitor.website_exposant,
      exposant_description: exhibitor.exposant_description,
      urlexpo_event: exhibitor.urlexpo_event,
      logo_url: exhibitor.logo_url || null,
    };

    const full = await hydrateExhibitor(exhibitorForDialog);

    setSelectedExhibitor({
      id_exposant: exhibitor.id_exposant || exhibitor.id,
      exhibitor_uuid: exhibitor.exhibitor_uuid,
      exhibitor_name: full.exhibitor_name,
      name_final: full.exhibitor_name,
      stand_exposant: exhibitor.stand_exposant || exhibitor.stand,
      website_exposant: full.website_exposant,
      website_final: full.website_exposant,
      exposant_description: full.exposant_description,
      description_final: full.exposant_description,
      ai_resume_court: full.ai_resume_court || exhibitor.ai_resume_court,
      urlexpo_event: full.urlexpo_event,
      logo_url: full.logo_url || null,
      // Phase 4B — public identity (prefetched, no extra query here)
      public_slug: exhibitor.public_slug ?? null,
      seo_indexable: exhibitor.seo_indexable ?? false,
      is_test: exhibitor.is_test ?? false,
    });
    setOpenedFromModal(fromModal);
  };

  const [infoOpen, setInfoOpen] = useState(false);

  const isGrid = variant === 'main';

  // Carte exposant compacte — réutilisée en liste (sidebar) et en grid (main)
  const renderExhibitorCard = (exhibitor: any) => {
    const standLabel = (exhibitor.stand_exposant || exhibitor.stand)
      ? `Stand ${normalizeStandNumber(exhibitor.stand_exposant || exhibitor.stand)}`
      : null;
    const standText = [exhibitor.hall, standLabel].filter(Boolean).join(' • ');
    const resolvedLogo = getExhibitorLogoUrl(
      exhibitor.logo_url,
      exhibitor.website || exhibitor.website_exposant,
    );

    return (
      <div
        key={exhibitor.id}
        className={
          isGrid
            ? 'flex flex-col rounded-lg border bg-white hover:border-primary/40 hover:shadow-sm transition-all'
            : 'rounded-lg hover:bg-muted transition-colors'
        }
      >
        <button
          onClick={() => openExhibitor(exhibitor, false)}
          className="w-full flex items-center gap-3 p-3 text-left"
        >
          <div
            className={
              isGrid
                ? 'w-10 h-10 bg-muted rounded flex-shrink-0 flex items-center justify-center p-1'
                : 'w-6 h-6 bg-border rounded flex-shrink-0 flex items-center justify-center'
            }
          >
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={`${exhibitor.name} logo`}
                className="w-full h-full object-contain rounded"
              />
            ) : (
              <Building2 className={isGrid ? 'w-5 h-5 text-muted-foreground' : 'w-4 h-4 text-muted-foreground'} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">
              {exhibitor.exhibitor_name || exhibitor.name}
            </div>
            {standText && (
              <p className="text-xs text-muted-foreground truncate">{standText}</p>
            )}
          </div>

          {!isGrid && <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        </button>
        {/* Phase 4B — discreet crawlable link to the full public profile */}
        {exhibitor.public_slug && !exhibitor.is_test && (
          <div className="px-3 pb-2 -mt-1 mt-auto">
            <ExhibitorFullProfileCTA
              publicSlug={exhibitor.public_slug}
              seoIndexable={exhibitor.seo_indexable}
              isTest={exhibitor.is_test}
              openInNewTab
              variant="link"
              surface="event_exhibitor_list"
              eventSlug={event.slug}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <aside
        className={`bg-white rounded-lg shadow-sm border p-6 ${variant === 'sidebar' ? 'sticky top-24' : ''}`}
        aria-label="Liste des exposants"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            {isLoading ? 'Exposants (...)' : total > 0 ? `Exposants (${total})` : 'Exposants'}
          </h2>
        </div>

        {/* Message si aucun exposant disponible */}
        {!isLoading && total === 0 && !debouncedSearch && (
          <div className="mt-4 text-sm text-muted-foreground bg-muted/50 rounded-md p-4 leading-relaxed">
            <p className="font-medium text-foreground mb-1">Liste des exposants non disponible pour le moment.</p>
            <p>
              Consultez le{' '}
              {event.url_site_officiel ? (
                <a 
                  href={event.url_site_officiel} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  site officiel
                </a>
              ) : (
                <span>site officiel</span>
              )}{' '}
              de l'événement pour plus d'informations.
            </p>
          </div>
        )}

        {/* Info bulle - affichée seulement s'il y a des exposants */}
        {total > 0 && (
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
        )}

        {/* Search - affiché seulement s'il y a des exposants */}
        {total > 0 && (
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un exposant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Content */}
        <div
          className={
            isGrid
              ? 'mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
              : 'mt-4 space-y-2'
          }
        >
          {isLoading ? (
            Array.from({ length: isGrid ? 6 : 3 }).map((_, i) => (
              <div key={i} className={isGrid ? 'flex items-center gap-3 p-3 rounded-lg border' : 'flex items-center gap-3 p-3'}>
                <Skeleton className="w-6 h-6 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))
          ) : error ? (
            <div className="text-center py-4 col-span-full">
              <p className="text-sm text-danger">Erreur lors du chargement</p>
            </div>
          ) : preview.length === 0 && debouncedSearch ? (
            <div className="text-center py-4 col-span-full">
              <p className="text-sm text-muted-foreground">Aucun exposant trouvé</p>
            </div>
          ) : preview.length > 0 ? (
            preview.map((exhibitor) => renderExhibitorCard(exhibitor))
          ) : null}
        </div>

        {/* Footer CTA */}
        {total > MAX_PREVIEW && (
          <div className="mt-6 pt-4 border-t">
            <Button 
              variant={isGrid ? 'default' : 'outline'}
              size="sm" 
              className="w-full"
              onClick={handleOpenModal}
            >
              Voir tous les exposants ({total})
            </Button>
          </div>
        )}

        {/* Zone de transition vers le parcours IA — uniquement en colonne principale,
            si des exposants existent et que le parcours IA est disponible. */}
        {isGrid && total > 0 && aiAvailable && onPrepareVisit && (
          <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">
              <span className="font-medium text-foreground">{total} exposants référencés</span> sur ce salon.
              L'IA Lotexpo peut vous aider à identifier ceux à voir en priorité.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onPrepareVisit}
              className="gap-1.5 whitespace-nowrap shrink-0"
            >
              <Route className="w-3.5 h-3.5" />
              Créer un parcours IA
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
          website_exposant: ex.website_exposant || ex.website,
          logo_url: ex.logo_url,
        })) || []}
        loading={allExhibitors === null}
        onSelect={async (ex) => {
          setShowAllModal(false);
          // Find the full exhibitor (carries prefetched public slug fields)
          const fullEx = allExhibitors?.find(e => e.id === ex.id_exposant);
          await openExhibitor(fullEx ?? { ...ex, id: ex.id_exposant }, true);
        }}
      />

      {/* Fiche exposant */}
      <ExhibitorDetailDialog
        open={!!selectedExhibitor}
        onOpenChange={(open) => !open && setSelectedExhibitor(null)}
        exhibitor={selectedExhibitor}
        event={event}
        onBackToAll={openedFromModal ? () => {
          setSelectedExhibitor(null);
          setShowAllModal(true);
        } : undefined}
      />
    </>
  );
}