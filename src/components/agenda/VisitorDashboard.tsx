import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Sparkles, Ticket, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

  // Grouper les nouveautés likées par événement
  const noveltiesByEvent = likedNovelties.reduce((acc, novelty) => {
    const eventId = novelty.event_id;
    if (!acc[eventId]) acc[eventId] = [];
    acc[eventId].push(novelty);
    return acc;
  }, {} as Record<string, any[]>);

  const toggleExpand = (eventId: string) => {
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
      {/* Banner explicatif */}
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

      {/* Liste des événements */}
      {events.length > 0 ? (
        <div className="space-y-6">
          {events.map((event) => {
            const eventNovelties = noveltiesByEvent[event.id] || [];
            const isExpanded = expandedEvents.has(event.id);
            const displayedNovelties = isExpanded 
              ? eventNovelties 
              : eventNovelties.slice(0, 3);

            return (
              <div key={event.id} className="bg-white rounded-lg shadow-sm border p-6">
                {/* Event Header */}
                <div className="flex items-start gap-4 mb-4">
                  {event.url_image && (
                    <img
                      src={event.url_image}
                      alt={event.nom_event}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-semibold">{event.nom_event}</h3>
                      {event.secteur && event.secteur.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {Array.isArray(event.secteur) ? event.secteur[0] : event.secteur}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(event.date_debut), 'dd MMM', { locale: fr })}
                      {event.date_fin !== event.date_debut && 
                        ` - ${format(new Date(event.date_fin), 'dd MMM', { locale: fr })}`
                      } • {event.ville}
                      {event.nom_lieu && ` • ${event.nom_lieu}`}
                    </div>
                  </div>
                  <Link to={`/events/${event.slug}`}>
                    <Button variant="outline" size="sm">
                      Voir le salon
                    </Button>
                  </Link>
                </div>

                {/* Event Description */}
                {event.description_event && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {event.description_event}
                    </p>
                  </div>
                )}

                {/* Section Mon Parcours */}
                {eventNovelties.length > 0 ? (
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

                    {/* Liste compacte des nouveautés likées */}
                    <div className="space-y-2">
                      {displayedNovelties.map((novelty: any) => (
                        <Link
                          key={novelty.id}
                          to={`/events/${event.slug}/nouveautes`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          {/* Miniature */}
                          {novelty.media_urls && novelty.media_urls[0] && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              <img
                                src={novelty.media_urls[0]}
                                alt={novelty.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                          )}

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                              {novelty.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {novelty.exhibitors.name}
                              {novelty.stand_info && ` - Stand ${novelty.stand_info}`}
                            </p>
                          </div>

                          {/* Badge type */}
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {NOVELTY_TYPE_LABELS[novelty.type as keyof typeof NOVELTY_TYPE_LABELS] || novelty.type}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t">
                    <Link to={`/events/${event.slug}#nouveautes`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Découvrir les nouveautés de ce salon
                      </Button>
                    </Link>
                  </div>
                )}
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
