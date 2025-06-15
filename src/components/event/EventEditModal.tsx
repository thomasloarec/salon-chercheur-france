
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
      event_url: event.event_url || '',
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
        event_url: data.event_url || null,
        updated_at: new Date().toISOString(),
      };

      console.log('🔧 DEBUG: Starting event update process');
      console.log('🔧 DEBUG: Target event ID:', event.id);
      console.log('🔧 DEBUG: Target event ID type:', typeof event.id);
      console.log('🔧 DEBUG: Update payload:', updateData);
      console.log('🔧 DEBUG: Original event data:', event);
      
      // Check user authentication and role
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('🔧 DEBUG: Current user:', user);
      console.log('🔧 DEBUG: Auth error:', authError);
      console.log('🔧 DEBUG: User role/metadata:', user?.user_metadata);

      // Step 1: Update the event with detailed logging
      console.log('🔧 DEBUG: Sending UPDATE request to Supabase...');
      const updateStartTime = Date.now();
      
      const { data: updateResponse, error: updateError, status, statusText } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', event.id);

      const updateDuration = Date.now() - updateStartTime;
      
      console.log('🔧 DEBUG: Supabase UPDATE response:', {
        data: updateResponse,
        error: updateError,
        status,
        statusText,
        duration: `${updateDuration}ms`
      });

      if (updateError) {
        console.error('❌ DEBUG: Update failed with error:', updateError);
        console.error('❌ DEBUG: Error details:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        throw updateError;
      }

      console.log('✅ DEBUG: Update request completed successfully');

      // Manual verification via REST API call
      console.log('🔧 DEBUG: Verifying update via direct REST API call...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        
        const restResponse = await fetch(`https://vxivdvzzhebobveedxbj.supabase.co/rest/v1/events?id=eq.${event.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aXZkdnp6aGVib2J2ZWVkeGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTY5NTEsImV4cCI6MjA2NDc5Mjk1MX0.s1P0Hj1u1g1BtAczv_gkippD9wTwkUj2pwxKchkZ8Hw',
            'Content-Type': 'application/json'
          }
        });
        
        const restData = await restResponse.json();
        console.log('🔧 DEBUG: REST API verification response:', {
          status: restResponse.status,
          statusText: restResponse.statusText,
          data: restData
        });
      } catch (restError) {
        console.error('🔧 DEBUG: REST API verification failed:', restError);
      }

      // Step 2: Fetch the updated event separately
      console.log('🔧 DEBUG: Fetching updated event data...');
      const fetchStartTime = Date.now();
      
      const { data: refreshedEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single();

      const fetchDuration = Date.now() - fetchStartTime;
      
      console.log('🔧 DEBUG: Fetch response:', {
        data: refreshedEvent,
        error: fetchError,
        duration: `${fetchDuration}ms`
      });

      if (fetchError) {
        console.error('❌ DEBUG: Fetch after update failed:', fetchError);
        throw fetchError;
      }

      if (!refreshedEvent) {
        console.error('❌ DEBUG: No event found after update');
        throw new Error('Event not found after update');
      }

      console.log('✅ DEBUG: Fetched updated event:', refreshedEvent);
      
      // Compare old vs new data
      console.log('🔧 DEBUG: Data comparison:');
      console.log('  - Original name:', event.name, '→ New name:', refreshedEvent.name);
      console.log('  - Original image_url:', event.image_url, '→ New image_url:', refreshedEvent.image_url);
      console.log('  - Original description:', event.description, '→ New description:', refreshedEvent.description);
      console.log('  - Original event_url:', event.event_url, '→ New event_url:', refreshedEvent.event_url);
      console.log('  - Original updated_at:', event.updated_at, '→ New updated_at:', refreshedEvent.updated_at);

      // Check if the slug has changed
      const slugChanged = refreshedEvent.slug !== event.slug;
      console.log('🔧 DEBUG: Slug comparison:', {
        original: event.slug,
        new: refreshedEvent.slug,
        changed: slugChanged
      });

      toast({
        title: "Événement modifié",
        description: "Les modifications ont été enregistrées avec succès.",
      });

      // Pass the updated event data and slug change info
      onEventUpdated(refreshedEvent, slugChanged);
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
