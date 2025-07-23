
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import EventCard from './EventCard';
import { useEvents } from '@/hooks/useEvents';

const RecentEventsSection = () => {
  const { data: upcomingEvents, isLoading } = useEvents({
    sectors: [],
    types: [],
    months: [],
    city: '',
  });

  // Limite à 8 événements pour la section d'accueil
  const limitedEvents = upcomingEvents?.slice(0, 8) || [];

  return (
    <section className="py-20 bg-gray-50">
      <div className="w-full max-w-[1440px] mx-auto px-6">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Événements à venir
            </h2>
            <p className="text-xl text-gray-600">
              Découvrez les prochains salons professionnels majeurs en France
            </p>
          </div>
          <Link to="/events">
            <Button variant="outline" className="hidden md:flex items-center gap-2">
              Voir tous les événements <ExternalLink size={16} />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-56 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-8 bg-gray-200 rounded"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : limitedEvents.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {limitedEvents.map((event) => (
              <EventCard key={event.id} event={event} view="grid" />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun événement à venir pour le moment</p>
          </div>
        )}

        <div className="text-center mt-12 md:hidden">
          <Link to="/events">
            <Button variant="outline" className="flex items-center gap-2 mx-auto">
              Voir tous les événements <ExternalLink size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default RecentEventsSection;
