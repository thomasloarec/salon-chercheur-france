
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useInvalidateEvents } from '@/hooks/useEvents';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EventPageHeader } from '@/components/event/EventPageHeader';
import { RelatedEvents } from '@/components/event/RelatedEvents';
import NoveltiesSection from '@/components/event/NoveltiesSection';
import { EventSeriesBlock } from '@/components/event/EventSeriesBlock';
import { SameCityEventsBlock } from '@/components/event/SameCityEventsBlock';
import { SectorArticlesBlock } from '@/components/event/SectorArticlesBlock';
import { EventStatsStrip } from '@/components/event/EventStatsStrip';
import EventAiBanner from '@/components/event/EventAiBanner';
import EventInfoBlocks from '@/components/event/EventInfoBlocks';
import EventBand from '@/components/event/EventBand';
import EventProgramSection from '@/components/event/EventProgramSection';
import { Reveal } from '@/components/ui/reveal';

import EventExhibitorsSection from '@/components/event/EventExhibitorsSection';
import ClaimSalonBanner from '@/components/event/ClaimSalonBanner';
import EventRadarCrmWidget from '@/components/event/EventRadarCrmWidget';
import { SEOHead } from '@/components/event/SEOHead';
import { EventAdminMenu } from '@/components/event/EventAdminMenu';
import PrepareVisitWizard from '@/components/event/PrepareVisitWizard';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Eye, Settings } from 'lucide-react';
import { useExhibitorsByEvent } from '@/hooks/useExhibitorsByEvent';
import { useEventCardStats } from '@/hooks/useEventCardStats';
import { useEventProgramCount } from '@/hooks/useEventProgram';
import { getEventCapabilities, PARCOURS_IA_MIN_EXHIBITORS } from '@/lib/eventCapabilities';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Event } from '@/types/event';

interface EventPageContentProps {
  event: Event;
  isPreview?: boolean;
  onEventUpdated?: (event: Event, slugChanged?: boolean) => void;
  onEventDeleted?: () => void;
}

