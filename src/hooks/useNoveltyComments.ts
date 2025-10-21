import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NoveltyComment {
  id: string;
  novelty_id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useNoveltyComments(noveltyId: string | undefined) {
  return useQuery({
    queryKey: ['novelty-comments', noveltyId],
    queryFn: async () => {
      if (!noveltyId) return [];

      // Fetch comments with manual join on profiles
      const { data, error } = await supabase
        .from('novelty_comments')
        .select('*')
        .eq('novelty_id', noveltyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        throw error;
      }

      if (!data || data.length === 0) return [];

      // Fetch profiles for all comment authors
      const userIds = data.map(comment => comment.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      // Map profiles to comments
      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      return data.map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || null
      })) as NoveltyComment[];
    },
    enabled: !!noveltyId
  });
}

export function useAddComment(noveltyId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!user) {
        throw new Error('Vous devez être connecté pour commenter');
      }

      const { data, error } = await supabase
        .from('novelty_comments')
        .insert({
          novelty_id: noveltyId,
          user_id: user.id,
          content: content.trim(),
          image_url: imageUrl || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novelty-comments', noveltyId] });
      toast.success('Commentaire ajouté');
    },
    onError: (error: Error) => {
      console.error('Error adding comment:', error);
      toast.error('Erreur lors de l\'ajout du commentaire');
    }
  });
}

export function useDeleteComment(noveltyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('novelty_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novelty-comments', noveltyId] });
      toast.success('Commentaire supprimé');
    },
    onError: (error: Error) => {
      console.error('Error deleting comment:', error);
      toast.error('Erreur lors de la suppression du commentaire');
    }
  });
}
