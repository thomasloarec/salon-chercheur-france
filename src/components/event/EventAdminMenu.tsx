
import { useState } from 'react';
import { Trash2, Edit, EyeOff, Eye, Settings, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EventEditModal } from './EventEditModal';
import { convertSecteurToString } from '@/utils/sectorUtils';
import type { Event } from '@/types/event';

interface EventAdminMenuProps {
  event: Event;
  isAdmin: boolean;
  onEventUpdated: (updatedEvent: Event) => void;
  onEventDeleted: () => void;
}

export const EventAdminMenu = ({ event, isAdmin, onEventUpdated, onEventDeleted }: EventAdminMenuProps) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();

  if (!isAdmin) {
    return null;
  }

  const isPendingEvent = !event.visible;

  const handlePublishEvent = async () => {
    setIsPublishing(true);
    try {
      console.log('Publishing pending event with ID:', event.id);
      
      const { data, error } = await supabase.functions.invoke('publish-pending', {
        body: { id_event: event.id }
      });

      if (error) {
        console.error('Error publishing event:', error);
        throw error;
      }

      console.log('Event published successfully:', data);
      
      toast({
        title: "Événement publié",
        description: "L'événement a été publié avec succès.",
      });

      setShowPublishDialog(false);
      
      // Rafraîchir ou rediriger
      if (onEventUpdated) {
        const refreshedEvent = { ...event, visible: true };
        onEventUpdated(refreshedEvent, true);
      }
      
    } catch (error) {
      console.error('Error publishing event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de publier l'événement.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleVisibility = async () => {
    const newStatus = !event.visible;
    try {
      const tableName = isPendingEvent ? 'events_import' : 'events';
      
      const { data, error } = await supabase
        .from(tableName)
        .update({ visible: newStatus })
        .eq('id', event.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: `Événement ${newStatus ? 'rendu visible' : 'masqué'}`,
        description: `L'événement est maintenant ${newStatus ? 'visible' : 'invisible'} au public.`,
      });

      // Transform the response to match our Event interface using actual DB column names
      const transformedEvent: Event = {
        id: data.id,
        nom_event: data.nom_event || '',
        description_event: data.description_event,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        secteur: convertSecteurToString(data.secteur),
        nom_lieu: data.nom_lieu,
        ville: data.ville || 'Ville non précisée',
        country: data.pays || 'France',
        url_image: data.url_image,
        url_site_officiel: data.url_site_officiel,
        tags: data.tags || [],
        tarif: data.tarif,
        affluence: data.affluence,
        estimated_exhibitors: data.estimated_exhibitors,
        is_b2b: data.is_b2b,
        type_event: data.type_event as Event['type_event'],
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_scraped_at: data.last_scraped_at,
        scraped_from: data.scraped_from,
        rue: data.rue,
        code_postal: data.code_postal,
        visible: data.visible,
        slug: data.slug,
        sectors: [],
        is_favorite: false
      };

      onEventUpdated(transformedEvent);
    } catch (error) {
      console.error('Error toggling event visibility:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la visibilité de l'événement.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async () => {
    setIsDeleting(true);
    try {
      console.log('Attempting to delete event with ID:', event.id);
      
      // Utiliser la bonne table selon si c'est un événement en attente ou publié
      const tableName = isPendingEvent ? 'events_import' : 'events';
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', event.id);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      console.log('Event deleted successfully');
      
      toast({
        title: "Événement supprimé",
        description: "L'événement a été supprimé définitivement.",
      });

      // Close the dialog first
      setShowDeleteDialog(false);
      
      // Call the callback to handle navigation
      onEventDeleted();
      
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'événement.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Bouton Publier pour les événements en attente */}
        {isPendingEvent && (
          <Button 
            variant="default" 
            size="sm"
            onClick={() => setShowPublishDialog(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Publier
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowEditModal(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier l'événement
            </DropdownMenuItem>
            
            {/* Bouton "Rendre visible" seulement pour les événements publiés */}
            {!isPendingEvent ? (
              <DropdownMenuItem 
                onClick={handleToggleVisibility}
                className={event.visible ? 'text-destructive focus:text-destructive' : ''}
              >
                {event.visible ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Rendre invisible
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Rendre visible
                  </>
                )}
              </DropdownMenuItem>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem 
                      disabled
                      className="text-gray-400 cursor-not-allowed"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Rendre visible
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cette action est disponible une fois l'événement publié.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <DropdownMenuItem 
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer l'événement
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EventEditModal
        event={event}
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onEventUpdated={onEventUpdated}
      />

      {/* Dialog de confirmation de publication */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier l'événement</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir publier cet événement ? Il sera visible par tous les utilisateurs une fois publié.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePublishEvent}
              disabled={isPublishing}
            >
              {isPublishing ? 'Publication...' : 'Publier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'événement</AlertDialogTitle>
            <AlertDialogDescription>
              Souhaitez-vous vraiment supprimer cet événement ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteEvent} 
              className="bg-destructive text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
