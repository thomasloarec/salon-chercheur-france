import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Calendar, Upload } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSectors, useEventSectors } from '@/hooks/useSectors';
import { EVENT_TYPES } from '@/constants/eventTypes';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';

interface EventEditModalProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpdated: (updatedEvent: Event, slugChanged?: boolean) => void;
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
  event_url: string;
  event_type: string;
  sector_ids: string[];
}

export const EventEditModal = ({ event, open, onOpenChange, onEventUpdated }: EventEditModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState(event.description || '');
  const { toast } = useToast();
  const { data: allSectors = [] } = useSectors();
  const { data: eventSectors = [] } = useEventSectors(event.id);

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
      event_url: event.event_url || '',
      event_type: event.event_type || 'salon',
      sector_ids: eventSectors.map(s => s.id),
    },
  });

  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const sectorIds = watch('sector_ids');
  const eventType = watch('event_type');

  const updateEventSectors = async (eventId: string, newSectorIds: string[]) => {
    // Supprimer les anciennes relations
    const { error: deleteError } = await supabase
      .from('event_sectors')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting old sectors:', deleteError);
      throw deleteError;
    }

    // Ajouter les nouvelles relations
    if (newSectorIds.length > 0) {
      const sectorsToInsert = newSectorIds.map(sectorId => ({
        event_id: eventId,
        sector_id: sectorId,
      }));

      const { error: insertError } = await supabase
        .from('event_sectors')
        .insert(sectorsToInsert);

      if (insertError) {
        console.error('Error inserting new sectors:', insertError);
        throw insertError;
      }
    }
  };

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
        description: description || null,
        estimated_visitors: data.estimated_visitors ? parseInt(data.estimated_visitors) : null,
        entry_fee: data.entry_fee || null,
        venue_name: data.venue_name || null,
        address: data.address || null,
        event_url: data.event_url || null,
        event_type: data.event_type,
        updated_at: new Date().toISOString(),
      };

      console.log('🔧 DEBUG: Starting event update process');
      console.log('🔧 DEBUG: Target event ID:', event.id);
      console.log('🔧 DEBUG: Update payload:', updateData);
      console.log('🔧 DEBUG: Sector IDs:', data.sector_ids);
      
      // Step 1: Update the event
      const { data: updateResponse, error: updateError } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', event.id);

      if (updateError) {
        console.error('❌ DEBUG: Update failed with error:', updateError);
        throw updateError;
      }

      console.log('✅ DEBUG: Event update completed successfully');

      // Step 2: Update event sectors
      await updateEventSectors(event.id, data.sector_ids);
      console.log('✅ DEBUG: Event sectors updated successfully');

      // Step 3: Fetch the updated event
      const { data: refreshedEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single();

      if (fetchError) {
        console.error('❌ DEBUG: Fetch after update failed:', fetchError);
        throw fetchError;
      }

      if (!refreshedEvent) {
        console.error('❌ DEBUG: No event found after update');
        throw new Error('Event not found after update');
      }

      console.log('✅ DEBUG: Fetched updated event:', refreshedEvent);

      // Ensure proper typing for the updated event
      const typedRefreshedEvent = {
        ...refreshedEvent,
        event_type: refreshedEvent.event_type as Event['event_type']
      } as Event;

      // Check if the slug has changed
      const slugChanged = typedRefreshedEvent.slug !== event.slug;
      console.log('🔧 DEBUG: Slug comparison:', {
        original: event.slug,
        new: typedRefreshedEvent.slug,
        changed: slugChanged
      });

      toast({
        title: "Événement modifié",
        description: "Les modifications ont été enregistrées avec succès.",
      });

      // Pass the updated event data and slug change info
      onEventUpdated(typedRefreshedEvent, slugChanged);
      onOpenChange(false);
    } catch (error) {
      console.error('❌ DEBUG: Overall error in update process:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'événement.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sectorOptions = allSectors.map(sector => ({
    value: sector.id,
    label: sector.name,
  }));

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', { 'script': 'sub' }, { 'script': 'super' }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'blockquote', 'code-block'],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
  };

  const quillFormats = [
    'bold', 'italic', 'underline', 'list', 'bullet', 'link', 
    'blockquote', 'code-block', 'color', 'background', 'script'
  ];

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

            <div>
              <Label>Type d'événement</Label>
              <Select value={eventType} onValueChange={(value) => setValue('event_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Secteurs d'activité</Label>
              <MultiSelect
                options={sectorOptions}
                selected={sectorIds}
                onChange={(selectedIds) => setValue('sector_ids', selectedIds)}
                placeholder="Sélectionner des secteurs..."
              />
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

            <div>
              <Label htmlFor="event_url">Site officiel</Label>
              <Input
                id="event_url"
                type="url"
                placeholder="https://exemple.com"
                {...register('event_url')}
              />
            </div>
          </div>

          {/* Bloc "À propos de l'événement" */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">À propos de l'événement</h3>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <ReactQuill
                theme="snow"
                value={description}
                onChange={setDescription}
                modules={quillModules}
                formats={quillFormats}
                className="mb-4"
                placeholder="Décrivez l'événement..."
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
