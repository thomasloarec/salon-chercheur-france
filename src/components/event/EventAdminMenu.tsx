
import { useState } from 'react';
import { Trash2, Edit, EyeOff, Settings } from 'lucide-react';
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
  const { toast } = useToast();

  if (!isAdmin) {
    return null;
  }

  const handleHideEvent = async () => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ visible: false })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: "Événement masqué",
        description: "L'événement a été rendu invisible au public.",
      });

      onEventUpdated({ ...event, visible: false });
    } catch (error) {
      console.error('Error hiding event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de masquer l'événement.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async () => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: "Événement supprimé",
        description: "L'événement a été supprimé définitivement.",
      });

      onEventDeleted();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'événement.",
        variant: "destructive",
      });
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
          <DropdownMenuItem onClick={handleHideEvent}>
            <EyeOff className="h-4 w-4 mr-2" />
            Rendre invisible
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive"
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
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
