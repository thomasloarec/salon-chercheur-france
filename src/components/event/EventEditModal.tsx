
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
  nom_event: string;
  date_debut: Date;
  date_fin: Date;
  url_image: string;
  description_event: string;
  affluence: string;
  tarif: string;
  nom_lieu: string;
  rue: string;
  url_site_officiel: string;
  type_event: string;
  sector_ids: string[];
}

export const EventEditModal = ({ event, open, onOpenChange, onEventUpdated }: EventEditModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState(event.description_event || '');
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
      nom_event: event.nom_event,
      date_debut: new Date(event.date_debut),
      date_fin: new Date(event.date_fin),
      url_image: event.url_image || '',
      description_event: event.description_event || '',
      affluence: event.affluence?.toString() || '',
      tarif: event.tarif || '',
      nom_lieu: event.nom_lieu || '',
      rue: event.rue || '',
      url_site_officiel: event.url_site_officiel || '',
      type_event: event.type_event || 'salon',
      sector_ids: eventSectors.map(s => s.id),
    },
  });

  const date_debut = watch('date_debut');
  const date_fin = watch('date_fin');
  const sectorIds = watch('sector_ids');
  const type_event = watch('type_event');

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
    if (data.date_debut > data.date_fin) {
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
        nom_event: data.nom_event,
        date_debut: format(data.date_debut, 'yyyy-MM-dd'),
        date_fin: format(data.date_fin, 'yyyy-MM-dd'),
        url_image: data.url_image || null,
        description_event: description || null,
        affluence: data.affluence ? parseInt(data.affluence) : null,
        tarif: data.tarif || null,
        nom_lieu: data.nom_lieu || null,
        rue: data.rue || null,
        url_site_officiel: data.url_site_officiel || null,
        type_event: data.type_event,
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

      // Step 3: Fetch the updated event with proper field mapping
      const { data: refreshedEventData, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single();

      if (fetchError) {
        console.error('❌ DEBUG: Fetch after update failed:', fetchError);
        throw fetchError;
      }

      if (!refreshedEventData) {
        console.error('❌ DEBUG: No event found after update');
        throw new Error('Event not found after update');
      }

      console.log('✅ DEBUG: Fetched updated event:', refreshedEventData);

      // Transform the database result to match the Event interface
      const typedRefreshedEvent: Event = {
        id: refreshedEventData.id,
        nom_event: refreshedEventData.nom_event || '',
        description_event: refreshedEventData.description_event,
        date_debut: refreshedEventData.date_debut,
        date_fin: refreshedEventData.date_fin,
        secteur: refreshedEventData.secteur || '',
        nom_lieu: refreshedEventData.nom_lieu,
        ville: refreshedEventData.ville,
        region: refreshedEventData.region,
        country: refreshedEventData.country,
        url_image: refreshedEventData.url_image,
        url_site_officiel: refreshedEventData.url_site_officiel,
        tags: refreshedEventData.tags,
        tarif: refreshedEventData.tarif,
        affluence: refreshedEventData.affluence,
        estimated_exhibitors: refreshedEventData.estimated_exhibitors,
        is_b2b: refreshedEventData.is_b2b,
        type_event: refreshedEventData.type_event as Event['type_event'],
        created_at: refreshedEventData.created_at,
        updated_at: refreshedEventData.updated_at,
        last_scraped_at: refreshedEventData.last_scraped_at,
        scraped_from: refreshedEventData.scraped_from,
        rue: refreshedEventData.rue,
        code_postal: refreshedEventData.code_postal,
        visible: refreshedEventData.visible,
        slug: refreshedEventData.slug,
        sectors: []
      };

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
              <Label htmlFor="nom_event">Nom de l'événement</Label>
              <Input
                id="nom_event"
                {...register('nom_event', { required: 'Le nom est requis' })}
              />
              {errors.nom_event && (
                <p className="text-sm text-destructive mt-1">{errors.nom_event.message}</p>
              )}
            </div>

            <div>
              <Label>Type d'événement</Label>
              <Select value={type_event} onValueChange={(value) => setValue('type_event', value)}>
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
                        !date_debut && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {date_debut ? format(date_debut, "dd/MM/yyyy") : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={date_debut}
                      onSelect={(date) => date && setValue('date_debut', date)}
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
                        !date_fin && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {date_fin ? format(date_fin, "dd/MM/yyyy") : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={date_fin}
                      onSelect={(date) => date && setValue('date_fin', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label htmlFor="url_image">URL de l'image</Label>
              <Input
                id="url_image"
                type="url"
                placeholder="https://exemple.com/image.jpg"
                {...register('url_image')}
              />
            </div>

            <div>
              <Label htmlFor="url_site_officiel">Site officiel</Label>
              <Input
                id="url_site_officiel"
                type="url"
                placeholder="https://exemple.com"
                {...register('url_site_officiel')}
              />
            </div>
          </div>

          {/* Bloc "À propos de l'événement" */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">À propos de l'événement</h3>
            
            <div>
              <Label htmlFor="description_event">Description</Label>
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
              <Label htmlFor="affluence">Affluence</Label>
              <Input
                id="affluence"
                type="number"
                placeholder="Ex: 5000 ou laisser vide"
                {...register('affluence')}
              />
            </div>

            <div>
              <Label htmlFor="tarif">Tarifs</Label>
              <Input
                id="tarif"
                placeholder="Ex: Gratuit, Entrée 5€, Non communiqué"
                {...register('tarif')}
              />
            </div>
          </div>

          {/* Bloc "Informations pratiques" */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations pratiques</h3>
            
            <div>
              <Label htmlFor="nom_lieu">Nom du lieu</Label>
              <Input
                id="nom_lieu"
                placeholder="Ex: Parc des Expositions de Nantes"
                {...register('nom_lieu')}
              />
            </div>

            <div>
              <Label htmlFor="rue">Adresse</Label>
              <Input
                id="rue"
                placeholder="Ex: 1 route de Saint-Joseph de Porterie"
                {...register('rue')}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
