
import React, { useState, useEffect } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useInvalidateEvents } from '@/hooks/useEvents';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EventPageHeader } from '@/components/event/EventPageHeader';

import { EventWhyVisit } from '@/components/event/EventWhyVisit';
import { RelatedEvents } from '@/components/event/RelatedEvents';
import NoveltiesSection from '@/components/event/NoveltiesSection';
import ExhibitorsSidebar from '@/components/event/ExhibitorsSidebar';
import EventAboutSidebar from '@/components/event/EventAboutSidebar';
import { SEOHead } from '@/components/event/SEOHead';
import { EventAdminMenu } from '@/components/event/EventAdminMenu';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventPageContentProps {
  event: Event;
  isPreview?: boolean;
  onEventUpdated?: (event: Event, slugChanged?: boolean) => void;
  onEventDeleted?: () => void;
}

export const EventPageContent: React.FC<EventPageContentProps> = ({
  event,
  isPreview = false,
  onEventUpdated,
  onEventDeleted
}) => {
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [participationsCount, setParticipationsCount] = useState<number>(0);
  
  const invalidateEvents = useInvalidateEvents();
  const queryClient = useQueryClient();


  // Mini debug pour admin : compter les participations
  useEffect(() => {
    if (isAdmin && event.id_event) {
      const fetchParticipationsCount = async () => {
        try {
          const { count, error } = await supabase
            .from('participation')
            .select('*', { count: 'exact', head: true })
            .eq('id_event_text', event.id_event);
          
          if (!error && count !== null) {
            setParticipationsCount(count);
          }
        } catch (error) {
          console.error('Error fetching participations count:', error);
        }
      };
      
      fetchParticipationsCount();
    }
  }, [isAdmin, event.id_event]);

  const handleEventUpdated = (refreshedEvent: Event, slugChanged?: boolean) => {
    if (onEventUpdated) {
      onEventUpdated(refreshedEvent, slugChanged);
    }
    invalidateEvents();
    queryClient.invalidateQueries({ queryKey: ['event-sectors', refreshedEvent.id_event] });
  };

  const handleEventDeleted = () => {
    if (onEventDeleted) {
      onEventDeleted();
    }
    invalidateEvents();
  };

  return (
    <>
      <SEOHead event={event} noIndex={isPreview} />
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        {/* Admin toolbar - shown if user is admin */}
        {isAdmin && (
          <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded-none">
            <div className="container mx-auto px-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">
                  <strong>Admin:</strong> Outils d'administration pour cet événement
                  {participationsCount > 0 && (
                    <span className="ml-4 text-xs bg-orange-200 px-2 py-1 rounded">
                      Participations en DB : {participationsCount}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/events/${event.id}`)}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Éditer
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <main className="py-8">
          <div className="container mx-auto px-4 space-y-8">
            {/* Preview notice */}
            {isPreview && (
              <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded">
                <div className="flex items-center">
                  <div className="ml-3">
                    <p className="text-sm text-orange-700">
                      <strong>Mode aperçu:</strong> Cet événement n'est pas encore publié et n'est visible que par les administrateurs.
                    </p>
                  </div>
                </div>
              </div>
            )}
            

            {/* Admin Menu */}
            <section className="flex items-center justify-between">
              <div></div>
              <div className="flex items-center gap-2">
                <EventAdminMenu
                  event={event}
                  isAdmin={isAdmin}
                  onEventUpdated={handleEventUpdated}
                  onEventDeleted={handleEventDeleted}
                />
              </div>
            </section>
            
            <EventPageHeader event={event} />
            
            <div className="grid grid-cols-12 gap-6">
              {/* Colonne gauche - Nouveautés */}
              <div className="col-span-12 lg:col-span-8">
                <section id="nouveautes">
                  <NoveltiesSection event={event} />
                </section>
              </div>

              {/* Colonne droite - Exposants et À propos */}
              <aside className="col-span-12 lg:col-span-4 space-y-6">
                <ExhibitorsSidebar event={event} />
                <EventAboutSidebar event={event} />
              </aside>
            </div>

            {/* ✅ Événements similaires pour le maillage interne SEO */}
            <RelatedEvents event={event} limit={4} />

            {/* ✅ Bloc "Pourquoi visiter" en bas de page */}
            <EventWhyVisit event={event} />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};
