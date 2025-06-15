
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseEventSlug } from '@/utils/eventUtils';
import { matchExhibitorsWithCRM } from '@/utils/crmMatching';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { EventHeader } from '@/components/event/EventHeader';
import { EventDescription } from '@/components/event/EventDescription';
import { ExhibitorsList } from '@/components/event/ExhibitorsList';
import { EventDetails } from '@/components/event/EventDetails';
import { EventFooter } from '@/components/event/EventFooter';
import { SimilarEvents } from '@/components/event/SimilarEvents';
import type { Event } from '@/types/event';

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exhibitors, setExhibitors] = useState<any[]>([]);
  const [crmTargets, setCrmTargets] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!slug) {
        setError('Slug manquant');
        setLoading(false);
        return;
      }
      
      const parsedSlug = parseEventSlug(slug);
      if (!parsedSlug) {
        setError('Format de slug invalide');
        setLoading(false);
        return;
      }

      try {
        // Fetch event by matching name, year, and city
        const { data: events, error: fetchError } = await supabase
          .from('events')
          .select('*')
          .ilike('name', `%${parsedSlug.name.replace('-', ' ')}%`)
          .eq('city', parsedSlug.city)
          .gte('start_date', `${parsedSlug.year}-01-01`)
          .lt('start_date', `${parsedSlug.year + 1}-01-01`)
          .limit(1);

        if (fetchError) {
          console.error('Error fetching event:', fetchError);
          setError('Erreur lors du chargement de l\'événement');
          setLoading(false);
          return;
        }

        if (!events || events.length === 0) {
          setError('Événement introuvable');
          setLoading(false);
          return;
        }

        const eventData = events[0];
        setEvent(eventData);

        // Mock exhibitors data for now
        const mockExhibitors = [
          { name: 'Entreprise A', stand: 'A12', website: 'entreprise-a.com' },
          { name: 'Entreprise B', stand: 'B15', website: 'entreprise-b.com' },
          { name: 'Entreprise C', stand: 'C08', website: 'entreprise-c.com' },
        ];

        // Match with CRM
        const { exhibitors: matchedExhibitors, crmTargets: matchedTargets } = 
          await matchExhibitorsWithCRM(mockExhibitors);

        setExhibitors(matchedExhibitors);
        setCrmTargets(matchedTargets);

      } catch (error) {
        console.error('Error:', error);
        setError('Une erreur inattendue s\'est produite');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="py-12">
          <div className="max-w-4xl mx-auto px-4">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
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
      <div className="min-h-screen">
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
              <EventFooter />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Generate JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.name,
    "startDate": event.start_date,
    "endDate": event.end_date,
    "location": {
      "@type": "Place",
      "name": event.venue_name || event.location,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": event.city,
        "addressRegion": event.region,
        "addressCountry": event.country || "France"
      }
    },
    "organizer": event.organizer_name ? {
      "@type": "Organization",
      "name": event.organizer_name
    } : undefined,
    "description": event.description,
    "url": event.event_url,
    "image": event.image_url
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="py-6">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Colonne principale */}
              <div className="lg:col-span-2 space-y-6">
                <EventHeader event={event} />
                <EventDescription event={event} />
                <ExhibitorsList 
                  exhibitors={exhibitors} 
                  crmTargets={crmTargets} 
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <EventDetails event={event} />
                <SimilarEvents 
                  currentEvent={event} 
                  sector={event.sector} 
                  city={event.city} 
                />
              </div>
            </div>

            <EventFooter />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default EventPage;
