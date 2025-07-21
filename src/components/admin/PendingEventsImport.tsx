
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Calendar, MapPin, ExternalLink, Trash2 } from 'lucide-react';
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
  code_postal: string | null; // Made nullable to match database schema
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
      return data;
    },
  });

  const publishEvent = async (eventImport: EventImport) => {
    setPublishingId(eventImport.id);
    try {
      // Créer l'événement dans la table events de production
      const productionEvent = {
        id_event: eventImport.id,
        nom_event: eventImport.nom_event || '',
        visible: true, // Publier directement
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
        <div className="space-y-4">
          {pendingEvents.map((event) => (
            <div key={event.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{event.nom_event || 'Événement sans nom'}</h3>
                    <Badge variant="outline">
                      {getEventTypeLabel(event.type_event || 'salon')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {event.date_debut ? new Date(event.date_debut).toLocaleDateString('fr-FR') : 'Date non définie'}
                      {event.date_fin && event.date_fin !== event.date_debut && (
                        <span> - {new Date(event.date_fin).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {event.ville || 'Ville non définie'}
                    </div>
                  </div>
                  
                  {event.description_event && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description_event}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{event.secteur || 'Autre'}</Badge>
                    {event.affluence && (
                      <Badge variant="outline">{event.affluence} visiteurs</Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {event.url_site_officiel && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(event.url_site_officiel!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => publishEvent(event)}
                    disabled={publishingId === event.id}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {publishingId === event.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Publication...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Publier
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
