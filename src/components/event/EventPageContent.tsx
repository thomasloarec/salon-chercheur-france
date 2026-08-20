
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
import EventInfoCarousel from '@/components/event/EventInfoCarousel';

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
import { getEventCapabilities, PARCOURS_IA_MIN_EXHIBITORS } from '@/lib/eventCapabilities';
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

  const capabilities = useMemo(
    () => getEventCapabilities(event, exhibitorCount),
    [event, exhibitorCount],
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
      <div className="min-h-screen bg-muted/30">
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
        
        <main className="py-8">
          <div className="container mx-auto px-4 space-y-8">
            {/* Preview notice */}
            {isPreview && (
              <div className="bg-primary/10 border-l-4 border-primary p-4 rounded">
                <div className="flex items-center">
                  <div className="ml-3">
                    <p className="text-sm text-foreground/80">
                      <strong>Mode aperçu:</strong> Cet événement n'est pas encore publié et n'est visible que par les administrateurs.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Menu */}
            <section className="flex items-center justify-between">
              <div></div>
              <div className="flex items-center gap-2">
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
            </section>
            
            <EventPageHeader
              event={event}
              canPrepareVisit={canPrepareVisit}
              onPrepareVisit={() => setPrepareVisitOpen(true)}
            />

            {/* Lot 7 : la description longue est désormais dans le carousel d'informations. */}

            {/* Bandeau discret : revendication de la page salon par l'organisateur */}
            <ClaimSalonBanner event={event} />

            {/* Frise statistiques — présente aussi sur les événements passés (mode historique) */}
            <EventStatsStrip
              event={event}
              exhibitorCount={exhibitorCount}
              noveltyCount={noveltyCount}
            />


            {/* Past event banner */}
            {isEventPast && (
              <div className="rounded-r-lg border-l-4 border-primary bg-primary/10 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
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
            
            {/* Lot 4 — Grille 70 / 30 : Nouveautés à gauche, Radar CRM à droite.
                Sans exposant, le Radar ne s'affiche pas et les Nouveautés
                occupent toute la largeur (pas de colonne vide).
                Mobile / tablette : empilé, Nouveautés d'abord. */}
            <div
              className={
                capabilities.showRadarCrm
                  ? 'grid items-start gap-6 lg:[grid-template-columns:minmax(0,7fr)_minmax(280px,3fr)]'
                  : 'grid gap-6'
              }
            >
              <section id="nouveautes" className="min-w-0">
                <NoveltiesSection event={event} exhibitorCount={exhibitorCount} isEventPast={isEventPast} />
              </section>

              {capabilities.showRadarCrm && (
                <aside className="min-w-0">
                  <EventRadarCrmWidget event={event} isEventPast={isEventPast} />
                </aside>
              )}
            </div>


            {/* C. Exposants — approche category-first (lot 6), pleine largeur (lot 7) */}
            {exhibitorCount > 0 && (
              <section id="exposants">
                <EventExhibitorsSection
                  event={event}
                  exhibitorCount={exhibitorCount}
                  aiAvailable={canPrepareVisit}
                  onPrepareVisit={() => setPrepareVisitOpen(true)}
                />
              </section>
            )}

            {/* Lot 7 — Bandeau navy Parcours IA (masqué si indisponible) */}
            <EventAiBanner
              canPrepareVisit={canPrepareVisit}
              onPrepareVisit={() => setPrepareVisitOpen(true)}
            />

            {/* Lot 7 — Zone gris très clair : carousel unique d'informations */}
            <section className="-mx-4 rounded-2xl bg-muted/60 px-4 py-8 sm:px-8 sm:py-10">
              <EventInfoCarousel event={event} />
            </section>

            {/* Autres éditions de ce salon (séries) */}
            <EventSeriesBlock event={event} onSeriesIds={handleSeriesIds} />

            {/* Salons dans la même ville */}
            <SameCityEventsBlock event={event} />

            {/* Événements similaires pour le maillage interne SEO */}
            <RelatedEvents event={event} limit={4} excludeIds={seriesEventIds} />


            {/* Articles de blog liés au secteur */}
            <SectorArticlesBlock event={event} />

            {/* À propos de cette fiche — indépendance de la plateforme */}
            <aside className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/80">À propos de cette fiche. </span>
                Lotexpo est une plateforme indépendante. Cette fiche est établie à partir d'informations publiques. Sa présence n'implique ni affiliation, ni partenariat officiel, ni mandat de l'organisateur, sauf mention contraire sur cette page. Les marques citées appartiennent à leurs titulaires et sont utilisées à seule fin d'identifier l'événement. Les informations officielles restent celles publiées par l'organisateur. Demande de correction ou de retrait : contact@lotexpo.com.{' '}
                <Link to="/organisateurs" className="text-primary hover:underline">
                  Organisateurs de salons
                </Link>
              </p>
            </aside>
          </div>
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
