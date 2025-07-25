
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { convertSecteurToString } from '@/utils/sectorUtils';
import { formatAddress } from '@/utils/formatAddress';
import type { Event } from '@/types/event';
import { AdminEventWrapper } from '@/components/admin/AdminEventWrapper';
import { EventPageContent } from '@/components/event/EventPageContent';

const AdminEventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.email === 'admin@salonspro.com';

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['admin-event-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID manquant');
      
      // Try to find the event in events_import first (pending events)
      const { data: importData, error: importError } = await supabase
        .from('events_import')
        .select('*')
        .eq('id_event', id)
        .maybeSingle();

      if (importData) {
        // Use existing rue/code_postal fields directly from events_import
        let rue = importData.rue || '';
        let codePostal = importData.code_postal || '';
        let ville = importData.ville || '';
        
        // Transform events_import data to Event format
        const transformedEvent: Event = {
          id: importData.id_event,
          nom_event: importData.nom_event || '',
          description_event: importData.description_event,
          date_debut: importData.date_debut || '1970-01-01',
          date_fin: importData.date_fin || importData.date_debut || '1970-01-01',
          secteur: convertSecteurToString(importData.secteur || 'Autre'),
          nom_lieu: importData.nom_lieu,
          ville: ville || 'Ville non précisée',
          country: 'France',
          url_image: importData.url_image,
          url_site_officiel: importData.url_site_officiel,
          tags: [],
          tarif: importData.tarif,
          affluence: importData.affluence || undefined,
          estimated_exhibitors: undefined,
          is_b2b: true,
          type_event: (importData.type_event as Event['type_event']) || 'salon',
          created_at: (importData as any).created_at,
          updated_at: (importData as any).updated_at,
          last_scraped_at: undefined,
          scraped_from: undefined,
          rue: rue,
          code_postal: codePostal,
          visible: false,
          slug: `pending-${importData.id_event}`,
          sectors: [],
          is_favorite: false
        };

        return transformedEvent;
      }

      // If not found in events_import, try the events table
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('id_event', id)
        .single();

      if (eventsError) throw eventsError;
      
      // Transform events data to Event format
      const transformedEvent: Event = {
        id: eventsData.id_event,
        nom_event: eventsData.nom_event || '',
        description_event: eventsData.description_event,
        date_debut: eventsData.date_debut || '1970-01-01',
        date_fin: eventsData.date_fin || eventsData.date_debut || '1970-01-01',
        secteur: convertSecteurToString(eventsData.secteur || 'Autre'),
        nom_lieu: eventsData.nom_lieu,
        ville: eventsData.ville || 'Ville non précisée',
        country: eventsData.pays || 'France',
        url_image: eventsData.url_image,
        url_site_officiel: eventsData.url_site_officiel,
        tags: [],
        tarif: eventsData.tarif,
        affluence: eventsData.affluence ? String(eventsData.affluence) : undefined,
        estimated_exhibitors: undefined,
        is_b2b: eventsData.is_b2b || false,
        type_event: (eventsData.type_event as Event['type_event']) || 'salon',
        created_at: eventsData.created_at,
        updated_at: eventsData.updated_at,
        last_scraped_at: undefined,
        scraped_from: undefined,
        rue: eventsData.rue,
        code_postal: eventsData.code_postal,
        visible: eventsData.visible ?? true,
        slug: eventsData.slug || `event-${eventsData.id_event}`,
        sectors: [],
        is_favorite: false
      };

      return transformedEvent;
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const handleEventUpdated = (refreshedEvent: Event, slugChanged?: boolean) => {
    console.log('Event updated in admin:', refreshedEvent);
    
    // Invalider et refetcher les données immédiatement
    queryClient.invalidateQueries({ queryKey: ['admin-event-detail', id] });
    queryClient.refetchQueries({ queryKey: ['admin-event-detail', id] });
    
    // Optionnel : rediriger vers la page d'événement publié si publié
    if (refreshedEvent.visible && refreshedEvent.slug) {
      navigate(`/events/${refreshedEvent.slug}`);
    }
  };

  const handleEventDeleted = () => {
    console.log('Event deleted, returning to admin');
    navigate('/admin');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement de l'événement...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            {error ? 'Erreur de chargement' : 'Événement introuvable'}
          </h1>
          <p className="text-gray-600 mb-6">
            {error ? 'Une erreur s\'est produite lors du chargement de l\'événement.' : 'L\'événement demandé n\'existe pas ou a été supprimé.'}
          </p>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Retour à l'administration
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminEventWrapper>
      <EventPageContent
        event={event}
        isPreview={true}
        onEventUpdated={handleEventUpdated}
        onEventDeleted={handleEventDeleted}
      />
    </AdminEventWrapper>
  );
};

export default AdminEventDetail;
