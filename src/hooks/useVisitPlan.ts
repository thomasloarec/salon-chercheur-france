import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface VisitPlan {
  id: string;
  user_id: string;
  event_id: string;
  role: string | null;
  objectif: string | null;
  keywords: string[] | null;
  duration: string | null;
  prioritaires: any[];
  optionnels: any[];
  created_at: string;
  updated_at: string;
}

export function useVisitPlan(eventId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['visit-plan', eventId, user?.id],
    queryFn: async () => {
      if (!user || !eventId) return null;
      const { data, error } = await supabase
        .from('visit_plans' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .maybeSingle();
      if (error) {
        console.error('Error fetching visit plan:', error);
        return null;
      }
      return data as unknown as VisitPlan | null;
    },
    enabled: !!user && !!eventId,
  });
}

export function useVisitPlansForUser() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['visit-plans', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('visit_plans' as any)
        .select('*')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error fetching visit plans:', error);
        return [];
      }
      return (data || []) as unknown as VisitPlan[];
    },
    enabled: !!user,
  });
}

export function useSaveVisitPlan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (plan: {
      event_id: string;
      role: string;
      objectif: string;
      keywords: string[];
      duration: string;
      prioritaires: any[];
      optionnels: any[];
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('visit_plans' as any)
        .upsert(
          {
            user_id: user.id,
            event_id: plan.event_id,
            role: plan.role,
            objectif: plan.objectif,
            keywords: plan.keywords,
            duration: plan.duration,
            prioritaires: plan.prioritaires,
            optionnels: plan.optionnels,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,event_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visit-plan', variables.event_id] });
      queryClient.invalidateQueries({ queryKey: ['visit-plans'] });
    },
  });
}

// Store pending visit plan in localStorage for unauthenticated users
export function storePendingVisitPlan(plan: {
  event_id: string;
  event_slug: string;
  role: string;
  objectif: string;
  keywords: string[];
  duration: string;
  prioritaires: any[];
  optionnels: any[];
}) {
  localStorage.setItem('pending_visit_plan', JSON.stringify(plan));
}

export function getPendingVisitPlan() {
  const raw = localStorage.getItem('pending_visit_plan');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingVisitPlan() {
  localStorage.removeItem('pending_visit_plan');
}
