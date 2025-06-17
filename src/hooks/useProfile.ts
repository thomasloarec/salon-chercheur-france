
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
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useUpdateProfile = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (profileData: Partial<Profile>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', user.id)
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
        .select('sectors')
        .eq('email', user.email)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.sectors || [];
    },
    enabled: !!user?.email,
  });
};

export const useUpdateNewsletterSubscriptions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sectors: string[]) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .upsert({
          email: user.email!,
          sectors: sectors,
        })
        .select();

      if (error) throw error;
      return data;
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

export const useExportUserData = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('export_user_data');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `salonspro-data-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export réussi",
        description: "Vos données ont été téléchargées.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'export",
        description: error.message || "Impossible d'exporter vos données.",
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
