
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EventExhibitors } from './EventExhibitors';
import type { Event } from '@/types/event';

interface Exhibitor {
  name: string;
  stand?: string;
  website?: string;
}

interface EventExhibitorsSectionProps {
  event: Event;
}

export const EventExhibitorsSection = ({ event }: EventExhibitorsSectionProps) => {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExhibitors = async () => {
      if (!event.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch exposants sans aucune condition de filtrage sur le statut
        let { data, error } = await supabase
          .from('exposants')
          .select('*')
          .eq('id_event', event.id_event || event.id);

        // Si pas de résultats avec id_event, essayer avec l'id principal
        if ((!data || data.length === 0) && event.id_event) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('exposants')
            .select('*')
            .eq('id_event', event.id);
          
          if (!fallbackError) {
            data = fallbackData;
            error = fallbackError;
          }
        }

        if (error) {
          console.error('Error fetching exhibitors:', error);
          setExhibitors([]);
        } else {
          console.log('📤 Exposants chargés:', data?.length || 0);
          
          const mappedExhibitors: Exhibitor[] = (data || []).map(exp => ({
            name: exp.exposant_nom || 'Nom non disponible',
            stand: exp.exposant_stand || undefined,
            website: exp.exposant_website || undefined
          }));
          
          setExhibitors(mappedExhibitors);
        }
      } catch (error) {
        console.error('Unexpected error fetching exhibitors:', error);
        setExhibitors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExhibitors();
  }, [event.id, event.id_event]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  // Si aucun exposant trouvé, affichage du placeholder
  if (exhibitors.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center">
          Exposants
        </h3>
        <p className="text-gray-500 italic">
          Exposants inconnus pour cet événement
        </p>
      </div>
    );
  }

  // Utiliser le composant EventExhibitors existant
  return <EventExhibitors exhibitors={exhibitors} />;
};
