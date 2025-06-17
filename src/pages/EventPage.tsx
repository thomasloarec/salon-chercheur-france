
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { matchExhibitorsWithCRM } from '@/utils/crmMatching';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { EventPageHeader } from '@/components/event/EventPageHeader';
import { EventAbout } from '@/components/event/EventAbout';
import { EventExhibitors } from '@/components/event/EventExhibitors';
import { EventSidebar } from '@/components/event/EventSidebar';
import { SimilarEvents } from '@/components/event/SimilarEvents';
import { SEOHead } from '@/components/event/SEOHead';
import { EventAdminMenu } from '@/components/event/EventAdminMenu';
import FavoriteButton from '@/components/FavoriteButton';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateEvents } from '@/hooks/useEvents';
import type { Event } from '@/types/event';

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const invalidateEvents = useInvalidateEvents();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exhibitors, setExhibitors] = useState<any[]>([]);
  const [crmProspects, setCrmProspects] = useState<Array<{ name: string; stand?: string }>>([]);

  // Simple admin check - in a real app, this would come from user roles
  const isAdmin = user?.email === 'admin@salonspro.com';

  const fetchEvent = async () => {
    if (!slug) {
      setError('Slug manquant');
      setLoading(false);
      return;
    }

    console.log('🔍 Searching for event with slug:', slug);
    
    try {
      let query = supabase
        .from('events')
        .select(`
          *,
          favorites!left(user_id)
        `)
        .eq('slug', slug);

      if (!isAdmin) {
        query = query.eq('visible', true);
      }

      const { data: eventData, error: fetchError } = await query.maybeSingle();

      if (fetchError) {
        console.error('❌ Error fetching event:', fetchError);
        setError('Erreur lors du chargement de l\'événement');
        setLoading(false);
        return;
      }

      if (!eventData) {
        console.log('❌ Event not found with slug:', slug);
        setError('Événement introuvable');
        setLoading(false);
        return;
      }

      console.log('✅ Event found:', eventData);
      
      // Check if user has favorited this event
      const isFavorite = user ? eventData.favorites?.some((fav: any) => fav.user_id === user.id) : false;
      
      // Ensure event_type is properly typed and add is_favorite
      const typedEvent = {
        ...eventData,
        event_type: eventData.event_type as Event['event_type'],
        is_favorite: isFavorite
      } as Event;
      
      setEvent(typedEvent);

      // Mock exhibitors data for now
      const mockExhibitors = [
        { name: 'Entreprise A', stand: 'A12', website: 'entreprise-a.com' },
        { name: 'Entreprise B', stand: 'B15', website: 'entreprise-b.com' },
        { name: 'Entreprise C', stand: 'C08', website: 'entreprise-c.com' },
      ];

      setExhibitors(mockExhibitors);

      // Mock CRM prospects data (these would be matched from actual CRM in real implementation)
      const mockCrmProspects = [
        { name: 'Entreprise A', stand: 'A12' },
        { name: 'Entreprise B', stand: 'B15' },
      ];

      setCrmProspects(mockCrmProspects);

    } catch (error) {
      console.error('❌ Unexpected error:', error);
      setError('Une erreur inattendue s\'est produite');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [slug, user]);

  const handleEventUpdated = async (refreshedEvent: Event, slugChanged?: boolean) => {
    console.log('🔄 Event updated:', refreshedEvent);
    console.log('🔄 Slug changed:', slugChanged);
    
    // Ensure the refreshed event has proper typing
    const typedRefreshedEvent = {
      ...refreshedEvent,
      event_type: refreshedEvent.event_type as Event['event_type']
    } as Event;
    
    // Update local state immediately with the refreshed event data
    setEvent(typedRefreshedEvent);
    
    // Invalidate events cache to update lists
    invalidateEvents();
    // Invalidate the sectors for this specific event to force a refetch
    queryClient.invalidateQueries({ queryKey: ['event-sectors', typedRefreshedEvent.id] });
    
    // If the slug has changed, redirect to the new URL
    if (slugChanged && typedRefreshedEvent.slug) {
      console.log('🔄 Redirecting to new slug:', typedRefreshedEvent.slug);
      navigate(`/events/${typedRefreshedEvent.slug}`, { replace: true });
    }
  };

  const handleEventDeleted = () => {
    console.log('🗑️ Event deleted, invalidating cache and redirecting');
    
    // Invalidate events cache to update lists immediately
    invalidateEvents();
    
    // Navigate to events list
    navigate('/events');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="py-8">
          <div className="max-w-7xl mx-auto px-4">
            <div className="animate-pulse space-y-8">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="h-32 bg-gray-200 rounded"></div>
                  <div className="h-48 bg-gray-200 rounded"></div>
                </div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="py-12">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Événement introuvable
              </h1>
              <p className="text-lg text-gray-600">
                {error || 'L\'événement que vous recherchez n\'existe pas ou a été supprimé.'}
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <SEOHead event={event} />
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="py-8">
          <div className="max-w-7xl mx-auto px-4 space-y-8">
            {/* Titre + Favoris + Admin Menu */}
            <section className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 flex-1">
                  {event.name}
                </h1>
                <FavoriteButton
                  eventId={event.id}
                  size="lg"
                  className="mt-1"
                />
              </div>
              <EventAdminMenu
                event={event}
                isAdmin={isAdmin}
                onEventUpdated={handleEventUpdated}
                onEventDeleted={handleEventDeleted}
              />
            </section>
            
            <EventPageHeader event={event} crmProspects={crmProspects} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Colonne principale */}
              <div className="lg:col-span-2 space-y-8">
                <EventAbout event={event} />
                <EventExhibitors exhibitors={exhibitors} />
              </div>

              {/* Sidebar */}
              <EventSidebar event={event} />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default EventPage;
