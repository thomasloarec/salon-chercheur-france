import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EventCard from '@/components/EventCard';
import type { Event } from '@/types/event';

const RegionalEvents = () => {
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ['regional-events-idf'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Départements d'Île-de-France: 75, 77, 78, 91, 92, 93, 94, 95
      const idfDepartments = ['75', '77', '78', '91', '92', '93', '94', '95'];
      
      // Fetch all visible B2B events
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', true)
        .eq('is_b2b', true)
        .gte('date_debut', today)
        .order('date_debut', { ascending: true });

      if (error) throw error;
      
      // Filter events by Île-de-France postal codes (starts with 75, 77, 78, 91, 92, 93, 94, 95)
      const idfEvents = (data || []).filter(event => {
        const postalCode = event.code_postal?.substring(0, 2);
        return postalCode && idfDepartments.includes(postalCode);
      }).slice(0, 8);
      
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
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
            onClick={() => navigate('/events?region=ile-de-france')}
            variant="ghost"
            className="text-accent hover:text-accent/80"
          >
            Voir tous les événements
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default RegionalEvents;
