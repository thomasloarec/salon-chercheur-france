import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NoveltyNotificationData {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  eventName: string;
  eventDate: string;
  eventSlug: string;
  eventId: string;
  noveltiesOpenDate: string;
}

export const useNoveltyNotificationSubscribe = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: NoveltyNotificationData) => {
      console.log('Subscribing to novelty notifications:', data);
      
      const { data: response, error } = await supabase.functions.invoke('novelty-notification-subscribe', {
        body: data,
      });

      if (error) {
        console.error('Novelty notification subscription error:', error);
        throw error;
      }

      return response;
    },
    onSuccess: (data) => {
      console.log('Novelty notification subscription successful:', data);
    },
    onError: (error: any) => {
      console.error('Novelty notification subscription failed:', error);
      const errorMessage = error.message || 'Une erreur est survenue lors de l\'inscription';
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};
