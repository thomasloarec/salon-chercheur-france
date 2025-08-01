
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateEvents } from '@/hooks/useEvents';
import { useQueryClient } from '@tanstack/react-query';
import { EventPageHeader } from '@/components/event/EventPageHeader';
import { EventAbout } from '@/components/event/EventAbout';
import { EventExhibitorsSection } from '@/components/event/EventExhibitorsSection';
import { EventExhibitorsSectionFallback } from '@/components/event/EventExhibitorsSectionFallback';
import { EventSidebar } from '@/components/event/EventSidebar';
import { SEOHead } from '@/components/event/SEOHead';
import { EventAdminMenu } from '@/components/event/EventAdminMenu';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
  const { user } = useAuth();
  
  console.log('🔍 EventPageContent - rendered, user:', user ? 'connected' : 'anonymous', 'event:', event.nom_event);
  console.log('🔍 EventPageContent - hostname:', window.location.hostname);
  console.log('🔍 EventPageContent - isProduction:', window.location.hostname.includes('lotexpo.com'));
  
  const invalidateEvents = useInvalidateEvents();
  const queryClient = useQueryClient();
  const [crmProspects] = useState<Array<{ name: string; stand?: string }>>([
    { name: 'Entreprise A', stand: 'A12' },
    { name: 'Entreprise B', stand: 'B15' },
  ]);
  
  // Detection environment de production
  const isProduction = window.location.hostname.includes('lotexpo.com');
  
  useEffect(() => {
    console.log('🔍 EventPageContent - useEffect triggered, environment:', isProduction ? 'PRODUCTION' : 'DEV');
  }, []);

  const isAdmin = user?.email === 'admin@salonspro.com';

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
        
        <main className="py-8">
          <div className="w-full px-6 mx-auto space-y-8">
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
            
            <EventPageHeader event={event} crmProspects={crmProspects} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Colonne principale */}
              <div className="lg:col-span-2 space-y-8">
                <EventAbout event={event} />
                
                {/* Section des exposants avec fallback pour le bouton CRM */}
                <EventExhibitorsSection event={event} />
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