export const EventPageContent: React.FC<EventPageContentProps> = ({
  event,
  isPreview = false,
  onEventUpdated,
  onEventDeleted
}) => {
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [participationsCount, setParticipationsCount] = useState<number>(0);
  const [prepareVisitOpen, setPrepareVisitOpen] = useState(false);
  const [seriesEventIds, setSeriesEventIds] = useState<string[]>([]);

  const isOwner = !!user && !!event.owner_user_id && event.owner_user_id === user.id;

  const handleSeriesIds = useCallback((ids: string[]) => {
    setSeriesEventIds(ids);
  }, []);

  // Compteurs unifiés via la RPC publique get_event_card_stats.
  const { data: cardStats, isLoading: cardStatsLoading } = useEventCardStats([event.id]);
  const stats = cardStats?.[event.id];

  // Repli admin / ?preview=1 : la RPC filtre sur visible = true, un événement
  // caché y renvoie zéro ligne. Dans ce seul cas, on retombe sur l'ancien comptage.
  const needsFallbackCount =
    (isAdmin || isPreview) && !cardStatsLoading && !stats;

  const { data: exhibitorsFallback } = useExhibitorsByEvent(
    needsFallbackCount ? event.slug || '' : '',
    undefined,
    1,
    0,
    needsFallbackCount ? event.id_event : undefined
  );

  const { data: noveltyFallback } = useQuery({
    queryKey: ['novelty-count', event.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('novelties')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .in('status', ['published', 'approved']);
      return count ?? 0;
    },
    enabled: !!event.id && needsFallbackCount,
  });

  const exhibitorCount = stats?.exhibitor_count ?? exhibitorsFallback?.total ?? 0;
  const noveltyCount = stats?.novelty_count ?? noveltyFallback ?? 0;
  // Lot 4 : le compteur de sessions pilote l'affichage de la section Programme
  // (règle showProgramSection dans eventCapabilities).
  const { data: programSessionCount } = useEventProgramCount(event.id);

  const capabilities = useMemo(
    () => getEventCapabilities(event, exhibitorCount, programSessionCount ?? 0),
    [event, exhibitorCount, programSessionCount],
  );
  const isEventPast = capabilities.isPast;
  const canPrepareVisit = capabilities.canPrepareVisit;

  // Auto-open wizard from ?prepare=1 query param (e.g. from agenda page)
  useEffect(() => {
    if (searchParams.get('prepare') === '1' && exhibitorCount >= PARCOURS_IA_MIN_EXHIBITORS) {
      setPrepareVisitOpen(true);
    }
  }, [searchParams, exhibitorCount]);

  const sectorLink = useMemo(() => {
    const secteur = event.secteur;
    if (!secteur) return '/events';
    const first = Array.isArray(secteur) ? secteur[0] : secteur;
    if (!first) return '/events';
    return `/events?sectors=${encodeURIComponent(first)}`;
  }, [event.secteur]);

  const invalidateEvents = useInvalidateEvents();
  const queryClient = useQueryClient();


  // Mini debug pour admin : compter les participations
  useEffect(() => {
    if (isAdmin && event.id_event) {
      const fetchParticipationsCount = async () => {
        try {
          const { count, error } = await supabase
            .from('participation')
            .select('*', { count: 'exact', head: true })
            .eq('id_event_text', event.id_event);
          
          if (!error && count !== null) {
            setParticipationsCount(count);
          }
        } catch (error) {
          console.error('Error fetching participations count:', error);
        }
      };
      
      fetchParticipationsCount();
    }
  }, [isAdmin, event.id_event]);

  const handleEventUpdated = (refreshedEvent: Event, slugChanged?: boolean) => {
    if (onEventUpdated) {
      onEventUpdated(refreshedEvent, slugChanged);
    }
    invalidateEvents();
    queryClient.invalidateQueries({ queryKey: ['event-sectors', refreshedEvent.id_event] });
  };

  const handleEventDeleted = () => {
    if (onEventDeleted) {
      onEventDeleted();
    }
    invalidateEvents();
  };

  return (
    <>
      <SEOHead event={event} noIndex={isPreview} />
      <div className="min-h-screen bg-background">
        <Header />
        
        {/* Admin toolbar - shown if user is admin */}
        {isAdmin && (
          <div className="bg-muted border-l-4 border-border p-4 rounded-none">
            <div className="container mx-auto px-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  <strong>Admin:</strong> Outils d'administration pour cet événement
                  {participationsCount > 0 && (
                    <span className="ml-4 text-xs bg-muted px-2 py-1 rounded">
                      Participations en DB : {participationsCount}
                    </span>
                  )}
                </p>
                {/* Enrichment status */}
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${event.meta_description_gen ? 'bg-info/10 text-info' : 'bg-border text-muted-foreground'}`}>
                    Meta: {event.meta_description_gen ? '✓' : '—'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${Array.isArray(event.faq_json) && event.faq_json.length > 0 ? 'bg-info/10 text-info' : 'bg-border text-muted-foreground'}`}>
                    FAQ: {Array.isArray(event.faq_json) && event.faq_json.length > 0 ? `✓ (${event.faq_json.length})` : '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-border text-muted-foreground">
                    Score: {event.enrichissement_score ?? '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-border text-muted-foreground">
                    Statut: {event.enrichissement_statut || '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-border text-muted-foreground">
                    Enrichi: {event.enrichissement_date ? new Date(event.enrichissement_date).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/events/${event.id}`)}
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Éditer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/publier-nouveaute/atelier?event=${event.id}`)}
                  className="text-muted-foreground hover:bg-muted"
                >
                  Essayer le nouvel atelier (beta)
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <main>
          {/* ═══ Bande 1 — Hero, texture claire (page Recherche IA) ═══
              Contient : notice aperçu, actions admin/propriétaire, Hero,
              bande de revendication en continuité. */}
          <EventBand tone="light-texture" space="sm" className="pt-6 md:pt-8 pb-2 md:pb-3 lg:pb-4">
            {/* Preview notice */}
            {isPreview && (
              <div className="mb-6 rounded-lg border-l-4 border-primary bg-primary/10 p-4">
                <p className="text-sm text-foreground/80">
                  <strong>Mode aperçu:</strong> Cet événement n'est pas encore publié et n'est visible que par les administrateurs.
                </p>
              </div>
            )}

            {(isOwner || isAdmin) && (
              <div className="mb-4 flex items-center justify-end gap-2">
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/events/${event.slug || event.id}/gerer`)}
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Gérer mon salon
                  </Button>
                )}
                <EventAdminMenu
                  event={event}
                  isAdmin={isAdmin}
                  onEventUpdated={handleEventUpdated}
                  onEventDeleted={handleEventDeleted}
                />
              </div>
            )}

            <EventPageHeader
              event={event}
              canPrepareVisit={canPrepareVisit}
              onPrepareVisit={() => setPrepareVisitOpen(true)}
            />

            {/* Bandeau discret : revendication de la page salon par l'organisateur */}
            <div className="mt-2">
              <ClaimSalonBanner event={event} />
            </div>


          </EventBand>

          {/* ═══ Bande 2 — blanc : frise statistiques + nouveautés ═══ */}
          <EventBand
            tone="white"
            space="sm"
            className={cn(
              'pt-2 md:pt-3 lg:pt-4',
              // Sans section Nouveautés, la bande ne contient que la frise
              // (+ l'éventuel bandeau événement passé) : on renforce le
              // padding bas pour éviter un rendu tronqué, sauf si la section
              // Programme suit immédiatement (même fond blanc : l'espace
              // paraît alors excessif).
              !capabilities.showNoveltiesSection && (
                capabilities.showProgramSection && !capabilities.showExhibitorSection
                  ? 'pb-4 md:pb-6 lg:pb-8'
                  : 'pb-10 md:pb-12 lg:pb-14'
              ),
            )}
          >
            <Reveal>
              {/* Frise statistiques — présente aussi sur les événements passés */}
              <EventStatsStrip
                event={event}
                exhibitorCount={exhibitorCount}
                noveltyCount={noveltyCount}
              />
            </Reveal>

            {/* Past event banner */}
            {isEventPast && (
              <div className="mt-6 rounded-r-lg border-l-4 border-primary bg-primary/10 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">

                <p className="text-sm text-foreground/80">
                  Cet événement est terminé. Retrouvez les prochains salons de ce secteur sur Lotexpo.
                </p>
                <Link
                  to={sectorLink}
                  className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
                >
                  Voir les prochains événements →
                </Link>
              </div>
            )}

            {/* Nouveautés en pleine largeur — masquées si l'événement
                n'accueille pas d'exposants (has_exhibitors = false). */}
            {capabilities.showNoveltiesSection && (
              <Reveal>
                <section id="nouveautes" className="mt-8 min-w-0 md:mt-8 lg:mt-10">
                  <NoveltiesSection event={event} exhibitorCount={exhibitorCount} isEventPast={isEventPast} />
                </section>
              </Reveal>
            )}


          </EventBand>

          {/* ═══ Bande 2b — gris très clair : exposants + Radar CRM ═══ */}
          {capabilities.showExhibitorSection && (
            <EventBand tone="soft" space="md">
              <Reveal>
                <div
                  className={
                    capabilities.showRadarCrm
                      ? 'grid items-start gap-6 lg:[grid-template-columns:minmax(0,7fr)_minmax(280px,3fr)]'
                      : 'grid gap-6'
                  }
                >
                  {capabilities.showRadarCrm && (
                    <aside className="order-first min-w-0 lg:order-last lg:sticky lg:top-24 lg:self-start">
                      <EventRadarCrmWidget event={event} isEventPast={isEventPast} />
                    </aside>
                  )}

                  <section id="exposants" className="min-w-0">
                    <EventExhibitorsSection
                      event={event}
                      exhibitorCount={exhibitorCount}
                      aiAvailable={canPrepareVisit}
                      onPrepareVisit={() => setPrepareVisitOpen(true)}
                    />
                  </section>
                </div>
              </Reveal>
            </EventBand>
          )}

          {/* ═══ Bande 2c — blanc : programme de l'événement (lot 4) ═══ */}
          {capabilities.showProgramSection && (
            <EventBand
              tone="white"
              space="md"
              className={cn(
                // Si la section Programme suit directement la frise de stats
                // (sans section Exposants entre les deux), les deux bandes sont
                // blanches : on réduit le padding haut pour éviter un trou.
                !capabilities.showExhibitorSection && 'pt-4 md:pt-6 lg:pt-8',
              )}
            >
              <section id="programme" className="min-w-0">
                <Reveal>
                  <EventProgramSection event={event} />
                </Reveal>
              </section>
            </EventBand>
          )}

          {/* ═══ Bande 3 — texture sombre : bandeau Parcours IA.
              Rendue uniquement quand le bandeau l'est : jamais de bande vide. */}
          {canPrepareVisit && (
            <EventBand tone="dark-photo" space="md">
              <EventAiBanner
                canPrepareVisit={canPrepareVisit}
                onPrepareVisit={() => setPrepareVisitOpen(true)}
              />
            </EventBand>
          )}

          {/* ═══ Bande 4 — gris très clair : carousel d'informations ═══ */}
          <EventBand tone="soft" space="md">
            <Reveal>
              <EventInfoBlocks event={event} />
            </Reveal>
          </EventBand>

          {/* ═══ Bande 5 — blanc : blocs bas de page ═══ */}
          <EventBand
            tone="white"
            space="none"
            className="pb-8 pt-6 md:pb-10 md:pt-8 lg:pb-14 lg:pt-8"
            innerClassName="flex flex-col gap-8 md:gap-10 lg:gap-12 [&>*]:min-w-0"
          >
            {/* Autres éditions de ce salon (séries) */}
            <Reveal>
              <EventSeriesBlock event={event} onSeriesIds={handleSeriesIds} />
            </Reveal>

            {/* Salons dans la même ville */}
            <Reveal>
              <SameCityEventsBlock event={event} />
            </Reveal>

            {/* Événements similaires pour le maillage interne SEO */}
            <Reveal>
              <RelatedEvents event={event} limit={4} excludeIds={seriesEventIds} />
            </Reveal>

            {/* Articles de blog liés au secteur */}
            <Reveal>
              <SectorArticlesBlock event={event} />
            </Reveal>
          </EventBand>

          {/* ═══ Bande 6 — blanc : disclaimer ═══ */}
          <EventBand tone="white" space="sm">
            <aside className="border-t border-border pt-6">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/80">À propos de cette fiche. </span>
                Lotexpo est une plateforme indépendante. Cette fiche est établie à partir d'informations publiques. Sa présence n'implique ni affiliation, ni partenariat officiel, ni mandat de l'organisateur, sauf mention contraire sur cette page. Les marques citées appartiennent à leurs titulaires et sont utilisées à seule fin d'identifier l'événement. Les informations officielles restent celles publiées par l'organisateur. Demande de correction ou de retrait : contact@lotexpo.com.{' '}
                <Link to="/organisateurs" className="text-primary hover:underline">
                  Organisateurs de salons
                </Link>
              </p>
            </aside>
          </EventBand>
        </main>

        <Footer />
      </div>

      {/* Prepare Visit Wizard */}
      <PrepareVisitWizard
        open={prepareVisitOpen}
        onOpenChange={setPrepareVisitOpen}
        event={event}
        exhibitorCount={exhibitorCount}
      />

    </>
  );
};
