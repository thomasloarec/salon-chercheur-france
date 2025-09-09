
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

const transformEventData = (data: any, source: 'events' | 'staging_events_import'): Event => {
  const isImport = source === 'staging_events_import';
  
  return {
    id: isImport ? data.id : data.id,
    id_event: data.id_event,
    nom_event: data.nom_event || '',
    description_event: data.description_event,
    date_debut: data.date_debut || '1970-01-01',
    date_fin: data.date_fin || data.date_debut || '1970-01-01',
    secteur: convertSecteurToString(data.secteur || 'Autre'),
    nom_lieu: data.nom_lieu,
    ville: data.ville || 'Ville non précisée',
    country: isImport ? 'France' : (data.pays || 'France'),
    url_image: data.url_image,
    url_site_officiel: data.url_site_officiel,
    tags: [],
    tarif: data.tarif,
    affluence: isImport ? data.affluence : (data.affluence ? String(data.affluence) : undefined),
    estimated_exhibitors: undefined,
    is_b2b: isImport ? true : (data.is_b2b || false),
    type_event: (data.type_event as Event['type_event']) || 'salon',
    created_at: data.created_at,
    updated_at: data.updated_at,
    last_scraped_at: undefined,
    scraped_from: undefined,
    rue: data.rue,
    code_postal: data.code_postal,
    visible: isImport ? false : (data.visible ?? true),
    slug: isImport ? `pending-${data.id}` : (data.slug || `event-${data.id}`),
    sectors: [],
    is_favorite: false
  };
};

const AdminEventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Move all hooks to the top, before any conditional logic
  const isAdmin = user?.email === 'admin@lotexpo.com';
  
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['admin-event-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID manquant');
      
      // 1️⃣ PRIORITÉ : events (UUID)
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (eventsData) {
        return transformEventData(eventsData, 'events');
      }

      // 2️⃣ FALLBACK : staging_events_import (TEXT)
      const { data: importData, error } = await supabase
        .from('staging_events_import')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!importData) throw new Error('Événement introuvable');

      return transformEventData(importData, 'staging_events_import');
    },
    enabled: !!id && !!user && isAdmin, // Add conditions here instead of early returns
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Now handle conditional rendering after all hooks are called
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

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

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
