
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import EventGrid from '@/components/EventGrid';
import type { Event } from '@/types/event';

export const PendingEventsTable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const { data: pendingEvents, isLoading } = useQuery({
    queryKey: ['pending-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, address, postal_code, city')
        .eq('visible', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Event[];
    },
  });

  const publishEvent = async (eventId: string) => {
    setPublishingId(eventId);
    try {
      const { error } = await supabase
        .from('events')
        .update({ visible: true })
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: "Événement publié",
        description: "L'événement est maintenant visible au public.",
      });

      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events-rpc'] });
    } catch (error) {
      console.error('Error publishing event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de publier l'événement.",
        variant: "destructive",
      });
    } finally {
      setPublishingId(null);
    }
  };

  const deleteAllPending = async () => {
    setDeletingAll(true);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('visible', false);

      if (error) throw error;

      toast({
        title: "Événements supprimés",
        description: "Tous les événements en attente ont été supprimés.",
      });

      queryClient.invalidateQueries({ queryKey: ['pending-events'] });
    } catch (error) {
      console.error('Error deleting all pending events:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les événements en attente.",
        variant: "destructive",
      });
    } finally {
      setDeletingAll(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-4">Chargement des événements en attente...</div>;
  }

  if (!pendingEvents || pendingEvents.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Événements en attente de publication</h3>
        <p className="text-muted-foreground">Aucun événement en attente de publication.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">
          Événements en attente de publication ({pendingEvents.length})
        </h3>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={deletingAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer tout
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer tous les événements en attente</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera définitivement tous les {pendingEvents.length} événements en attente de publication. Cette action ne peut pas être annulée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={deleteAllPending} className="bg-destructive text-destructive-foreground">
                Supprimer tout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <EventGrid 
        events={pendingEvents}
        adminPreview={true}
        onPublish={publishEvent}
      />
    </div>
  );
};
