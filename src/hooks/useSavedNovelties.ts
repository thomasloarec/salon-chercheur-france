import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Refonte de la page Nouveautés, run F1.3 : « Enregistrer » = le like existant.
 *
 * - Une seule requête charge les nouveautés enregistrées (publiées) du visiteur connecté,
 *   au lieu d'une requête par carte.
 * - L'écriture passe par l'edge function novelty-like-toggle, comme partout ailleurs :
 *   ajout du salon aux favoris et contrôle des paliers exposant inchangés.
 * - Le like est un interrupteur : l'appelant doit vérifier savedIds avant d'appeler
 *   toggle() quand il veut seulement AJOUTER (reprise après connexion).
 * Les visiteurs anonymes (recherche IA) ont user = null dans AuthContext : ils sont
 * traités comme non connectés.
 */
export function useSavedNovelties() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['saved-novelty-ids', user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('novelty_likes')
        .select('novelty_id, novelties!inner ( status )')
        .eq('user_id', user!.id)
        .eq('novelties.status', 'published');
      if (error) throw error;
      return ((data ?? []) as { novelty_id: string }[]).map((r) => r.novelty_id);
    },
  });

  const savedIds = useMemo(() => new Set<string>(query.data ?? []), [query.data]);

  const mutation = useMutation({
    mutationFn: async (noveltyId: string) => {
      const { data, error } = await supabase.functions.invoke('novelty-like-toggle', {
        body: { novelty_id: noveltyId },
      });
      if (error) throw error;
      // Réponse parfois reçue en texte brut : lecture défensive (même logique que useNoveltyLike).
      const payload =
        typeof data === 'string'
          ? (() => {
              try {
                return JSON.parse(data);
              } catch {
                return null;
              }
            })()
          : data;
      if (!payload || typeof payload.liked !== 'boolean') {
        throw new Error('Réponse inattendue du serveur.');
      }
      return { noveltyId, liked: payload.liked as boolean };
    },
    onSuccess: ({ noveltyId, liked }) => {
      queryClient.setQueryData<string[]>(queryKey, (prev = []) =>
        liked ? Array.from(new Set([...prev, noveltyId])) : prev.filter((id) => id !== noveltyId),
      );
      // Mêmes caches que le like existant (fiche détail, agenda, favoris)
      queryClient.invalidateQueries({ queryKey: ['novelty-like', noveltyId] });
      queryClient.invalidateQueries({ queryKey: ['novelty-likes-count', noveltyId] });
      queryClient.invalidateQueries({ queryKey: ['liked-novelties', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  return {
    user,
    authLoading,
    savedIds,
    /** true quand la liste des enregistrements du visiteur connecté est chargée */
    savedLoaded: !!user && query.isSuccess,
    toggle: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
