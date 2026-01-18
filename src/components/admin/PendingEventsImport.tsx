
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
  id_event: string;
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

  // Fetch events from staging (approved)
  const { data: stagingEvents, isLoading: loadingStaging } = useQuery({
    queryKey: ['events-import-pending-staging'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staging_events_import')
        .select('*')
        .eq('status_event', 'Approved')
        .order('date_debut', { ascending: true });

      if (error) throw error;
      return (data as unknown) as EventImport[];
    },
  });

  // Fetch events from main table with visible = false
  const { data: hiddenEvents, isLoading: loadingHidden } = useQuery({
    queryKey: ['events-hidden'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', false)
        .order('date_debut', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingStaging || loadingHidden;

  // Merge both sources
  const allPendingEvents = React.useMemo(() => {
    const stagingList = (stagingEvents || []).map(e => ({
      ...e,
      source: 'staging' as const,
    }));
    
    // Convert hidden events to EventImport format
    const hiddenList = (hiddenEvents || []).map(e => ({
      id: e.id,
      id_event: e.id_event,
      nom_event: e.nom_event,
      status_event: e.status_event,
      type_event: e.type_event,
      date_debut: e.date_debut,
      date_fin: e.date_fin,
      secteur: Array.isArray(e.secteur) ? e.secteur.join(', ') : e.secteur,
      url_image: e.url_image,
      url_site_officiel: e.url_site_officiel,
      description_event: e.description_event,
      affluence: e.affluence,
      tarifs: e.tarif,
      nom_lieu: e.nom_lieu,
      ville: e.ville,
      rue: e.rue,
      code_postal: e.code_postal,
      created_at: e.created_at || '',
      updated_at: e.updated_at,
      source: 'events' as const,
    }));
    
    // Avoid duplicates: if an event is in both, prefer staging
    const stagingIds = new Set(stagingList.map(e => e.id_event));
    const uniqueHidden = hiddenList.filter(e => !stagingIds.has(e.id_event));
    
    return [...stagingList, ...uniqueHidden];
  }, [stagingEvents, hiddenEvents]);

  const publishPendingEvent = async (eventId: string) => {
    // Check directly if this is a hidden event (from events table with visible=false)
    const isHiddenEvent = hiddenEvents?.some(e => e.id === eventId);
    const eventImport = allPendingEvents?.find(e => e.id === eventId);
    
    if (!eventImport) {
      console.error('❌ Événement non trouvé dans la liste:', eventId);
      return;
    }

    setPublishingId(eventId);
    
    try {
      console.log('🔵 Début publication événement:', eventImport.nom_event, 'isHiddenEvent:', isHiddenEvent);

      if (isHiddenEvent) {
        // Event is already in events table, just set visible = true
        console.log('📝 Mise à jour directe dans events table');
        const { error } = await supabase
          .from('events')
          .update({ visible: true, updated_at: new Date().toISOString() })
          .eq('id', eventId);

        if (error) throw error;
      } else {
        // Event is in staging, use the edge function
        console.log('📤 Appel edge function publish-pending avec id_event:', eventImport.id_event);
        const { data, error } = await supabase.functions.invoke('publish-pending', {
          body: { id_event: eventImport.id_event }
        });

        if (error) {
          console.error('❌ Erreur fonction edge publish-pending:', error);
          throw error;
        }

        if (!data.success) {
          console.error('❌ Échec publication:', data);
          throw new Error(data.error || 'Erreur inconnue');
        }
      }

      console.log('✅ Événement publié avec succès');

      toast({
        title: "Événement publié",
        description: `${eventImport.nom_event} est maintenant visible au public.`,
      });

      // Invalider les caches pour rafraîchir les listes
      queryClient.invalidateQueries({ queryKey: ['events-import-pending-staging'] });
      queryClient.invalidateQueries({ queryKey: ['events-hidden'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });

    } catch (error: any) {
      console.error('❌ Erreur publication événement:', error);
      toast({
        title: "Erreur de publication",
        description: error.message || "Impossible de publier l'événement.",
        variant: "destructive",
      });
    } finally {
      setPublishingId(null);
    }
  };

  const deleteAllPending = async () => {
    setDeletingAll(true);
    try {
      // Delete from staging
      const { error: stagingError } = await supabase
        .from('staging_events_import')
        .delete()
        .eq('status_event', 'Approved');

      if (stagingError) throw stagingError;

      // Delete hidden events from events table
      const { error: eventsError } = await supabase
        .from('events')
        .delete()
        .eq('visible', false);

      if (eventsError) throw eventsError;

      toast({
        title: "Événements supprimés",
        description: "Tous les événements en attente ont été supprimés.",
      });

      queryClient.invalidateQueries({ queryKey: ['events-import-pending-staging'] });
      queryClient.invalidateQueries({ queryKey: ['events-hidden'] });
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

  const convertToEvents = (imports: typeof allPendingEvents): Event[] => {
    return imports.map(eventImport => {
      // Normalize secteur to string
      let secteurStr: string = 'Autre';
      if (eventImport.secteur) {
        if (typeof eventImport.secteur === 'string') {
          secteurStr = eventImport.secteur;
        } else if (Array.isArray(eventImport.secteur)) {
          secteurStr = eventImport.secteur.join(', ');
        } else {
          secteurStr = String(eventImport.secteur);
        }
      }
      
      return {
        id: eventImport.id,
        nom_event: eventImport.nom_event || '',
        description_event: eventImport.description_event || null,
        date_debut: eventImport.date_debut || '1970-01-01',
        date_fin: eventImport.date_fin || eventImport.date_debut || '1970-01-01',
        secteur: secteurStr,
        nom_lieu: eventImport.nom_lieu || null,
        ville: eventImport.ville || 'Inconnue',
        rue: eventImport.rue || null,
        code_postal: eventImport.code_postal || null,
        pays: 'France',
        url_image: eventImport.url_image || null,
        url_site_officiel: eventImport.url_site_officiel || null,
        tarif: eventImport.tarifs || null,
        affluence: eventImport.affluence ? String(eventImport.affluence) : null,
        type_event: (eventImport.type_event as Event['type_event']) || 'salon',
        visible: false,
        location: eventImport.ville || 'Inconnue'
      };
    });
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

  if (!allPendingEvents || allPendingEvents.length === 0) {
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

  const eventsForGrid = convertToEvents(allPendingEvents);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            Événements en attente de publication ({allPendingEvents?.length || 0})
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
                  Cette action supprimera définitivement tous les {allPendingEvents?.length || 0} événements en attente de publication. Cette action ne peut pas être annulée.
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
          onPublish={publishPendingEvent}
        />
      </CardContent>
    </Card>
  );
}
