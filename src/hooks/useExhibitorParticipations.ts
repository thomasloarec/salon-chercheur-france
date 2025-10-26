import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExhibitorParticipation {
  id: string;
  stand: string | null;
  hall: string | null;
  event: {
    id: string;
    nom_event: string;
    slug: string;
    date_debut: string;
    date_fin: string;
    ville: string;
  };
}

/**
 * Hook pour récupérer toutes les participations d'un exposant aux événements à venir
 */
export const useExhibitorParticipations = (exhibitorId: string) => {
  return useQuery({
    queryKey: ['exhibitor-participations', exhibitorId],
    queryFn: async (): Promise<ExhibitorParticipation[]> => {
      if (!exhibitorId) return [];

      // Récupérer le nom de l'exposant pour faire la correspondance
      const { data: exhibitor } = await supabase
        .from('exhibitors')
        .select('id, name')
        .eq('id', exhibitorId)
        .single();

      if (!exhibitor) return [];

      // Récupérer toutes les participations via la vue participations_with_exhibitors
      const { data: participations, error } = await supabase
        .from('participations_with_exhibitors')
        .select('*')
        .ilike('exhibitor_name', exhibitor.name);

      if (error) {
        console.error('Error fetching participations:', error);
        return [];
      }

      if (!participations || participations.length === 0) {
        return [];
      }

      // Récupérer les détails des événements associés
      const eventIds = participations
        .map(p => p.id_event)
        .filter((id): id is string => id !== null);

      if (eventIds.length === 0) return [];

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, nom_event, slug, date_debut, date_fin, ville')
        .in('id', eventIds)
        .gte('date_debut', new Date().toISOString().split('T')[0])
        .eq('visible', true)
        .order('date_debut', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return [];
      }

      // Mapper les participations avec les événements
      return participations
        .map(p => {
          const event = events?.find(e => e.id === p.id_event);
          if (!event) return null;

          return {
            id: p.id_participation as string,
            stand: p.stand_exposant,
            hall: null, // hall n'existe pas dans la table actuelle
            event: {
              id: event.id,
              nom_event: event.nom_event,
              slug: event.slug,
              date_debut: event.date_debut,
              date_fin: event.date_fin,
              ville: event.ville,
            },
          };
        })
        .filter((p): p is ExhibitorParticipation => p !== null);
    },
    enabled: !!exhibitorId,
    staleTime: 300_000, // 5 minutes
  });
};
