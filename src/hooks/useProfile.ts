
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  primary_sector: string | null;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          sectors:primary_sector (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 0, // Always fresh for profile data
    retry: false,
  });
};

export const useUpdateProfile = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (profileData: Partial<Profile>) => {
      if (!user) throw new Error('Not authenticated');

      const updateData = {
        user_id: user.id,
        ...profileData,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert([updateData], { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été sauvegardées avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la mise à jour.",
        variant: "destructive",
      });
    },
  });
};

export const useUserNewsletterSubscriptions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['newsletter-subscriptions', user?.email],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .select('sector_id')
        .eq('email', user.email) as any;

      if (error) throw error;
      return data?.map((item: any) => item.sector_id) || [];
    },
    enabled: !!user?.email,
    staleTime: 60_000, // 1 minute
    retry: false,
  });
};

export const useUpdateNewsletterSubscriptions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sectorIds: string[]) => {
      if (!user?.email) throw new Error('Not authenticated');

      // 1) UPSERT pour ajouter/maintenir les abonnements cochés
      if (sectorIds.length > 0) {
        const upsertRows = sectorIds.map((sectorId) => ({
          email: user.email!,
          sector_id: sectorId,
        }));

        const { error: upsertError } = await supabase
          .from('newsletter_subscriptions')
          .upsert(upsertRows as any, {
            onConflict: 'email,sector_id',
            ignoreDuplicates: true,
          });

        if (upsertError) throw upsertError;
      }

      // 2) Supprimer uniquement les secteurs décochés
      const { data: existing, error: selectError } = await supabase
        .from('newsletter_subscriptions')
        .select('sector_id')
        .eq('email', user.email!);

      if (selectError) throw selectError;

      const existingIds = (existing ?? []).map((r) => r.sector_id as string);
      const toDelete = existingIds.filter((id) => !sectorIds.includes(id));

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('newsletter_subscriptions')
          .delete()
          .eq('email', user.email!)
          .in('sector_id', toDelete);

        if (deleteError) throw deleteError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter-subscriptions'] });
      toast({
        title: "Abonnements mis à jour",
        description: "Vos préférences de newsletter ont été sauvegardées.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteAccount = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Compte supprimé",
        description: "Votre compte a été supprimé avec succès.",
      });
      // Redirection handled by auth state change
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de suppression",
        description: error.message || "Impossible de supprimer le compte.",
        variant: "destructive",
      });
    },
  });
};

// Optimized bulk favorites query
export const useBulkFavorites = (eventIds: string[]) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorites', eventIds],
    queryFn: async () => {
      if (!user || !eventIds.length) return new Set();

      const { data, error } = await supabase
        .from('favorites')
        .select('event_id')
        .eq('user_id', user.id)
        .in('event_id', eventIds);

      if (error) throw error;
      return new Set(data?.map(f => f.event_id) || []);
    },
    enabled: !!user && eventIds.length > 0,
    staleTime: 60_000, // 1 minute
    retry: false,
  });
};
