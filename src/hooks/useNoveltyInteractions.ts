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
      
      // Only invalidate novelties list, not favorites (to avoid re-fetch conflicts)
      queryClient.invalidateQueries({ queryKey: ["novelties"] });
      
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
        // Lot B6-4 : leads-create renvoie un lien signé temporaire (1 h) qui déclenche le
        // téléchargement sans quitter la page. Toute autre adresse s'ouvre dans un nouvel onglet.
        if (data?.download_url) {
          const downloadUrl = String(data.download_url);
          const link = document.createElement('a');
          link.href = downloadUrl;
          if (!downloadUrl.includes('/storage/v1/object/sign/')) {
            link.target = '_blank';
            link.rel = 'noopener';
          }
          link.download = ''; // Nom fixé par le lien signé
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