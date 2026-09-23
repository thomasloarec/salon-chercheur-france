import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Onglet « Rendez-vous » de l'espace exposant (lot 3, page d'invitation).
 * Source unique : RPC get_exhibitor_leads (SECURITY DEFINER), qui renvoie les
 * demandes de rendez-vous ET les téléchargements de brochure d'UN exposant,
 * avec le floutage déjà calculé côté serveur (décision D1).
 */

export type LeadOrigin = 'invitation_page' | 'novelty' | 'visitor_journey';

export interface ExhibitorLead {
  id: string;
  lead_type: 'meeting_request' | 'resource_download';
  origin: LeadOrigin;
  status: string;
  created_at: string;
  event_id: string | null;
  event_name: string | null;
  event_slug: string | null;
  novelty_id: string | null;
  novelty_title: string | null;
  preferred_slot: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  masked: boolean;
}

export const exhibitorLeadsKey = (exhibitorId?: string) => ['exhibitor-leads', exhibitorId] as const;

export function useExhibitorLeads(exhibitorId?: string) {
  return useQuery({
    queryKey: exhibitorLeadsKey(exhibitorId),
    queryFn: async (): Promise<ExhibitorLead[]> => {
      // Cast : RPC ajoutée au lot 1, absente des types générés.
      const { data, error } = await supabase.rpc(
        'get_exhibitor_leads' as never,
        { p_exhibitor_id: exhibitorId } as never,
      );
      if (error) throw error;
      return (data ?? []) as unknown as ExhibitorLead[];
    },
    enabled: !!exhibitorId,
    staleTime: 30_000,
  });
}

export function useSetLeadStatus(exhibitorId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'new' | 'contacted' }) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      // Garde anti-échec silencieux : une mise à jour bloquée par la RLS
      // renvoie 0 ligne sans erreur.
      if (!data || data.length === 0) throw new Error('update_blocked');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exhibitorLeadsKey(exhibitorId) });
      queryClient.invalidateQueries({ queryKey: ['exhibitor-meeting-requests'] });
    },
  });
}
