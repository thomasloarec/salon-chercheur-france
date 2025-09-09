
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    queryKey: ['newsletter-subscriptions', user?.email], // <-- conserver cette clé
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
    staleTime: 30_000,
    retry: false,
  });
};

// --- NOUVEAU : hook contrôlé pour la page profil ---
export const useControlledNewsletterPrefs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: serverIds = [], isFetching } = useUserNewsletterSubscriptions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sync initiale (et quand le serveur change)
  useEffect(() => {
    setSelectedIds(serverIds);
  }, [serverIds.join('|')]); // join pour éviter re-render excessifs

  // Toggle local immédiat (optimiste au niveau UI)
  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const has = prev.includes(id);
      if (has) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  }, []);

  // Mutation d'écriture (UPSERT + delete ciblé)
  const saveMutation = useUpdateNewsletterSubscriptions();

  // Sauvegarde avec update optimiste du cache React-Query
  const save = useCallback(async () => {
    if (!user?.email) return;
    const cacheKey = ['newsletter-subscriptions', user.email];

    // Snapshot pour rollback si erreur
    const previous = queryClient.getQueryData<string[]>(cacheKey);

    // Optimistic update: on reflète ce que l'UI affiche déjà
    queryClient.setQueryData(cacheKey, selectedIds);

    try {
      await saveMutation.mutateAsync(selectedIds);
    } catch (e) {
      // rollback si échec
      queryClient.setQueryData(cacheKey, previous ?? []);
      throw e;
    } finally {
      // Revalidation serveur pour être 100% synchro
      queryClient.invalidateQueries({ queryKey: cacheKey });
    }
  }, [selectedIds, saveMutation, user?.email, queryClient]);

  const countLabel = useMemo(() => {
    const n = selectedIds.length;
    return n <= 1 ? `${n} email/mois` : `${n} emails/mois`;
  }, [selectedIds.length]);

  return {
    selectedIds,
    setSelectedIds,
    toggle,
    save,
    isSaving: saveMutation.isPending,
    isFetching,
    countLabel,
  };
};

export const useUpdateNewsletterSubscriptions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sectorIds: string[]) => {
      if (!user?.email) throw new Error('Not authenticated');

      // 1) UPSERT pour les secteurs cochés
      if (sectorIds.length > 0) {
        const rows = sectorIds.map((sectorId) => ({ email: user.email!, sector_id: sectorId }));
        const { error: upsertError } = await supabase
          .from('newsletter_subscriptions')
          .upsert(rows as any, {
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

      const existingIds = (existing ?? []).map((r: any) => r.sector_id as string);
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
      if (user?.email) {
        queryClient.invalidateQueries({ queryKey: ['newsletter-subscriptions', user.email] }); // <-- clé correcte
      }
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
