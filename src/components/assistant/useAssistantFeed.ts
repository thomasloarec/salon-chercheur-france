import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AssistantFeed } from './types';

/** Lecture du fil de l'assistant. Basé sur la session (une session anonyme a user = null). */
export function useAssistantFeed() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['assistant-feed', session?.user?.id],
    enabled: !!session,
    refetchInterval: (query) => (query.state.data?.status?.refreshing ? 15000 : false),
    queryFn: async (): Promise<AssistantFeed> => {
      const { data, error } = await (supabase as any).rpc('assistant_my_feed');
      if (error) throw error;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return (parsed ?? { has_profile: false }) as AssistantFeed;
    },
  });
}
