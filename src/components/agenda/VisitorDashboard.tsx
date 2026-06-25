import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectorTag } from '@/components/ui/sector-tag';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Sparkles, Ticket, ChevronDown, ChevronUp, Building2, CheckCircle2, ArrowRight, CalendarX, Store } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useVisitPlansForUser, VisitPlan } from '@/hooks/useVisitPlan';
import { useEventCardStats } from '@/hooks/useEventCardStats';
import { useQuery } from '@tanstack/react-query';
import {
  fetchExhibitorPublicSlugs,
  resolvePublicSlug,
  type PublicSlugMaps,
} from '@/lib/exhibitorPublicSlug';
import { ExhibitorFullProfileCTA } from '@/components/exhibitor/ExhibitorFullProfileCTA';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { normalizeStandNumber } from '@/utils/standUtils';
import { cn } from '@/lib/utils';
import { useToggleFavorite } from '@/hooks/useFavorites';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const NOVELTY_TYPE_LABELS = {
  Launch: 'Lancement',
  Prototype: 'Prototype',
  MajorUpdate: 'Mise à jour majeure',
  LiveDemo: 'Démo live',
  Partnership: 'Partenariat',
  Offer: 'Offre spéciale',
  Talk: 'Conférence'
};

interface VisitorDashboardProps {
  events: any[];
  likedNovelties: any[];
  isLoading?: boolean;
}

