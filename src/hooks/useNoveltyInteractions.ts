import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Hook for toggling likes on novelties
export function useToggleLike() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noveltyId }: { noveltyId: string }) => {
      const { data, error } = await supabase.functions.invoke('novelty-like-toggle', {
        body: { novelty_id: noveltyId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate novelties queries to update like counts
      queryClient.invalidateQueries({ 
        queryKey: ["novelties:list"] 
      });
      
      toast({
        title: data.liked ? "Nouveauté likée !" : "Like retiré",
        description: data.liked ? 
          "Cette nouveauté a été ajoutée à vos favoris." : 
          "Cette nouveauté a été retirée de vos favoris."
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de liker cette nouveauté.",
        variant: "destructive"
      });
    }
  });
}

// Hook for getting like count and user's like status via edge function
export function useLikeStatus(noveltyId: string) {
  return useQuery({
    queryKey: ["novelty-likes", noveltyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('novelty-like-status', {
        body: { novelty_id: noveltyId }
      });

      if (error) throw error;
      
      return { 
        count: data.count || 0, 
        userHasLiked: data.userHasLiked || false
      };
    },
    staleTime: 30_000,
  });
}

// Hook for creating leads (brochure download / meeting request)
export function useCreateLead() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (leadData: {
      novelty_id: string;
      lead_type: 'brochure_download' | 'meeting_request';
      first_name: string;
      last_name: string;
      email: string;
      company?: string;
      role?: string;
      phone?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('leads-create', {
        body: leadData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.lead_type === 'brochure_download') {
        toast({
          title: "Brochure téléchargée !",
          description: "Votre demande a été enregistrée et le téléchargement va commencer."
        });
      } else {
        toast({
          title: "Demande envoyée !",
          description: "Votre demande de rendez-vous a été transmise à l'exposant."
        });
      }
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de traiter votre demande.",
        variant: "destructive"
      });
    }
  });
}