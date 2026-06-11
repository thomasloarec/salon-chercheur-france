import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 4A-C — Données et mutations pour l'édition owner de la fiche
 * exposant. UNIQUEMENT les 4 champs publics autorisés.
 */

export interface ExhibitorEditableFields {
  exhibitor_id: string;
  /** CHAMP ÉDITORIAL HUMAIN BRUT — jamais ai_summary ni fallback legacy. */
  description: string | null;
  website: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
}

/**
 * Récupère les champs éditoriaux BRUTS depuis exhibitors via l'action
 * read-only `get_editable` de l'edge function (autorisation gestionnaire).
 *
 * CRITIQUE : la `description` renvoyée provient directement de
 * exhibitors.description. On ne prérempli JAMAIS le formulaire avec
 * ai_summary, exposant_description legacy, ni la valeur calculée
 * public_exhibitor_profiles.description.
 *
 * `enabled` doit être false pour les profils legacy purs (exhibitor_id
 * NULL) ou les utilisateurs non gestionnaires → aucun appel réseau.
 */
export function useExhibitorEditableFields(
  exhibitorId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['exhibitor-editable-fields', exhibitorId],
    queryFn: async (): Promise<ExhibitorEditableFields> => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'get_editable', exhibitor_id: exhibitorId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ExhibitorEditableFields;
    },
    enabled: !!exhibitorId && enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export interface ExhibitorUpdatePayload {
  exhibitor_id: string;
  description: string | null;
  website: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
}

export interface ExhibitorUpdateResult {
  id: string;
  description: string | null;
  website: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
}

/**
 * Sauvegarde les 4 champs publics via l'action `update`. Aucun champ
 * sensible n'est envoyé (name, slug, ai_summary… ignorés côté backend
 * de toute façon). Invalide les queries du profil public et d'édition
 * pour refléter immédiatement les changements.
 */
export function useExhibitorOwnerUpdate(publicSlug: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: ExhibitorUpdatePayload,
    ): Promise<ExhibitorUpdateResult> => {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: { action: 'update', ...payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ExhibitorUpdateResult;
    },
    onSuccess: () => {
      if (publicSlug) {
        queryClient.invalidateQueries({
          queryKey: ['public-exhibitor-profile', publicSlug],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['exhibitor-editable-fields'] });
      // #3 — Le widget de complétion (score/checklist/palier) lit la RPC
      // `get_exhibitor_completion` via la clé ['exhibitor-completion', ids].
      // On l'invalide pour que logo / description / liens fraîchement
      // sauvegardés recalculent le score immédiatement, sans rechargement.
      queryClient.invalidateQueries({ queryKey: ['exhibitor-completion'] });
    },
  });
}