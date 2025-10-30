import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UpcomingFairs = () => {
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ['upcoming-fairs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, novelties(count)')
        .gte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: true })
        .limit(8);

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <section className="bg-[#0B0F19] py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[#E6EAF3] mb-10">
            Salons à venir populaires
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="min-w-[320px] h-48 bg-[#0F1424]/60 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#0B0F19] py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-[#E6EAF3]">
            Salons à venir populaires
          </h2>
          <Button 
            onClick={() => navigate('/events')}
            variant="ghost"
            className="text-[#5B9DFF] hover:text-[#5B9DFF]/80"
          >
            Tous les salons
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory no-scrollbar">
          {events?.map((event: any) => {
            const noveltiesCount = Array.isArray(event.novelties) ? event.novelties.length : 0;
            
            return (
              <div 
                key={event.id}
                onClick={() => navigate(`/events/${event.slug}`)}
                className="min-w-[320px] snap-start bg-[#0F1424]/60 backdrop-blur-xl rounded-xl p-5 border border-white/10 hover:border-[#5B9DFF]/50 transition-all duration-300 cursor-pointer group"
              >
                {/* Event image or placeholder */}
                <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-[#FF7A00]/20 to-[#5B9DFF]/20">
                  {event.url_logo ? (
                    <img 
                      src={event.url_logo}
                      alt={event.name_event}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-[#E6EAF3]/30" />
                    </div>
                  )}
                  
                  {noveltiesCount > 0 && (
                    <Badge className="absolute top-2 right-2 bg-[#FF7A00] text-white">
                      +{noveltiesCount} Nouveautés
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-[#E6EAF3] mb-2 line-clamp-2 group-hover:text-[#5B9DFF] transition-colors">
                  {event.name_event}
                </h3>

                <div className="space-y-2 text-sm text-[#E6EAF3]/70">
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#FF7A00]" />
                    {new Date(event.date_debut).toLocaleDateString('fr-FR')}
                    {event.date_fin && ` - ${new Date(event.date_fin).toLocaleDateString('fr-FR')}`}
                  </p>
                  {event.ville && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#FF7A00]" />
                      {event.ville}
                    </p>
                  )}
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
