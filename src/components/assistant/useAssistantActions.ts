import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';
import type { AssistantItem } from './types';

const ERROR_MSG = 'Action impossible pour le moment. Réessayez.';
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);
const parse = (d: any) => (typeof d === 'string' ? JSON.parse(d) : d) ?? {};

export type NotForMeReason = null | 'sujet' | 'secteur' | 'trop_general';
export type WontGoReason = 'pas_disponible' | 'trop_loin' | 'pas_interesse';

export function useAssistantActions(options: { onProposeDistance?: () => void } = {}) {
  const { onProposeDistance } = options;
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidateOthers = useCallback(() => {
    ['favorites', 'favorite-events', 'liked-novelties'].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    );
  }, [qc]);

  const invalidateFeed = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['assistant-feed'] });
  }, [qc]);

  const invalidateAll = useCallback(() => {
    invalidateFeed();
    invalidateOthers();
  }, [invalidateFeed, invalidateOthers]);

  const fail = useCallback(
    (err: unknown) => {
      console.error('Assistant action error:', err);
      toast({ title: ERROR_MSG, variant: 'destructive' });
    },
    [toast],
  );

  const undoAction = (onClick: () => void) =>
    React.createElement(ToastAction, { altText: 'Annuler', onClick }, 'Annuler') as unknown as ToastActionElement;

  const undoFeedback = useCallback(
    async (feedbackId: string) => {
      try {
        const { error } = await rpc('assistant_undo_feedback', { p_feedback_id: feedbackId });
        if (error) throw error;
        toast({ title: 'Annulé.' });
        invalidateAll();
      } catch (e) {
        fail(e);
      }
    },
    [toast, invalidateAll, fail],
  );

  const removeFromAgenda = useCallback(
    async (item: AssistantItem, silent = false) => {
      try {
        const { data, error } = await rpc('assistant_remove_from_agenda', {
          p_item_type: item.item_type,
          p_item_id: item.item_id,
        });
        if (error) throw error;
        const res = parse(data);
        toast({ title: silent ? 'Annulé.' : res.message ?? 'Retiré.' });
        invalidateAll();
        return res;
      } catch (e) {
        fail(e);
      }
    },
    [toast, invalidateAll, fail],
  );

  const addToAgenda = useCallback(
    async (item: AssistantItem) => {
      try {
        const { data, error } = await rpc('assistant_add_to_agenda', {
          p_item_type: item.item_type,
          p_item_id: item.item_id,
        });
        if (error) throw error;
        const res = parse(data);
        toast({
          title: res.message,
          action: undoAction(() => void removeFromAgenda(item, true)),
        });
        invalidateAll();
        return res;
      } catch (e) {
        fail(e);
      }
    },
    [toast, invalidateAll, fail, removeFromAgenda],
  );

  const notForMe = useCallback(
    async (item: AssistantItem, reason: NotForMeReason, profileId: string) => {
      try {
        const { data, error } = await rpc('assistant_record_feedback', {
          p_profile_id: profileId,
          p_signal: 'pas_pour_moi',
          p_reason: reason,
          p_item_type: item.item_type,
          p_item_id: item.item_id,
          p_event_id: null,
          p_source: 'app',
          p_sector_id: reason === 'secteur' ? item.sector?.id ?? null : null,
        });
        if (error) throw error;
        const res = parse(data);
        toast({
          title: res.message,
          action: res.feedback_id ? undoAction(() => void undoFeedback(res.feedback_id)) : undefined,
        });
        // Le fil n'est pas invalidé ici : la carte reste repliée le temps de choisir une raison.
        invalidateOthers();
        return res as { feedback_id: string; message: string; generalisation: string | null };
      } catch (e) {
        fail(e);
      }
    },
    [toast, invalidateOthers, fail, undoFeedback],
  );

  const wontGo = useCallback(
    async (eventId: string, reason: WontGoReason, profileId: string) => {
      try {
        const { data, error } = await rpc('assistant_record_feedback', {
          p_profile_id: profileId,
          p_signal: 'je_n_irai_pas',
          p_reason: reason,
          p_item_type: null,
          p_item_id: null,
          p_event_id: eventId,
          p_source: 'app',
          p_sector_id: null,
        });
        if (error) throw error;
        const res = parse(data);
        if (res.propose_distance) {
          toast({
            title: res.message,
            action: onProposeDistance
              ? React.createElement(
                  ToastAction,
                  { altText: 'Choisir mes régions', onClick: onProposeDistance },
                  'Choisir mes régions',
                ) as unknown as ToastActionElement
              : undefined,
          });
        } else {
          toast({
            title: res.message,
            action: res.feedback_id ? undoAction(() => void undoFeedback(res.feedback_id)) : undefined,
          });
        }
        invalidateAll();
        return res;
      } catch (e) {
        fail(e);
      }
    },
    [toast, invalidateAll, fail, undoFeedback, onProposeDistance],
  );

  const addEventToAgenda = useCallback(
    async (eventId: string) => {
      try {
        const { data, error } = await rpc('assistant_add_event_to_agenda', { p_event_id: eventId });
        if (error) throw error;
        const res = parse(data);
        toast({ title: res.message });
        invalidateAll();
        return res;
      } catch (e) {
        fail(e);
      }
    },
    [toast, invalidateAll, fail],
  );

  const silentSignal = useCallback(
    async (item: AssistantItem, signal: 'inscription' | 'rdv', profileId: string) => {
      try {
        const { error } = await rpc('assistant_record_feedback', {
          p_profile_id: profileId,
          p_signal: signal,
          p_reason: null,
          p_item_type: item.item_type,
          p_item_id: item.item_id,
          p_event_id: null,
          p_source: 'app',
          p_sector_id: null,
        });
        if (error) throw error;
        invalidateAll();
      } catch (e) {
        console.error('Assistant signal error:', e);
      }
    },
    [invalidateAll],
  );

  const register = useCallback(
    async (item: AssistantItem, profileId: string) => {
      const url = item.session?.registration_url;
      if (url) window.open(url, '_blank', 'noopener');
      await silentSignal(item, 'inscription', profileId);
    },
    [silentSignal],
  );

  const meetingIntent = useCallback(
    (item: AssistantItem, profileId: string) => silentSignal(item, 'rdv', profileId),
    [silentSignal],
  );

  return {
    addToAgenda,
    removeFromAgenda,
    notForMe,
    wontGo,
    addEventToAgenda,
    register,
    meetingIntent,
    undoFeedback,
    invalidateFeed,
  };
}
