
import { useState } from 'react';
import { Trash2, Edit, EyeOff, Eye, Settings } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EventEditModal } from './EventEditModal';
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
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  if (!isAdmin) {
    return null;
  }

  const handleToggleVisibility = async () => {
    const newStatus = !event.visible;
    try {
      const { data, error } = await supabase
        .from('events')
        .update({ visible: newStatus })
        .eq('id', event.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: `Événement ${newStatus ? 'rendu visible' : 'masqué'}`,
        description: `L'événement est maintenant ${newStatus ? 'visible' : 'invisible'} au public.`,
      });

      // Transform the response to match our Event interface
      const transformedEvent: Event = {
        id: data.id,
        name_event: data.name || '',
        description_event: data.description,
        date_debut: data.start_date,
        date_fin: data.end_date,
        secteur: data.sector || '',
        nom_lieu: data.venue_name,
        ville: data.city,
        region: data.region,
        country: data.country,
        url_image: data.image_url,
        url_site_officiel: data.website_url,
        tags: data.tags,
        tarif: data.entry_fee,
        affluence: data.estimated_visitors,
        estimated_exhibitors: data.estimated_exhibitors,
        is_b2b: data.is_b2b,
        type_event: data.event_type as Event['type_event'],
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_scraped_at: data.last_scraped_at,
        scraped_from: data.scraped_from,
        rue: data.address,
        code_postal: data.postal_code,
        visible: data.visible,
        slug: data.slug,
        sectors: []
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
      
      const { error } = await supabase
        .from('events')
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
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer l'événement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EventEditModal
        event={event}
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onEventUpdated={onEventUpdated}
      />

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
