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
export const useExhibitorParticipations = (exhibitorId: string, exhibitorName?: string) => {
  return useQuery({
    queryKey: ['exhibitor-participations', exhibitorId, exhibitorName],
    queryFn: async (): Promise<ExhibitorParticipation[]> => {
      if (!exhibitorId && !exhibitorName) return [];

      let searchName = exhibitorName;

      // Si on n'a pas le nom, essayer de le récupérer depuis la table exhibitors
      if (!searchName && exhibitorId) {
        const { data: exhibitor } = await supabase
          .from('exhibitors')
          .select('id, name')
          .eq('id', exhibitorId)
          .maybeSingle();

        if (exhibitor) {
          searchName = exhibitor.name;
        }
      }

      // Si toujours pas de nom, retourner vide
      if (!searchName) {
        console.warn('[useExhibitorParticipations] No name found for exhibitor', exhibitorId);
        return [];
      }

      // Récupérer toutes les participations via la vue participations_with_exhibitors
      const { data: participations, error } = await supabase
        .from('participations_with_exhibitors')
        .select('*')
        .ilike('exhibitor_name', searchName);

      if (error) {
        console.error('Error fetching participations:', error);
        return [];
      }

      if (!participations || participations.length === 0) {
        return [];
      }

      // Récupérer les détails des événements associés (tous les événements, pas seulement futurs pour debug)
      const eventIds = participations
        .map(p => p.id_event)
        .filter((id): id is string => id !== null);

      if (eventIds.length === 0) return [];

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, nom_event, slug, date_debut, date_fin, ville')
        .in('id', eventIds)
        .eq('visible', true)
        .order('date_debut', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return [];
      }

      // Mapper les participations avec les événements
      const allParticipations = participations
        .map(p => {
          const event = events?.find(e => e.id === p.id_event);
          if (!event) return null;

          return {
            id: p.id_participation as string,
            stand: p.stand_exposant,
            hall: null,
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

      // Filtrer uniquement les événements à venir
      const today = new Date().toISOString().split('T')[0];
      return allParticipations.filter(p => p.event.date_debut >= today);
    },
    enabled: !!(exhibitorId || exhibitorName),
    staleTime: 300_000, // 5 minutes
  });
};
