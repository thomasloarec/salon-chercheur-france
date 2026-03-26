
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useInvalidateEvents } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { convertSecteurToString } from '@/utils/sectorUtils';
import type { Event } from '@/types/event';
import { EventPageContent } from '@/components/event/EventPageContent';

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const invalidateEvents = useInvalidateEvents();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const fetchEvent = async () => {
      if (!slug) {
        setError('Slug manquant');
        setLoading(false);
        return;
      }

      // Reset state at start of each fetch to prevent stale error/loading
      setError(null);
      setLoading(true);

      console.log('🔍 Searching for event with slug:', slug);
      
      try {
        let eventData: any = null;
        let fetchError: any = null;

        // ✅ PRIORITÉ : Chercher par UUID d'abord (si slug ressemble à un UUID)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        
        if (isUUID) {
          console.log('🆔 Trying UUID lookup first:', slug);
          let query = supabase
            .from('events')
            .select('*')
            .eq('id', slug);

          if (!isAdmin && !isPreview) {
            query = query.eq('visible', true);
          }

          const { data, error } = await query.maybeSingle();
          eventData = data;
          fetchError = error;
          
          if (eventData) {
            console.log('✅ Found by UUID:', eventData);
          }
        }

        // ✅ FALLBACK : Chercher par slug si pas trouvé par UUID
        if (!eventData && !fetchError) {
          console.log('🔗 Fallback to slug lookup:', slug);
          let query = supabase
            .from('events')
            .select('*')
            .eq('slug', slug);

          if (!isAdmin && !isPreview) {
            query = query.eq('visible', true);
          }

          const { data, error } = await query.maybeSingle();
          eventData = data;
          fetchError = error;
          
          if (eventData) {
            console.log('✅ Found by slug:', eventData);
          }
        }

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
        
        // Vérifier si c'est un favori pour l'utilisateur connecté
        let isFavorite = false;
        if (user && eventData) {
          const { data: favoriteData } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_uuid', eventData.id)
            .maybeSingle();
          isFavorite = !!favoriteData;
        }
        
        const typedEvent: Event = {
          id: eventData.id,
          id_event: eventData.id_event,
          nom_event: eventData.nom_event || '',
          description_event: eventData.description_event,
          date_debut: eventData.date_debut,
          date_fin: eventData.date_fin,
          secteur: convertSecteurToString(eventData.secteur),
          nom_lieu: eventData.nom_lieu,
          ville: eventData.ville,
          country: eventData.pays,
          url_image: eventData.url_image,
          url_site_officiel: eventData.url_site_officiel,
          tags: [],
          tarif: eventData.tarif,
          affluence: eventData.affluence,
          estimated_exhibitors: undefined,
          is_b2b: eventData.is_b2b,
          type_event: eventData.type_event as Event['type_event'],
          created_at: eventData.created_at,
          updated_at: eventData.updated_at,
          last_scraped_at: undefined,
          scraped_from: undefined,
          rue: eventData.rue,
          code_postal: eventData.code_postal,
          visible: eventData.visible,
          slug: eventData.slug,
          sectors: [],
          is_favorite: isFavorite,
          // SEO enrichment fields
          meta_description_gen: eventData.meta_description_gen,
          faq_json: eventData.faq_json,
          enrichissement_score: eventData.enrichissement_score,
          enrichissement_statut: eventData.enrichissement_statut,
          enrichissement_date: eventData.enrichissement_date,
        };
        
        setEvent(typedEvent);

      } catch (error) {
        console.error('❌ Unexpected error:', error);
        setError('Une erreur inattendue s\'est produite');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug, user, isAdmin, isPreview]);

  const handleEventUpdated = async (refreshedEvent: Event, slugChanged?: boolean) => {
    console.log('🔄 Event updated:', refreshedEvent);
    
    setEvent(refreshedEvent);
    invalidateEvents();
    queryClient.invalidateQueries({ queryKey: ['event-sectors', refreshedEvent.id] });
    
    if (slugChanged && refreshedEvent.slug) {
      console.log('🔄 Redirecting to new slug:', refreshedEvent.slug);
      navigate(`/events/${refreshedEvent.slug}`, { replace: true });
    }
  };

  const handleEventDeleted = () => {
    console.log('🗑️ Event deleted, invalidating cache and redirecting');
    invalidateEvents();
    queryClient.invalidateQueries({ queryKey: ['events-import-pending-staging'] });
    queryClient.invalidateQueries({ queryKey: ['events-hidden'] });
    navigate('/events');
  };

  const handlePublish = async () => {
    if (!event) return;

    try {
      const { error } = await supabase
        .from('events')
        .update({ visible: true })
        .eq('id', event.id);  // Utiliser l'UUID

      if (error) throw error;

      toast.success('Événement publié !');
      setEvent({ ...event, visible: true });
      
      // Invalider tous les caches pertinents
      invalidateEvents();
      queryClient.invalidateQueries({ queryKey: ['events-import-pending-staging'] });
      queryClient.invalidateQueries({ queryKey: ['events-hidden'] });
      
      navigate(`/events/${event.slug}`, { replace: true });
      
    } catch (error) {
      console.error('Error publishing event:', error);
      toast.error('Erreur lors de la publication');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-600">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Événement introuvable
            </h1>
            <p className="text-lg text-gray-600 mt-4">
              {error || 'L\'événement que vous recherchez n\'existe pas ou a été supprimé.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EventPageContent
      event={event}
      isPreview={isPreview}
      onEventUpdated={handleEventUpdated}
      onEventDeleted={handleEventDeleted}
    />
  );
};

export default EventPage;
