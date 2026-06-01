
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useInvalidateEvents } from '@/hooks/useEvents';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EventPageHeader } from '@/components/event/EventPageHeader';

import { EventWhyVisit } from '@/components/event/EventWhyVisit';
import { RelatedEvents } from '@/components/event/RelatedEvents';
import NoveltiesSection from '@/components/event/NoveltiesSection';
import { EventSeriesBlock } from '@/components/event/EventSeriesBlock';
import { SameCityEventsBlock } from '@/components/event/SameCityEventsBlock';
import { SectorArticlesBlock } from '@/components/event/SectorArticlesBlock';
import { EventKeyFigures } from '@/components/event/EventKeyFigures';
import { EventFaqBlock } from '@/components/event/EventFaqBlock';

import ExhibitorsSidebar from '@/components/event/ExhibitorsSidebar';
import EventAboutSidebar from '@/components/event/EventAboutSidebar';
import EventRadarCrmWidget from '@/components/event/EventRadarCrmWidget';
import { SEOHead } from '@/components/event/SEOHead';
import { EventAdminMenu } from '@/components/event/EventAdminMenu';
import PrepareVisitWizard from '@/components/event/PrepareVisitWizard';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Eye, Sparkles, Check, ChevronDown } from 'lucide-react';
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
  const [seriesEventIds, setSeriesEventIds] = useState<string[]>([]);

  const handleSeriesIds = useCallback((ids: string[]) => {
    setSeriesEventIds(ids);
  }, []);

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

  // Novelty count for KeyFigures
  const { data: noveltyCountData } = useQuery({
    queryKey: ['novelty-count', event.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('novelties')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .in('status', ['published', 'approved']);
      return count ?? 0;
    },
    enabled: !!event.id,
  });
  const noveltyCount = noveltyCountData ?? 0;

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
                {/* Enrichment status */}
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${event.meta_description_gen ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    Meta: {event.meta_description_gen ? '✓' : '—'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${Array.isArray(event.faq_json) && event.faq_json.length > 0 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    FAQ: {Array.isArray(event.faq_json) && event.faq_json.length > 0 ? `✓ (${event.faq_json.length})` : '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                    Score: {event.enrichissement_score ?? '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                    Statut: {event.enrichissement_statut || '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                    Enrichi: {event.enrichissement_date ? new Date(event.enrichissement_date).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
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

            {/* Indicateurs utiles — uniquement événements à venir */}
            {!isEventPast && (
              <EventKeyFigures
                event={event}
                exhibitorCount={exhibitorCount}
                noveltyCount={noveltyCount}
              />
            )}

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
            
            {/* Colonne principale : Nouveautés → Exposants → IA. Sidebar : À propos. */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8 space-y-8">
                {/* B. Nouveautés — bloc principal, design inchangé */}
                <section id="nouveautes">
                  <NoveltiesSection event={event} />
                </section>

                {/* C. Exposants — déplacés sous les Nouveautés, en pleine largeur */}
                {exhibitorCount > 0 && (
                  <section id="exposants">
                    <ExhibitorsSidebar
                      event={event}
                      variant="main"
                      aiAvailable={exhibitorCount >= 80 && !isEventPast}
                      onPrepareVisit={() => setPrepareVisitOpen(true)}
                    />
                  </section>
                )}

                {/* Connecteur visuel discret : continuité Exposants → Parcours IA */}
                {exhibitorCount >= 80 && !isEventPast && (
                  <div className="flex justify-center -my-3" aria-hidden="true">
                    <ChevronDown className="w-5 h-5 text-primary/40" />
                  </div>
                )}

                {/* D. Préparer ma visite avec l'IA — carte sobre & premium.
                    Conserve la logique métier existante (seuil ≥ 80 exposants, événement à venir). */}
                {exhibitorCount >= 80 && !isEventPast && (
                  <section
                    aria-label="Préparer votre visite avec l'IA Lotexpo"
                    className="rounded-2xl border border-primary/20 bg-card shadow-sm overflow-hidden"
                  >
                    <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-5">
                      {/* Colonne gauche : promesse + bénéfices + CTA */}
                      <div className="md:col-span-3 space-y-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          <Sparkles className="w-3.5 h-3.5" />
                          Parcours IA
                        </span>
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                            Préparez votre visite avec l'IA Lotexpo
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            À partir des exposants référencés sur ce salon, Lotexpo vous aide à
                            prioriser les stands à visiter, repérer les nouveautés utiles et
                            organiser un parcours selon vos objectifs.
                          </p>
                          <p className="text-xs text-muted-foreground/80">
                            Basé sur les {exhibitorCount} exposants référencés
                            {noveltyCount > 0 ? ` et ${noveltyCount} nouveautés` : ''}.
                          </p>
                        </div>
                        <ul className="space-y-2">
                          {[
                            'Exposants à prioriser',
                            'Nouveautés à découvrir',
                            'Parcours optimisé sur place',
                          ].map((benefit) => (
                            <li key={benefit} className="flex items-center gap-2 text-sm text-foreground/90">
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                        <Button
                          onClick={() => setPrepareVisitOpen(true)}
                          size="lg"
                          className="gap-2 w-full sm:w-auto"
                        >
                          <Sparkles className="w-4 h-4" />
                          Générer mon parcours IA
                        </Button>
                      </div>

                      {/* Colonne droite : mini aperçu d'un parcours recommandé */}
                      <div className="md:col-span-2">
                        <div className="h-full rounded-xl border border-border bg-muted/40 p-4">
                          <p className="text-xs font-medium text-muted-foreground mb-3">
                            Aperçu de votre parcours
                          </p>
                          <ol className="space-y-3">
                            {[
                              noveltyCount > 0
                                ? `${exhibitorCount} exposants et ${noveltyCount} nouveautés analysés`
                                : `${exhibitorCount} exposants analysés`,
                              'Stands prioritaires identifiés',
                              'Parcours recommandé généré',
                            ].map((step, i) => (
                              <li key={step} className="flex items-start gap-3">
                                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                  {i + 1}
                                </span>
                                <span className="text-sm text-foreground/80 leading-snug pt-0.5">
                                  {step}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* E. Sidebar : À propos de l'événement (Exposants retirés) */}
              <aside className="col-span-12 lg:col-span-4 space-y-6">
                <EventAboutSidebar event={event} />
                {exhibitorCount > 0 && (
                  <EventRadarCrmWidget event={event} isEventPast={isEventPast} />
                )}
              </aside>
            </div>

            {/* Autres éditions de ce salon (séries) */}
            <EventSeriesBlock event={event} onSeriesIds={handleSeriesIds} />

            {/* Salons dans la même ville */}
            <SameCityEventsBlock event={event} />

            {/* Événements similaires pour le maillage interne SEO */}
            <RelatedEvents event={event} limit={4} excludeIds={seriesEventIds} />

            {/* Bloc "Pourquoi visiter" en bas de page */}
            <EventWhyVisit event={event} />

            {/* FAQ — uniquement si faq_json rempli et événement à venir */}
            {!isEventPast && Array.isArray(event.faq_json) && event.faq_json.length > 0 && (
              <EventFaqBlock faq={event.faq_json} eventName={event.nom_event} />
            )}

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
