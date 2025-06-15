
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Calendar, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';

interface EventEditModalProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpdated: (updatedEvent: Event) => void;
}

interface EventFormData {
  name: string;
  start_date: Date;
  end_date: Date;
  image_url: string;
  description: string;
  estimated_visitors: string;
  entry_fee: string;
  venue_name: string;
  address: string;
}

export const EventEditModal = ({ event, open, onOpenChange, onEventUpdated }: EventEditModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EventFormData>({
    defaultValues: {
      name: event.name,
      start_date: new Date(event.start_date),
      end_date: new Date(event.end_date),
      image_url: event.image_url || '',
      description: event.description || '',
      estimated_visitors: event.estimated_visitors?.toString() || '',
      entry_fee: event.entry_fee || '',
      venue_name: event.venue_name || '',
      address: event.address || '',
    },
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');

  const onSubmit = async (data: EventFormData) => {
    // Validate dates
    if (data.start_date > data.end_date) {
      toast({
        title: "Erreur de validation",
        description: "La date de début ne peut pas être postérieure à la date de fin.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const updateData = {
        name: data.name,
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        end_date: format(data.end_date, 'yyyy-MM-dd'),
        image_url: data.image_url || null,
        description: data.description || null,
        estimated_visitors: data.estimated_visitors ? parseInt(data.estimated_visitors) : null,
        entry_fee: data.entry_fee || null,
        venue_name: data.venue_name || null,
        address: data.address || null,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedEvent, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', event.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Événement modifié",
        description: "Les modifications ont été enregistrées avec succès.",
      });

      onEventUpdated(updatedEvent);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'événement.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'événement</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Bloc général */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations générales</h3>
            
            <div>
              <Label htmlFor="name">Nom de l'événement</Label>
              <Input
                id="name"
                {...register('name', { required: 'Le nom est requis' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setValue('start_date', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setValue('end_date', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label htmlFor="image_url">URL de l'image</Label>
              <Input
                id="image_url"
                type="url"
                placeholder="https://exemple.com/image.jpg"
                {...register('image_url')}
              />
            </div>
          </div>

          {/* Bloc "À propos de l'événement" */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">À propos de l'événement</h3>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                {...register('description')}
              />
            </div>

            <div>
              <Label htmlFor="estimated_visitors">Affluence</Label>
              <Input
                id="estimated_visitors"
                type="number"
                placeholder="Ex: 5000 ou laisser vide"
                {...register('estimated_visitors')}
              />
            </div>

            <div>
              <Label htmlFor="entry_fee">Tarifs</Label>
              <Input
                id="entry_fee"
                placeholder="Ex: Gratuit, Entrée 5€, Non communiqué"
                {...register('entry_fee')}
              />
            </div>
          </div>

          {/* Bloc "Informations pratiques" */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations pratiques</h3>
            
            <div>
              <Label htmlFor="venue_name">Nom du lieu</Label>
              <Input
                id="venue_name"
                placeholder="Ex: Parc des Expositions de Nantes"
                {...register('venue_name')}
              />
            </div>

            <div>
              <Label htmlFor="address">Adresse complète</Label>
              <Input
                id="address"
                placeholder="Ex: Route de Saint-Joseph de Porterie, 44300 Nantes"
                {...register('address')}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
