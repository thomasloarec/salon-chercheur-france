
import React, { useState, useEffect, useMemo } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useInvalidateEvents } from '@/hooks/useEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EventPageHeader } from '@/components/event/EventPageHeader';

import { EventWhyVisit } from '@/components/event/EventWhyVisit';
import { RelatedEvents } from '@/components/event/RelatedEvents';
import NoveltiesSection from '@/components/event/NoveltiesSection';
import { EventSeriesBlock } from '@/components/event/EventSeriesBlock';
import { SameCityEventsBlock } from '@/components/event/SameCityEventsBlock';
import { SectorArticlesBlock } from '@/components/event/SectorArticlesBlock';

import ExhibitorsSidebar from '@/components/event/ExhibitorsSidebar';
import EventAboutSidebar from '@/components/event/EventAboutSidebar';
import { SEOHead } from '@/components/event/SEOHead';
import { EventAdminMenu } from '@/components/event/EventAdminMenu';
import PrepareVisitWizard from '@/components/event/PrepareVisitWizard';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Eye, Sparkles } from 'lucide-react';
import { useExhibitorsByEvent } from '@/hooks/useExhibitorsByEvent';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [participationsCount, setParticipationsCount] = useState<number>(0);
  const [prepareVisitOpen, setPrepareVisitOpen] = useState(false);

  // Auto-open wizard from ?prepare=1 query param (e.g. from agenda page)
  useEffect(() => {
    if (searchParams.get('prepare') === '1' && exhibitorCount >= 80) {
      setPrepareVisitOpen(true);
    }
  }, [searchParams]);

  // Get exhibitor count to conditionally show "Préparer ma visite" button
  const { data: exhibitorsData } = useExhibitorsByEvent(
    event.slug || '',
    undefined,
    1,
    0,
    event.id_event
  );
  const exhibitorCount = exhibitorsData?.total || 0;
  const isEventPast = useMemo(() => {
    const endDate = event.date_fin || event.date_debut;
    if (!endDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return endDate < today;
  }, [event.date_fin, event.date_debut]);

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
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        {/* Admin toolbar - shown if user is admin */}
        {isAdmin && (
          <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded-none">
            <div className="container mx-auto px-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">
                  <strong>Admin:</strong> Outils d'administration pour cet événement
                  {participationsCount > 0 && (
                    <span className="ml-4 text-xs bg-orange-200 px-2 py-1 rounded">
                      Participations en DB : {participationsCount}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/events/${event.id}`)}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Éditer
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <main className="py-8">
          <div className="container mx-auto px-4 space-y-8">
            {/* Preview notice */}
            {isPreview && (
              <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded">
                <div className="flex items-center">
                  <div className="ml-3">
                    <p className="text-sm text-orange-700">
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
                <EventAdminMenu
                  event={event}
                  isAdmin={isAdmin}
                  onEventUpdated={handleEventUpdated}
                  onEventDeleted={handleEventDeleted}
                />
              </div>
            </section>
            
            <EventPageHeader event={event} />

            {/* Past event banner */}
            {isEventPast && (
              <div className="rounded-r-lg border-l-4 border-orange-400 bg-orange-50 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
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
            
            {/* Préparer ma visite - shown when >= 80 exhibitors and event not past */}
            {exhibitorCount >= 80 && !isEventPast && (
              <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Préparez votre visite avec l'IA</p>
                    <p className="text-xs text-muted-foreground">
                      Notre assistant analyse les {exhibitorCount} exposants pour créer votre parcours personnalisé
                    </p>
                  </div>
                </div>
                <Button onClick={() => setPrepareVisitOpen(true)} className="gap-2 whitespace-nowrap">
                  <Sparkles className="w-4 h-4" />
                  Préparer ma visite
                </Button>
              </div>
            )}

            <div className="grid grid-cols-12 gap-6">
              {/* Colonne gauche - Nouveautés */}
              <div className="col-span-12 lg:col-span-8">
                <section id="nouveautes">
                  <NoveltiesSection event={event} />
                </section>
              </div>

              {/* Colonne droite - Exposants et À propos */}
              <aside className="col-span-12 lg:col-span-4 space-y-6">
                <ExhibitorsSidebar event={event} />
                <EventAboutSidebar event={event} />
              </aside>
            </div>

            {/* Autres éditions de ce salon (séries) */}
            <EventSeriesBlock event={event} />

            {/* Salons dans la même ville */}
            <SameCityEventsBlock event={event} />

            {/* Événements similaires pour le maillage interne SEO */}
            <RelatedEvents event={event} limit={4} />

            {/* Bloc "Pourquoi visiter" en bas de page */}
            <EventWhyVisit event={event} />

            {/* Articles de blog liés au secteur */}
            <SectorArticlesBlock event={event} />
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
