import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useNoveltyLike = (noveltyId: string, eventId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Vérifier si l'utilisateur a liké cette nouveauté
  const { data: isLiked, isLoading } = useQuery({
    queryKey: ['novelty-like', noveltyId, user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from('novelty_likes')
        .select('id')
        .eq('novelty_id', noveltyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking like status:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user && !!noveltyId,
  });

  // Toggle like
  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Vous devez être connecté pour liker une nouveauté');
      }

      // Toujours passer par l'edge function pour que la notification exposant
      // (`new_lead_like`) soit créée côté serveur avec service role.
      const { data, error } = await supabase.functions.invoke('novelty-like-toggle', {
        body: { novelty_id: noveltyId },
      });
      if (error) throw error;
      // L'edge function novelty-like-toggle ne renvoie PAS de header
      // `Content-Type: application/json`. Avec supabase-js (functions-js 2.4.4),
      // une réponse sans ce header est désérialisée en TEXTE brut : `data` est
      // donc une string, et `data.liked` valait toujours `undefined` → l'action
      // était systématiquement interprétée comme 'unliked' (toast « Retiré… »
      // même lors d'un ajout). On parse défensivement la réponse pour lire
      // l'action réellement effectuée côté serveur (INSERT → liked:true).
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
      return { action: (payload?.liked ? 'liked' : 'unliked') as 'liked' | 'unliked' };
    },
    onSuccess: (data) => {
      // Invalider les queries concernées
      queryClient.invalidateQueries({ queryKey: ['novelty-like', noveltyId] });
      queryClient.invalidateQueries({ queryKey: ['novelty-likes-count', noveltyId] });
      queryClient.invalidateQueries({ queryKey: ['novelties'] }); // Rafraîchir la liste des nouveautés
      queryClient.invalidateQueries({ queryKey: ['liked-novelties', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });

      // Toast
      toast({
        title: data.action === 'liked' ? 'Ajouté à vos stands à voir' : 'Retiré de vos stands à voir',
        description: data.action === 'liked'
          ? 'Ce stand apparaîtra dans votre agenda'
          : 'Ce stand a été retiré de votre liste',
      });
    },
    onError: (error: any) => {
      console.error('Error toggling like:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de liker cette nouveauté',
        variant: 'destructive',
      });
    },
  });

  return {
    isLiked: isLiked ?? false,
    isLoading,
    toggleLike: toggleLike.mutate,
    isPending: toggleLike.isPending,
  };
};

// Hook pour obtenir le nombre de likes d'une nouveauté
export const useNoveltyLikesCount = (noveltyId: string) => {
  return useQuery({
    queryKey: ['novelty-likes-count', noveltyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('novelty_likes')
        .select('*', { count: 'exact', head: true })
        .eq('novelty_id', noveltyId);

      if (error) {
        console.error('Error fetching likes count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!noveltyId,
    staleTime: 30_000,
  });
};

// Hook pour obtenir toutes les nouveautés likées par l'utilisateur avec le stand depuis participation
export const useLikedNovelties = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['liked-novelties', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('novelty_likes')
        .select(`
          novelty_id,
          novelties!inner (
            id,
            title,
            type,
            status,
            media_urls,
            created_at,
            event_id,
            exhibitor_id,
            stand_info,
            exhibitors!novelties_exhibitor_id_fkey (
              id,
              name,
              slug,
              logo_url
            ),
            events!inner (
              id,
              nom_event,
              slug,
              ville,
              date_debut,
              date_fin,
              url_image,
              nom_lieu,
              secteur
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('novelties.status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching liked novelties:', error);
        return [];
      }

      // Enrichir avec les infos de stand depuis la vue participations_with_exhibitors
      const novelties = data?.map(item => item.novelties) || [];
      
      const enrichedNovelties = await Promise.all(
        novelties.map(async (novelty) => {
          // Rechercher le stand via la vue participations_with_exhibitors
          // en matchant l'événement et le nom de l'exposant
          const { data: participation } = await supabase
            .from('participations_with_exhibitors')
            .select('stand_exposant')
            .eq('id_event', novelty.event_id)
            .ilike('exhibitor_name', novelty.exhibitors.name)
            .maybeSingle();

          return {
            ...novelty,
            stand_info: participation?.stand_exposant || novelty.stand_info,
          };
        })
      );

      return enrichedNovelties;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

// Hook pour obtenir le stand d'une nouveauté depuis participations_with_exhibitors
export const useNoveltyStand = (novelty: { id: string; event_id: string; exhibitor_id: string }) => {
  return useQuery({
    queryKey: ['novelty-stand', novelty.id, novelty.event_id, novelty.exhibitor_id],
    queryFn: async () => {
      // Récupérer le nom de l'exposant
      const { data: exhibitor } = await supabase
        .from('exhibitors')
        .select('name')
        .eq('id', novelty.exhibitor_id)
        .single();

      if (!exhibitor) return null;

      // Rechercher le stand via la vue participations_with_exhibitors
      const { data, error } = await supabase
        .from('participations_with_exhibitors')
        .select('stand_exposant')
        .eq('id_event', novelty.event_id)
        .ilike('exhibitor_name', exhibitor.name)
        .maybeSingle();

      if (error) {
        console.error('Error fetching stand:', error);
        return null;
      }

      return data?.stand_exposant || null;
    },
    staleTime: 300_000, // 5 minutes
  });
};
