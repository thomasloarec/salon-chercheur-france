
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseEventSlug } from '@/utils/eventUtils';
import { EventHero } from '@/components/event/EventHero';
import { EventInfo } from '@/components/event/EventInfo';
import { ExhibitorsTable } from '@/components/event/ExhibitorsTable';
import { SimilarEvents } from '@/components/event/SimilarEvents';
import { matchExhibitorsWithCRM } from '@/utils/crmMatching';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { Event } from '@/types/event';

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [exhibitors, setExhibitors] = useState<any[]>([]);
  const [crmTargets, setCrmTargets] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!slug) return;
      
      const parsedSlug = parseEventSlug(slug);
      if (!parsedSlug) {
        navigate('/events');
        return;
      }

      try {
        // Fetch event by matching name, year, and city
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .ilike('name', `%${parsedSlug.name.replace('-', ' ')}%`)
          .eq('city', parsedSlug.city)
          .gte('start_date', `${parsedSlug.year}-01-01`)
          .lt('start_date', `${parsedSlug.year + 1}-01-01`)
          .limit(1);

        if (error) {
          console.error('Error fetching event:', error);
          navigate('/events');
          return;
        }

        if (!events || events.length === 0) {
          navigate('/events');
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
        navigate('/events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="py-12">
          <div className="max-w-4xl mx-auto px-4">
            <div className="animate-pulse space-y-4">
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

  if (!event) {
    return null;
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
      <div className="min-h-screen">
        <Header />
        
        <main className="py-6">
          <div className="max-w-6xl mx-auto px-4">
            <Button
              variant="outline"
              onClick={() => navigate('/events')}
              className="mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux événements
            </Button>

            <EventHero event={event} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              <div className="lg:col-span-2 space-y-8">
                <section>
                  <h2 className="text-2xl font-bold mb-4">À propos de l'événement</h2>
                  <div className="prose max-w-none">
                    {event.description ? (
                      <p>{event.description}</p>
                    ) : (
                      <p>
                        Découvrez {event.name}, un événement incontournable du secteur {event.sector.toLowerCase()}.
                        Retrouvez les dernières innovations, rencontrez les professionnels du secteur et développez votre réseau.
                      </p>
                    )}
                  </div>
                </section>

                <ExhibitorsTable 
                  exhibitors={exhibitors} 
                  crmTargets={crmTargets} 
                />
              </div>

              <div className="space-y-6">
                <EventInfo event={event} />
                <SimilarEvents 
                  currentEvent={event} 
                  sector={event.sector} 
                  city={event.city} 
                />
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default EventPage;
