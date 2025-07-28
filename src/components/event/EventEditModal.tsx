import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateEventSlug } from '@/utils/eventUtils';
import { convertSecteurToString } from '@/utils/sectorUtils';
import type { Event } from '@/types/event';

const EVENT_TYPES = [
  { value: 'salon', label: 'Salon' },
  { value: 'conference', label: 'Conférence' },
  { value: 'convention', label: 'Convention' },
  { value: 'exposition', label: 'Exposition' },
  { value: 'congres', label: 'Congrès' },
  { value: 'forum', label: 'Forum' },
  { value: 'autre', label: 'Autre' },
];

interface EventEditModalProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpdated: (updatedEvent: Event, slugChanged?: boolean) => void;
}

export const EventEditModal = ({ event, open, onOpenChange, onEventUpdated }: EventEditModalProps) => {
  const [formData, setFormData] = useState({
    nom_event: '',
    description_event: '',
    date_debut: '',
    date_fin: '',
    nom_lieu: '',
    ville: '',
    rue: '',
    code_postal: '',
    country: '',
    url_image: '',
    url_site_officiel: '',
    type_event: 'salon' as Event['type_event'],
    tarif: '',
    visible: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (event) {
      setFormData({
        nom_event: event.nom_event || '',
        description_event: event.description_event || '',
        date_debut: event.date_debut || '',
        date_fin: event.date_fin || '',
        nom_lieu: event.nom_lieu || '',
        ville: event.ville || '',
        rue: event.rue || '',
        code_postal: event.code_postal || '',
        country: event.country || 'France',
        url_image: event.url_image || '',
        url_site_officiel: event.url_site_officiel || '',
        type_event: (event.type_event as Event['type_event']) || 'salon',
        tarif: event.tarif || '',
        visible: event.visible ?? true,
      });
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Determine if we're updating events or staging_events_import table
      const isEventsImport = event.slug?.startsWith('pending-') || !event.visible;
      
      console.log('Updating event:', { 
        eventId: event.id, 
        isEventsImport, 
        slug: event.slug, 
        visible: event.visible 
      });

      // Generate slug if name or city changed for published events
      const nameChanged = formData.nom_event !== event.nom_event;
      const cityChanged = formData.ville !== event.ville;
      const shouldRegenerateSlug = nameChanged || cityChanged;
      
      let newSlug = event.slug;
      if (shouldRegenerateSlug && !isEventsImport) {
        // Create a temporary event object for slug generation
        const tempEvent: Event = {
          ...event,
          nom_event: formData.nom_event,
          ville: formData.ville,
          date_debut: formData.date_debut,
        };
        newSlug = generateEventSlug(tempEvent);
      }

      let data, error;

      if (isEventsImport) {
        // Update events_import table - use only fields that exist in this table
        const updateData = {
          nom_event: formData.nom_event,
          description_event: formData.description_event || null,
          date_debut: formData.date_debut,
          date_fin: formData.date_fin || formData.date_debut,
          nom_lieu: formData.nom_lieu || null,
          ville: formData.ville,
          rue: formData.rue || null,
          code_postal: formData.code_postal || null,
          url_image: formData.url_image || null,
          url_site_officiel: formData.url_site_officiel || null,
          type_event: formData.type_event,
          tarif: formData.tarif || null, // events_import uses 'tarif' not 'tarifs'
          updated_at: new Date().toISOString(),
        };

        console.log('Updating events_import with data:', updateData);

        const result = await supabase
          .from('staging_events_import')
          .update(updateData)
          .eq('id', event.id)
          .select()
          .single();

        data = result.data;
        error = result.error;
        
        if (error) {
          console.error('Error updating staging_events_import:', error);
        }
      } else {
        // Update events table
        const updateData = {
          nom_event: formData.nom_event,
          description_event: formData.description_event || null,
          date_debut: formData.date_debut,
          date_fin: formData.date_fin || formData.date_debut,
          nom_lieu: formData.nom_lieu || null,
          ville: formData.ville,
          rue: formData.rue || null,
          code_postal: formData.code_postal || null,
          pays: formData.country || 'France',
          url_image: formData.url_image || null,
          url_site_officiel: formData.url_site_officiel || null,
          type_event: formData.type_event,
          tarif: formData.tarif || null,
          visible: formData.visible,
          slug: newSlug,
          updated_at: new Date().toISOString(),
        };

        console.log('Updating events with data:', updateData);

        const result = await supabase
          .from('events')
          .update(updateData)
          .eq('id', event.id)
          .select()
          .single();

        data = result.data;
        error = result.error;
        
        if (error) {
          console.error('Error updating events:', error);
        }
      }

      if (error) throw error;

      toast({
        title: "Événement mis à jour",
        description: "Les modifications ont été sauvegardées avec succès.",
      });

      // Invalider les requêtes pour forcer le rechargement des données
      if (isEventsImport) {
        // Pour les événements en attente, invalider la requête admin-event-detail
        queryClient.invalidateQueries({ queryKey: ['admin-event-detail', event.id] });
      } else {
        // Pour les événements publiés, invalider les requêtes event et related
        queryClient.invalidateQueries({ queryKey: ['event', event.slug] });
        queryClient.invalidateQueries({ queryKey: ['event-by-id', event.id] });
      }

      // Invalider aussi les requêtes globales des événements
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });

      // Transform the response to match our Event interface
      const transformedEvent: Event = isEventsImport ? {
        // For staging_events_import, transform the data
        id: data.id,
        nom_event: data.nom_event || '',
        description_event: data.description_event,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        secteur: convertSecteurToString(data.secteur),
        nom_lieu: data.nom_lieu,
        ville: data.ville,
        country: 'France',
        url_image: data.url_image,
        url_site_officiel: data.url_site_officiel,
        tags: [],
        tarif: data.tarif,
        affluence: data.affluence || undefined,
        estimated_exhibitors: undefined,
        is_b2b: true,
        type_event: data.type_event as Event['type_event'],
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_scraped_at: undefined,
        scraped_from: undefined,
        rue: data.rue,
        code_postal: data.code_postal,
        visible: false,
        slug: event.slug,
        sectors: event.sectors || [],
        is_favorite: event.is_favorite
      } : {
        // For events table, use actual DB column names
        id: data.id,
        nom_event: data.nom_event || '',
        description_event: data.description_event,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        secteur: convertSecteurToString(data.secteur),
        nom_lieu: data.nom_lieu,
        ville: data.ville,
        country: data.pays,
        url_image: data.url_image,
        url_site_officiel: data.url_site_officiel,
        tags: [],
        tarif: data.tarif,
        affluence: data.affluence,
        estimated_exhibitors: undefined,
        is_b2b: data.is_b2b,
        type_event: data.type_event as Event['type_event'],
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_scraped_at: undefined,
        scraped_from: undefined,
        rue: data.rue,
        code_postal: data.code_postal,
        visible: data.visible,
        slug: data.slug,
        sectors: event.sectors || [],
        is_favorite: event.is_favorite
      };

      onEventUpdated(transformedEvent, shouldRegenerateSlug);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'événement.",
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
          <DialogDescription>
            Modifiez les informations de l'événement ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="nom_event">Nom de l'événement *</Label>
              <Input
                id="nom_event"
                value={formData.nom_event}
                onChange={(e) => setFormData({ ...formData, nom_event: e.target.value })}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description_event">Description</Label>
              <RichTextEditor
                value={formData.description_event}
                onChange={(value) => setFormData({ ...formData, description_event: value })}
                placeholder="Décrivez l'événement..."
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="date_debut">Date de début *</Label>
              <Input
                id="date_debut"
                type="date"
                value={formData.date_debut}
                onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="date_fin">Date de fin</Label>
              <Input
                id="date_fin"
                type="date"
                value={formData.date_fin}
                onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="ville">Ville *</Label>
              <Input
                id="ville"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="code_postal">Code postal</Label>
              <Input
                id="code_postal"
                value={formData.code_postal}
                onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="nom_lieu">Nom du lieu</Label>
              <Input
                id="nom_lieu"
                value={formData.nom_lieu}
                onChange={(e) => setFormData({ ...formData, nom_lieu: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="rue">Adresse</Label>
              <Input
                id="rue"
                value={formData.rue}
                onChange={(e) => setFormData({ ...formData, rue: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="type_event">Type d'événement</Label>
              <Select 
                value={formData.type_event} 
                onValueChange={(value) => setFormData({ ...formData, type_event: value as Event['type_event'] })}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Label htmlFor="country">Pays</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="url_image">URL de l'image</Label>
              <Input
                id="url_image"
                type="url"
                value={formData.url_image}
                onChange={(e) => setFormData({ ...formData, url_image: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="url_site_officiel">Site web officiel</Label>
              <Input
                id="url_site_officiel"
                type="url"
                value={formData.url_site_officiel}
                onChange={(e) => setFormData({ ...formData, url_site_officiel: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="tarif">Tarif</Label>
              <Input
                id="tarif"
                value={formData.tarif}
                onChange={(e) => setFormData({ ...formData, tarif: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
