
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SubscribeData {
  email: string;
  sectorIds: string[];
}

export const useNewsletterSubscribe = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SubscribeData) => {
      console.log('Subscribing to newsletter:', data);
      
      const { data: response, error } = await supabase.functions.invoke('newsletter-subscribe', {
        body: data,
      });

      if (error) {
        console.error('Newsletter subscription error:', error);
        throw error;
      }

      return response;
    },
    onSuccess: (data) => {
      console.log('Newsletter subscription successful:', data);
      toast({
        title: "Abonnement confirmé !",
        description: "Merci ! Vous recevrez votre première newsletter prochainement.",
      });
    },
    onError: (error: any) => {
      console.error('Newsletter subscription failed:', error);
      const errorMessage = error.message || 'Une erreur est survenue lors de l\'abonnement';
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};
