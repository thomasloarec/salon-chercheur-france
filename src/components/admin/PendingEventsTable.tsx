
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Eye, Trash2, CheckCircle } from 'lucide-react';
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

interface PendingEvent {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  city: string;
  sector: string;
  event_type: string;
}

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
        .select('id, name, start_date, end_date, city, sector, event_type')
        .eq('visible', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingEvent[];
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
      <div className="flex justify-between items-center mb-4">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Événement</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Lieu</TableHead>
            <TableHead>Secteur</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingEvents.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-medium">{event.name}</TableCell>
              <TableCell>
                {new Date(event.start_date).toLocaleDateString('fr-FR')} - {new Date(event.end_date).toLocaleDateString('fr-FR')}
              </TableCell>
              <TableCell>{event.city}</TableCell>
              <TableCell>{event.sector}</TableCell>
              <TableCell className="capitalize">{event.event_type}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => publishEvent(event.id)}
                    disabled={publishingId === event.id}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {publishingId === event.id ? 'Publication...' : 'Publier'}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
