import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Le Fil du Salon — accès données côté organisateur.
 *
 * Toute lecture passe par la RPC SECURITY DEFINER get_event_feed_admin, gardée
 * en base par is_event_owner() OR is_admin(). Toute écriture passe par
 * l'Edge Function event-update-manage. La table event_updates n'a AUCUNE policy
 * RLS pour anon/authenticated : un accès direct via supabase.from() renverrait
 * systématiquement zéro ligne. Ne tente jamais de la contourner.
 *
 * Les types Supabase générés ne connaissent pas encore ces RPC. Le cast est
 * volontairement confiné à ce fichier.
 */

export interface FeedUpdateAdmin {
  update_id: string;
  message: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  cta_type: string;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string | null;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  is_expired: boolean;
  impressions: number;
  feed_opens: number;
  cta_clicks: number;
}

export function useEventFeedAdmin(eventId?: string | null) {
  return useQuery({
    queryKey: ['event-feed-admin', eventId],
    enabled: !!eventId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<FeedUpdateAdmin[]> => {
      const { data, error } = await (supabase.rpc as any)('get_event_feed_admin', {
        p_event_id: eventId as string,
      });
      if (error) throw error;
      return (data ?? []) as FeedUpdateAdmin[];
    },
  });
}

export interface FeedComposerData {
  message: string;
  category: string;
  cta_type: string;
  cta_label?: string | null;
  cta_url?: string | null;
  expires_at?: string | null;
}

type ManageBody = Record<string, unknown>;

/**
 * Appel unique vers event-update-manage.
 * L'Edge Function renvoie soit { ok: true, ... }, soit { error, message } avec
 * un statut HTTP non 2xx. On remonte le message métier tel quel : il est écrit
 * en français et destiné à l'organisateur.
 */
async function invokeManage(body: ManageBody): Promise<any> {
  const { data, error } = await supabase.functions.invoke('event-update-manage', { body });
  if (error) {
    // Le corps de la réponse d'erreur porte le message utile.
    const detail = (error as any)?.context?.body;
    if (detail) {
      try {
        const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail;
        if (parsed?.message) throw new Error(parsed.message);
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
    throw error;
  }
  if (data?.error) throw new Error(data.message || data.error);
  return data;
}

export function useEventFeedActions(eventId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['event-feed-admin', eventId] });

  return {
    refresh,
    create: async (data: FeedComposerData, publish: boolean) => {
      const res = await invokeManage({
        action: 'update.create',
        event_id: eventId,
        publish,
        data,
      });
      await refresh();
      return res;
    },
    update: async (updateId: string, data: FeedComposerData) => {
      const res = await invokeManage({
        action: 'update.update',
        event_id: eventId,
        update_id: updateId,
        data,
      });
      await refresh();
      return res;
    },
    publish: async (updateId: string) => {
      const res = await invokeManage({
        action: 'update.publish',
        event_id: eventId,
        update_id: updateId,
      });
      await refresh();
      return res;
    },
    archive: async (updateId: string) => {
      const res = await invokeManage({
        action: 'update.archive',
        event_id: eventId,
        update_id: updateId,
      });
      await refresh();
      return res;
    },
  };
}
