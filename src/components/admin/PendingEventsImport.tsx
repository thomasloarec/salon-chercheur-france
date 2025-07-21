import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Trash2 } from 'lucide-react';
import { getEventTypeLabel } from '@/constants/eventTypes';
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

interface EventImport {
  id: string;
  nom_event: string | null;
  status_event: string | null;
  ai_certainty: string | null;
  type_event: string | null;
  date_debut: string | null;
  date_fin: string | null;
  date_complete: string | null;
  secteur: string | null;
  url_image: string | null;
  url_site_officiel: string | null;
  description_event: string | null;
  affluence: string | null;
  tarifs: string | null;
  nom_lieu: string | null;
  adresse: string | null;
  chatgpt_prompt: string | null;
  created_at: string;
  updated_at: string | null;
  ville: string | null;
  rue: string | null;
  code_postal?: string | null;
}

export function PendingEventsImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const { data: pendingEvents, isLoading } = useQuery({
    queryKey: ['events-import-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events_import')
        .select('*')
        .eq('status_event', 'Approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown) as EventImport[];
    },
  });

  const publishEvent = async (eventId: string) => {
    const eventImport = pendingEvents?.find(e => e.id === eventId);
    if (!eventImport) return;

    setPublishingId(eventId);
    try {
      // Créer l'événement dans la table events de production
      const productionEvent = {
        id_event: eventImport.id,
        nom_event: eventImport.nom_event || '',
        visible: true,
        type_event: eventImport.type_event || 'salon',
        date_debut: eventImport.date_debut || '1970-01-01',
        date_fin: eventImport.date_fin || eventImport.date_debut || '1970-01-01',
        secteur: [eventImport.secteur || 'Autre'],
        ville: eventImport.ville || 'Inconnue',
        rue: eventImport.rue || null,
        code_postal: eventImport.code_postal || null,
        pays: 'France',
        url_image: eventImport.url_image || null,
        url_site_officiel: eventImport.url_site_officiel || null,
        description_event: eventImport.description_event || null,
        affluence: eventImport.affluence ? parseInt(eventImport.affluence) : null,
        tarif: eventImport.tarifs || null,
        nom_lieu: eventImport.nom_lieu || null,
        location: eventImport.ville || 'Inconnue'
      };

      const { error: insertError } = await supabase
        .from('events')
        .upsert(productionEvent, { 
          onConflict: 'id_event',
          ignoreDuplicates: false 
        });

      if (insertError) throw insertError;

      // Supprimer de la table d'import
      const { error: deleteError } = await supabase
        .from('events_import')
        .delete()
        .eq('id', eventImport.id);

      if (deleteError) throw deleteError;

      toast({
        title: "Événement publié",
        description: "L'événement est maintenant visible au public.",
      });

      queryClient.invalidateQueries({ queryKey: ['events-import-pending'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
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
        .from('events_import')
        .delete()
        .eq('status_event', 'Approved');

      if (error) throw error;

      toast({
        title: "Événements supprimés",
        description: "Tous les événements en attente ont été supprimés.",
      });

      queryClient.invalidateQueries({ queryKey: ['events-import-pending'] });
    } catch (error) {
      console.error('Error deleting pending events:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les événements en attente.",
        variant: "destructive",
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const convertToEvents = (imports: EventImport[]): Event[] => {
    return imports.map(eventImport => ({
      id: eventImport.id,
      nom_event: eventImport.nom_event || '',
      description_event: eventImport.description_event || null,
      date_debut: eventImport.date_debut || '1970-01-01',
      date_fin: eventImport.date_fin || eventImport.date_debut || '1970-01-01',
      secteur: eventImport.secteur || 'Autre',
      nom_lieu: eventImport.nom_lieu || null,
      ville: eventImport.ville || 'Inconnue',
      rue: eventImport.rue || null,
      code_postal: eventImport.code_postal || null,
      pays: 'France',
      url_image: eventImport.url_image || null,
      url_site_officiel: eventImport.url_site_officiel || null,
      tarif: eventImport.tarifs || null,
      affluence: eventImport.affluence ? parseInt(eventImport.affluence) : null,
      type_event: (eventImport.type_event as Event['type_event']) || 'salon',
      visible: false,
      location: eventImport.ville || 'Inconnue'
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Événements en attente de publication</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4">Chargement des événements en attente...</div>
        </CardContent>
      </Card>
    );
  }

  if (!pendingEvents || pendingEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Événements en attente de publication</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Aucun événement en attente de publication.
          </p>
        </CardContent>
      </Card>
    );
  }

  const eventsForGrid = convertToEvents(pendingEvents);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            Événements en attente de publication ({pendingEvents?.length || 0})
          </CardTitle>
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
                  Cette action supprimera définitivement tous les {pendingEvents?.length || 0} événements en attente de publication. Cette action ne peut pas être annulée.
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
      </CardHeader>
      <CardContent>
        <EventGrid 
          events={eventsForGrid} 
          adminPreview={true}
          onPublish={publishEvent}
        />
      </CardContent>
    </Card>
  );
}
