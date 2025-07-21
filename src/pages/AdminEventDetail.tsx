
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
      
      const { data, error } = await supabase
        .from('events_import')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Améliorer l'extraction de l'adresse depuis le champ 'adresse'
      let rue = '';
      let codePostal = '';
      let ville = data.ville || '';
      
      if (data.adresse) {
        // Extraire le code postal (5 chiffres)
        const codePostalMatch = data.adresse.match(/(\d{5})/);
        if (codePostalMatch) {
          codePostal = codePostalMatch[1];
        }
        
        // Extraire la rue (tout ce qui précède le code postal)
        if (codePostal) {
          rue = data.adresse.split(codePostal)[0].trim();
          // Nettoyer la rue en supprimant les virgules finales
          rue = rue.replace(/[,\s]+$/, '');
          
          // Extraire la ville (tout ce qui suit le code postal)
          const villeFromAddress = data.adresse.split(codePostal)[1];
          if (villeFromAddress) {
            ville = villeFromAddress.replace(/^[,\s]+/, '').trim();
          }
        } else {
          // Si pas de code postal trouvé, prendre toute l'adresse comme rue
          rue = data.adresse.trim();
        }
      }
      
      // Utiliser les champs individuels rue/code_postal s'ils existent
      if (data.rue && data.rue.trim()) {
        rue = data.rue.trim();
      }
      if (data.code_postal && data.code_postal.trim()) {
        codePostal = data.code_postal.trim();
      }
      
      // Transformer les données de events_import vers le format Event
      const transformedEvent: Event = {
        id: data.id,
        nom_event: data.nom_event || '',
        description_event: data.description_event,
        date_debut: data.date_debut || '1970-01-01',
        date_fin: data.date_fin || data.date_debut || '1970-01-01',
        secteur: convertSecteurToString(data.secteur || 'Autre'),
        nom_lieu: data.nom_lieu,
        ville: ville || 'Ville non précisée',
        country: 'France',
        url_image: data.url_image,
        url_site_officiel: data.url_site_officiel,
        tags: [],
        tarif: data.tarif,
        affluence: data.affluence ? parseInt(data.affluence) : null,
        estimated_exhibitors: null,
        is_b2b: true,
        type_event: (data.type_event as Event['type_event']) || 'salon',
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_scraped_at: null,
        scraped_from: null,
        rue: rue,
        code_postal: codePostal,
        visible: false,
        slug: `pending-${data.id}`,
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
