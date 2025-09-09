
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/** === Utilitaire === */
const arrEqualAsSets = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sa = new Set(a), sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
};

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
      if (!user?.email) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .select('sector_id')
        .eq('email', user.email);

      if (error) throw error;

      // Dédupliquer par sécurité
      const ids = (data ?? []).map((r: any) => String(r.sector_id));
      return Array.from(new Set(ids));
    },
    enabled: !!user?.email,
    staleTime: 30_000,
    retry: false,
  });
};

/** === NOUVEAU : Hook contrôlé pour l'UI (sans doublons, sans auto-save) === */
export const useNewsletterPrefsControlled = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: serverIds = [], isFetching } = useUserNewsletterSubscriptions();
  const saveMutation = useUpdateNewsletterSubscriptions();

  // État local: Set pour interdire les doublons
  const [selectedSet, setSelectedSet] = React.useState<Set<string>>(new Set());
  const [dirty, setDirty] = React.useState(false);

  // Sync depuis serveur uniquement si pas de modification locale en cours
  React.useEffect(() => {
    const localIds = Array.from(selectedSet);
    if (!dirty || localIds.length === 0) {
      const next = new Set(serverIds);
      // Évite une boucle si identique
      if (!arrEqualAsSets(Array.from(next), localIds)) {
        setSelectedSet(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(serverIds)]);

  const toggle = React.useCallback((id: string) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDirty(true);
  }, []);

  const setAll = React.useCallback((ids: string[]) => {
    setSelectedSet(new Set(ids));
    setDirty(true);
  }, []);

  const save = React.useCallback(async () => {
    const email = user?.email;
    if (!email) return;

    const cacheKey = ['newsletter-subscriptions', email];
    const nextIds = Array.from(selectedSet);
    // Cap logique côté UI : max 15
    const cappedIds = nextIds.slice(0, 15);

    // Optimistic update
    const previous = queryClient.getQueryData<string[]>(cacheKey);
    queryClient.setQueryData(cacheKey, cappedIds);

    try {
      await saveMutation.mutateAsync(cappedIds);
      setDirty(false);
    } catch (e) {
      // rollback si erreur
      queryClient.setQueryData(cacheKey, previous ?? []);
      throw e;
    } finally {
      queryClient.invalidateQueries({ queryKey: cacheKey });
    }
  }, [selectedSet, saveMutation, user?.email, queryClient]);

  const count = React.useMemo(() => Math.min(selectedSet.size, 15), [selectedSet.size]);
  const countLabel = React.useMemo(() => (count <= 1 ? `${count} email/mois` : `${count} emails/mois`), [count]);

  return {
    selectedIds: Array.from(selectedSet),
    toggle,
    setAll,
    save,
    isSaving: saveMutation.isPending,
    isFetching,
    count,
    countLabel,
    dirty,
  };
};

export const useUpdateNewsletterSubscriptions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sectorIds: string[]) => {
      if (!user?.email) throw new Error('Not authenticated');

      // 1) UPSERT des cochés (évite les 409)
      if (sectorIds.length > 0) {
        const rows = sectorIds.map((sectorId) => ({
          email: user.email!,
          sector_id: sectorId,
        }));
        const { error: upsertError } = await supabase
          .from('newsletter_subscriptions')
          .upsert(rows as any, {
            onConflict: 'email,sector_id',
            ignoreDuplicates: true,
          });
        if (upsertError) throw upsertError;
      }

      // 2) DELETE ciblé des décochés
      const { data: existing, error: selectError } = await supabase
        .from('newsletter_subscriptions')
        .select('sector_id')
        .eq('email', user.email!);

      if (selectError) throw selectError;

      const existingIds = Array.from(new Set((existing ?? []).map((r: any) => String(r.sector_id))));
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
        queryClient.invalidateQueries({ queryKey: ['newsletter-subscriptions', user.email] });
      }
      toast({
        title: "Abonnements mis à jour",
        description: "Vos préférences de newsletter ont été sauvegardées.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de sauvegarder vos préférences.",
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
