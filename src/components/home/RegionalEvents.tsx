import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EventCard from '@/components/EventCard';
import type { Event } from '@/types/event';
import { regionSlugFromPostal } from '@/lib/postalToRegion';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useIsMobile } from '@/hooks/use-mobile';

const RegionalEvents = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: events, isLoading } = useQuery({
    queryKey: ['regional-events-idf'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', true)
        .gte('date_debut', today)
        .order('date_debut', { ascending: true });

      if (error) throw error;
      
      const idfEvents = (data || []).filter(event => {
        const regionSlug = regionSlugFromPostal(event.code_postal);
        return regionSlug === 'ile-de-france';
      }).slice(0, 4);
      
      return idfEvents as Event[];
    }
  });

  if (isLoading) {
    return (
      <section className="bg-background py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Événements en Île-de-France
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <section className="bg-background py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Événements en Île-de-France
          </h2>
          <Button 
            onClick={() => navigate('/?region=ile-de-france')}
            variant="ghost"
            className="text-accent hover:text-accent/80 hidden sm:flex"
          >
            Voir tous les événements
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Mobile: Carousel */}
        {isMobile ? (
          <Carousel className="w-full">
            <CarouselContent className="-ml-4">
              {events.map((event) => (
                <CarouselItem key={event.id} className="pl-4 basis-[85%]">
                  <EventCard event={event} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0 -translate-x-1/2" />
            <CarouselNext className="right-0 translate-x-1/2" />
          </Carousel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* Mobile CTA */}
        <div className="sm:hidden mt-6 text-center">
          <Button 
            onClick={() => navigate('/?region=ile-de-france')}
            variant="ghost"
            className="text-accent hover:text-accent/80"
          >
            Voir tous les événements
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default RegionalEvents;
