import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type RelatedEvent = {
  id: string;
  id_event: string;
  slug: string;
  nom_event: string;
  date_debut: string;
  date_fin: string | null;
  url_image: string | null;
  nom_lieu: string | null;
  ville: string | null;
  sectors: string[]; // UUIDs
  shared_sectors_count: number;
};

export function useRelatedEvents(eventId: string | null, limit = 6) {
  const [data, setData] = useState<RelatedEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!eventId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchRelatedEvents() {
      if (!eventId) {
        setData([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: relatedEvents, error: rpcError } = await supabase.rpc('related_events', {
          p_event_id: eventId,
          p_limit: limit
        });

        if (!mounted) return;

        if (rpcError) {
          console.error('Error fetching related events:', rpcError);
          setError(rpcError.message);
          setData([]);
        } else {
          setData(relatedEvents ?? []);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        setData([]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchRelatedEvents();

    return () => {
      mounted = false;
    };
  }, [eventId, limit]);

  return { data, isLoading, error };
}