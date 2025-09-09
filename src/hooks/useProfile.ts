
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

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export const formatMonthlyEmailCount = (n: number) => {
  const safe = Number.isFinite(n) && n >= 0 ? Math.min(n, 15) : 0;
  return safe <= 1 ? `${safe} email/mois` : `${safe} emails/mois`;
};

export const makeNewsletterHeader = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) {
    return "Abonnez-vous aux newsletters de vos secteurs favoris pour rester informé tous les mois";
  }
  return `Recevez ${formatMonthlyEmailCount(n)} sur les événements de vos secteurs`;
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
      // dédoublonnage + filtrage uuid
      const ids = (data ?? [])
        .map((r: any) => r?.sector_id)
        .filter(isUuid);
      return Array.from(new Set(ids));
    },
    enabled: !!user?.email,
    staleTime: 30_000,
    retry: false,
  });
};

/** HOOK AUTOSAVE avec debounce */
export const useNewsletterPrefsAutoSave = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: serverIds = [], isFetching } = useUserNewsletterSubscriptions();
  const saveMutation = useUpdateNewsletterSubscriptions();

  const [selectedSet, setSelectedSet] = React.useState<Set<string>>(new Set());
  const [dirty, setDirty] = React.useState(false);

  // Sync initiale depuis serveur (sans écraser une modif en cours)
  React.useEffect(() => {
    if (!dirty) setSelectedSet(new Set(serverIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(serverIds), dirty]);

  const toggle = React.useCallback((id: string) => {
    if (!isUuid(id)) return; // ignorer ids invalides
    setSelectedSet(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setDirty(true);
  }, []);

  // Debounce autosave 350ms
  React.useEffect(() => {
    if (!user?.email) return;
    if (!dirty) return;

    const cacheKey = ['newsletter-subscriptions', user.email];
    const handler = setTimeout(async () => {
      const nextIds = Array.from(selectedSet).filter(isUuid).slice(0, 15);

      // Optimistic update
      const previous = queryClient.getQueryData<string[]>(cacheKey);
      queryClient.setQueryData(cacheKey, nextIds);

      try {
        await saveMutation.mutateAsync(nextIds);
        setDirty(false);
      } catch (e) {
        // rollback
        queryClient.setQueryData(cacheKey, previous ?? []);
      } finally {
        queryClient.invalidateQueries({ queryKey: cacheKey });
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [selectedSet, dirty, user?.email, queryClient, saveMutation]);

  const count = Math.min(selectedSet.size, 15);
  const headerText = makeNewsletterHeader(count);
  const badgeText = formatMonthlyEmailCount(count);

  return {
    selectedIds: Array.from(selectedSet),
    toggle,
    isSaving: saveMutation.isPending,
    isFetching,
    count,
    headerText,
    badgeText,
  };
};

export const useUpdateNewsletterSubscriptions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sectorIds: string[]) => {
      if (!user?.email) throw new Error('Not authenticated');

      // Filtrer les IDs invalides
      const clean = Array.from(new Set(sectorIds.filter(isUuid))).slice(0, 15);

      if (clean.length === 0) {
        // Aucun secteur => supprimer tout pour cet email
        const { error: delAllErr } = await supabase
          .from('newsletter_subscriptions')
          .delete()
          .eq('email', user.email!);
        if (delAllErr) throw delAllErr;
        return;
      }

      // 1) UPSERT des cochés
      const rows = clean.map((sector_id) => ({ email: user.email!, sector_id }));
      const { error: upsertError } = await supabase
        .from('newsletter_subscriptions')
        .upsert(rows as any, {
          onConflict: 'email,sector_id',
          ignoreDuplicates: true,
        });
      if (upsertError) throw upsertError;

      // 2) DELETE ciblé des décochés
      const { data: existing, error: selErr } = await supabase
        .from('newsletter_subscriptions')
        .select('sector_id')
        .eq('email', user.email!);
      if (selErr) throw selErr;

      const existingIds = Array.from(new Set((existing ?? [])
        .map((r: any) => r?.sector_id)
        .filter(isUuid)));

      const toDelete = existingIds.filter((id) => !clean.includes(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('newsletter_subscriptions')
          .delete()
          .eq('email', user.email!)
          .in('sector_id', toDelete);
        if (delErr) throw delErr;
      }
    },
    onSuccess: (_data, _vars, _ctx) => {
      // Invalidation côté appelant (on passe la clé)
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'enregistrer vos préférences.",
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
