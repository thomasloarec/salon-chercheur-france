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
    onMutate: async ({ noveltyId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["novelty-likes", noveltyId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["novelty-likes", noveltyId]);
      
      // Optimistically update
      queryClient.setQueryData(["novelty-likes", noveltyId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          userHasLiked: !old.userHasLiked,
          count: old.userHasLiked ? old.count - 1 : old.count + 1
        };
      });
      
      return { previousData, noveltyId };
    },
    onSuccess: (data, { noveltyId }) => {
      // Update with server data
      queryClient.setQueryData(["novelty-likes", noveltyId], {
        count: data.likesCount,
        userHasLiked: data.liked
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["novelties:list"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-events"] });
      
      const message = data.liked 
        ? (data.eventFavorited 
            ? "Ajouté à vos favoris et à votre parcours de visite 🎯" 
            : "Ajouté à vos favoris ❤️")
        : "Retiré de vos favoris";
        
      toast({
        title: message,
        duration: 3000
      });
    },
    onError: (error, { noveltyId }, context) => {
      // Rollback
      if (context?.previousData) {
        queryClient.setQueryData(["novelty-likes", noveltyId], context.previousData);
      }
      
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut de cette nouveauté.",
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
        // Trigger download if URL provided
        if (data.download_url) {
          // Create a temporary link to trigger download
          const link = document.createElement('a');
          link.href = data.download_url;
          link.target = '_blank';
          link.download = ''; // Browser will determine filename
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        toast({
          title: "Brochure envoyée. Bon salon !",
          description: "Le téléchargement devrait commencer automatiquement.",
          duration: 4000
        });
      } else {
        toast({
          title: "Demande envoyée !",
          description: "Votre demande de rendez-vous a été transmise à l'exposant."
        });
      }
    },
    onError: (error: any) => {
      console.error('Lead creation error:', error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de traiter votre demande.",
        variant: "destructive"
      });
    }
  });
}