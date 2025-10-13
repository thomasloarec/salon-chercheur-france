import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useNoveltyLike = (noveltyId: string) => {
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

      if (isLiked) {
        // Retirer le like
        const { error } = await supabase
          .from('novelty_likes')
          .delete()
          .eq('novelty_id', noveltyId)
          .eq('user_id', user.id);

        if (error) throw error;
        return { action: 'unliked' as const };
      } else {
        // Ajouter le like
        const { error } = await supabase
          .from('novelty_likes')
          .insert({
            novelty_id: noveltyId,
            user_id: user.id,
          });

        if (error) throw error;
        return { action: 'liked' as const };
      }
    },
    onSuccess: (data) => {
      // Invalider les queries concernées
      queryClient.invalidateQueries({ queryKey: ['novelty-like', noveltyId] });
      queryClient.invalidateQueries({ queryKey: ['novelty-likes-count', noveltyId] });
      queryClient.invalidateQueries({ queryKey: ['liked-novelties', user?.id] });

      // Toast
      toast({
        title: data.action === 'liked' ? '❤️ Ajouté aux favoris' : 'Retiré des favoris',
        description: data.action === 'liked' 
          ? 'Cette nouveauté apparaîtra dans votre agenda' 
          : 'Cette nouveauté a été retirée de vos favoris',
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

// Hook pour obtenir toutes les nouveautés likées par l'utilisateur
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
            exhibitors!inner (
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
              date_fin
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

      return data?.map(item => item.novelties) || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};