export function VisitorDashboard({ events, likedNovelties, isLoading }: VisitorDashboardProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const { data: visitPlans = [] } = useVisitPlansForUser();

  // Batched public stats (exposants + nouveautés) — same source as the Salons page
  const { data: statsMap } = useEventCardStats((events ?? []).map((e) => e.id));

  // Collect every exhibitor id referenced by the visit plans so we can resolve
  // their public `/exposants/:slug` identities in ONE batched query (no N+1).
  const planExhibitorIds = Array.from(
    new Set(
      visitPlans.flatMap((plan) =>
        [...(plan.prioritaires || []), ...(plan.optionnels || [])]
          .map((rec: any) => rec?.exhibitor_id)
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0),
      ),
    ),
  );

  const { data: slugMaps } = useQuery({
    queryKey: ['visit-plan-exhibitor-slugs', planExhibitorIds],
    enabled: planExhibitorIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PublicSlugMaps> => {
      const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // An exhibitor_id is either a modern UUID or a legacy id_exposant string.
      const uuids = planExhibitorIds.filter((id) => UUID_RE.test(id));
      const legacy = planExhibitorIds.filter((id) => !UUID_RE.test(id));
      return fetchExhibitorPublicSlugs(uuids, legacy);
    },
  });

  // Index visit plans by event_id
  const plansByEvent = visitPlans.reduce((acc, plan) => {
    acc[plan.event_id] = plan;
    return acc;
  }, {} as Record<string, VisitPlan>);

  // Group liked novelties by event
  const noveltiesByEvent = likedNovelties.reduce((acc, novelty) => {
    const eventId = novelty.event_id;
    if (!acc[eventId]) acc[eventId] = [];
    acc[eventId].push(novelty);
    return acc;
  }, {} as Record<string, any[]>);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const togglePlanExpand = (eventId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Ticket className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              Votre programme de visites
            </h3>
            <p className="text-sm text-blue-700">
              Retrouvez ici les salons auxquels vous souhaitez assister et les nouveautés que vous avez likées pour préparer votre parcours.
            </p>
          </div>
        </div>
      </div>

      {/* Events list */}
      {events.length > 0 ? (
        <div className="space-y-6">
          {events.map((event) => {
            const eventNovelties = noveltiesByEvent[event.id] || [];
            const isExpanded = expandedEvents.has(event.id);
            const displayedNovelties = isExpanded 
              ? eventNovelties 
              : eventNovelties.slice(0, 3);
            const visitPlan = plansByEvent[event.id];
            const isPlanExpanded = expandedPlans.has(event.id);
            const today = new Date();
            const eventEnd = new Date(event.date_fin || event.date_debut);
            const isPast = eventEnd < today;
            const stat = statsMap?.[event.id];
            const exhibitorCount = stat?.exhibitor_count ?? 0;
            const noveltyCount = stat?.novelty_count ?? 0;
            const sectorLabel = event.secteur
              ? (Array.isArray(event.secteur)
                  ? event.secteur[0]
                  : String(event.secteur).split(',')[0].trim())
              : null;

            return (
              <div key={event.id} className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                {/* Event Header */}
                <div className="flex items-start gap-3 sm:gap-4 mb-4">
                  {event.url_image && (
                    <img
                      src={event.url_image}
                      alt={event.nom_event}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {/* 1. Badge secteur */}
                    {sectorLabel && (
                      <div className="mb-1.5">
                        <SectorTag label={sectorLabel} />
                      </div>
                    )}
                    {/* 2. Titre */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/events/${event.slug}`} className="hover:text-primary transition-colors">
                        <h3 className="text-lg sm:text-xl font-semibold line-clamp-2">{event.nom_event}</h3>
                      </Link>
                      {visitPlan && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Liste prête
                        </Badge>
                      )}
                    </div>
                    {/* 3. Dates + lieu */}
                    <div className="text-sm text-muted-foreground mt-1">
                      {format(new Date(event.date_debut), 'dd MMM', { locale: fr })}
                      {event.date_fin !== event.date_debut && 
                        ` - ${format(new Date(event.date_fin), 'dd MMM', { locale: fr })}`
                      } • {event.ville}
                      {event.nom_lieu && ` • ${event.nom_lieu}`}
                    </div>
                    {/* 4. Bulles exposants / nouveautés (si dispo) */}
                    {(exhibitorCount > 0 || noveltyCount > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {exhibitorCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-bubble text-bubble-foreground border border-bubble-border">
                            <Store className="h-3 w-3 shrink-0" />
                            {exhibitorCount} {exhibitorCount > 1 ? 'exposants' : 'exposant'}
                          </span>
                        )}
                        {noveltyCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-bubble text-bubble-foreground border border-bubble-border">
                            <Sparkles className="h-3 w-3 shrink-0" />
                            {noveltyCount} {noveltyCount > 1 ? 'nouveautés' : 'nouveauté'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visit Plan Section */}
                {visitPlan && (
                  <div className="mt-4 pt-4 border-t">
                    <button
                      onClick={() => togglePlanExpand(event.id)}
                      className="flex items-center justify-between w-full text-left group"
                    >
                       <div className="flex items-center gap-2">
                         <Route className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">Mes exposants à voir</h4>
                        <Badge variant="secondary" className="text-xs">
                          {(visitPlan.prioritaires?.length || 0) + (visitPlan.optionnels?.length || 0)}
                        </Badge>
                      </div>
                      {isPlanExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {isPlanExpanded && (
                      <div className="mt-4 space-y-4">
                        {/* Prioritaires */}
                        {visitPlan.prioritaires && visitPlan.prioritaires.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                              ⭐ Incontournables
                            </p>
                            <div className="space-y-2">
                              {visitPlan.prioritaires.map((rec: any) => (
                                <ExhibitorRow key={rec.exhibitor_id} rec={rec} eventSlug={event.slug} eventId={event.id} slugMaps={slugMaps} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Optionnels */}
                        {visitPlan.optionnels && visitPlan.optionnels.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1">
                              💡 À voir si le temps le permet
                            </p>
                            <div className="space-y-2">
                              {visitPlan.optionnels.map((rec: any) => (
                                <ExhibitorRow key={rec.exhibitor_id} rec={rec} eventSlug={event.slug} eventId={event.id} slugMaps={slugMaps} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Update button */}
                        <div className="pt-2">
                          <Link to={`/events/${event.slug}?prepare=1`}>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Sparkles className="w-4 h-4" />
                              Mettre à jour ma liste →
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Prompt for events without visit plan */}
                {!visitPlan && !isPast && (event as any)._exhibitorCount >= 80 && (
                  <div className="mt-4 pt-4 border-t">
                    <Link
                      to={`/events/${event.slug}?prepare=1`}
                      className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Préparez votre visite avec l'IA →
                    </Link>
                  </div>
                )}

                {/* Liked novelties section */}
                {eventNovelties.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">Mon parcours</h4>
                        <Badge variant="secondary" className="text-xs">
                          {eventNovelties.length} nouveauté{eventNovelties.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {eventNovelties.length > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(event.id)}
                          className="gap-1"
                        >
                          {isExpanded ? (
                            <>
                              Réduire <ChevronUp className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Voir tout ({eventNovelties.length}) <ChevronDown className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {displayedNovelties.map((novelty: any) => (
                        <Link
                          key={novelty.id}
                          to={`/events/${event.slug}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          {novelty.media_urls && novelty.media_urls[0] && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              <img
                                src={novelty.media_urls[0]}
                                alt={novelty.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                              {novelty.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {novelty.exhibitors.name}
                              {novelty.stand_info && ` - Stand ${novelty.stand_info}`}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {NOVELTY_TYPE_LABELS[novelty.type as keyof typeof NOVELTY_TYPE_LABELS] || novelty.type}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-4 flex flex-wrap items-center gap-2">
                  <Link to={`/events/${event.slug}`}>
                    <Button variant="outline" size="sm">
                      Voir le salon <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                  <RemoveFromAgendaButton
                    eventId={event.id}
                    eventName={event.nom_event}
                    noveltyIds={eventNovelties.map((n: any) => n.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Votre agenda est vide
          </h3>
          <p className="text-gray-500 mb-6">
            Likez des nouveautés pour les retrouver ici avec leurs salons
          </p>
          <Button asChild>
            <Link to="/events">Découvrir les salons</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact exhibitor row for visit plan display
function ExhibitorRow({
  rec,
  eventSlug,
  eventId,
  slugMaps,
}: {
  rec: any;
  eventSlug: string;
  eventId: string;
  slugMaps?: PublicSlugMaps | null;
}) {
  const logoUrl = getExhibitorLogoUrl(rec.logo_url || null, rec.website || null);
  const standNumber = rec.stand ? normalizeStandNumber(rec.stand) : null;
  const slugInfo = resolvePublicSlug(slugMaps, {
    exhibitorId: rec.exhibitor_id,
    legacyId: rec.exhibitor_id,
  });

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="w-8 h-8 rounded-md bg-background flex-shrink-0 flex items-center justify-center overflow-hidden border">
        {logoUrl ? (
          <img src={logoUrl} alt={rec.name} className="w-full h-full object-contain" />
        ) : (
          <Building2 className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-tight">{rec.name}</p>
        {standNumber && (
          <p className="text-xs text-muted-foreground mt-0.5">Stand {standNumber}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rec.raison}</p>
        {slugInfo && !slugInfo.is_test && (
          <div className="mt-2">
            <ExhibitorFullProfileCTA
              publicSlug={slugInfo.public_slug}
              seoIndexable={slugInfo.seo_indexable}
              isTest={slugInfo.is_test}
              openInNewTab
              surface="event_exhibitor_list"
              eventSlug={eventSlug}
              variant="link"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RemoveFromAgendaButton({
  eventId,
  eventName,
  noveltyIds = [],
}: {
  eventId: string;
  eventName: string;
  noveltyIds?: string[];
}) {
  const toggleFavorite = useToggleFavorite();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      // 1. Repasser les nouveautés likées de cet événement en "non intéressé"
      //    (sinon elles ré-injectent l'événement dans l'agenda).
      for (const noveltyId of noveltyIds) {
        const { error } = await supabase.functions.invoke('novelty-like-toggle', {
          body: { novelty_id: noveltyId },
        });
        if (error) throw error;
      }

      // 2. Retirer l'événement des favoris (s'il y est encore).
      await toggleFavorite.mutateAsync(eventId);

      // 3. Rafraîchir l'agenda et les états de like.
      queryClient.invalidateQueries({ queryKey: ['liked-novelties', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['novelties'] });

      toast({
        title: 'Retiré de votre agenda',
        description: `"${eventName}" a été retiré de votre agenda.`,
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de retirer cet événement.',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={toggleFavorite.isPending || isRemoving}
      className="text-muted-foreground hover:text-white hover:bg-destructive/90"
    >
      <CalendarX className="h-4 w-4 mr-1.5" />
      Retirer de mon agenda
    </Button>
  );
}
