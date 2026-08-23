import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lot 4 — Section Programme publique de la page salon.
 *
 * Consomme UNIQUEMENT les deux RPC en lecture seule déployées au lot 3
 * (get_public_event_program, get_event_program_count). Le tri
 * jour → heure → position est fait côté SQL ; le client ne regroupe
 * que pour l'affichage. Aucun fallback sur les nouveautés ou autre
 * source : sans sessions, la section est simplement masquée en amont.
 */

export interface ProgramSpeaker {
  id: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  role: string | null;
}

export interface ProgramSession {
  session_id: string;
  title: string | null;
  description: string | null;
  session_type: string | null;
  day_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  track: string | null;
  language: string | null;
  is_highlight: boolean | null;
  registration_url: string | null;
  session_position: number | null;
  status: string | null;
  speakers: ProgramSpeaker[] | null;
}

export function useEventProgram(eventId?: string | null) {
  return useQuery({
    queryKey: ['event-program', eventId],
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProgramSession[]> => {
      const { data, error } = await supabase.rpc('get_public_event_program', {
        p_event_id: eventId as string,
      });
      if (error) throw error;
      return (data ?? []) as unknown as ProgramSession[];
    },
  });
}

export function useEventProgramCount(eventId?: string | null) {
  return useQuery({
    queryKey: ['event-program-count', eventId],
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_event_program_count', {
        p_event_id: eventId as string,
      });
      if (error) throw error;
      return data ?? 0;
    },
  });
}
