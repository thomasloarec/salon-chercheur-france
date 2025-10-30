import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EventSectors } from '@/components/ui/event-sectors';
import type { Event } from '@/types/event';

const UpcomingFairs = () => {
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ['upcoming-fairs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, novelties(count)')
        .eq('visible', true)
        .gte('date_debut', new Date().toISOString().split('T')[0])
        .order('date_debut', { ascending: true })
        .limit(4);

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <section className="bg-secondary py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-10">
            Salons populaires à venir
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-secondary py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Salons populaires à venir
          </h2>
          <Button 
            onClick={() => navigate('/events')}
            variant="ghost"
            className="text-primary hover:text-primary/80"
          >
            Tous les salons
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {events?.map((event: any) => {
            const noveltiesCount = Array.isArray(event.novelties) ? event.novelties.length : 0;
            const eventData = event as Event;
            
            return (
              <div 
                key={event.id}
                onClick={() => navigate(`/events/${event.slug}`)}
                className="bg-card backdrop-blur-xl rounded-xl overflow-hidden border border-border hover:border-accent/50 transition-all duration-300 cursor-pointer group"
              >
                {/* Event image or placeholder */}
                <div className="relative h-60 bg-muted">
                  {event.url_image ? (
                    <img 
                      src={event.url_image}
                      alt={event.nom_event}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Sector badges overlay */}
                  <div className="absolute left-2 bottom-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)] z-[2]">
                    <EventSectors event={eventData} sectorClassName="shadow-sm" />
                  </div>
                  
                  {noveltiesCount > 0 && (
                    <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                      +{noveltiesCount} Nouveautés
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                    {event.nom_event}
                  </h3>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-accent" />
                      {new Date(event.date_debut).toLocaleDateString('fr-FR')}
                      {event.date_fin && ` - ${new Date(event.date_fin).toLocaleDateString('fr-FR')}`}
                    </p>
                    {event.ville && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-accent" />
                        {event.ville}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UpcomingFairs;
