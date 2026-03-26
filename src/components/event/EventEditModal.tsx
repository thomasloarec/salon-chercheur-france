import React, { useState, useEffect, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateEventSlug } from '@/utils/eventUtils';
import { convertSecteurToString } from '@/utils/sectorUtils';
import { useSectors } from '@/hooks/useSectors';
import type { Event } from '@/types/event';
import type { Sector } from '@/types/sector';
import { Check, AlertTriangle, Info } from 'lucide-react';

const EVENT_TYPES = [
  { value: 'salon', label: 'Salon' },
  { value: 'conference', label: 'Conférence' },
  { value: 'convention', label: 'Convention' },
  { value: 'exposition', label: 'Exposition' },
  { value: 'congres', label: 'Congrès' },
  { value: 'forum', label: 'Forum' },
  { value: 'autre', label: 'Autre' },
];

const PUBLISHED_DOMAIN = 'https://lotexpo.com';

/** Normalize a string into a valid URL slug */
const sanitizeSlug = (input: string): string => {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9-]/g, '-')    // replace invalid chars with dash
    .replace(/-{2,}/g, '-')         // collapse multiple dashes
    .replace(/^-|-$/g, '');         // trim leading/trailing dashes
};

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
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [sectorsLoaded, setSectorsLoaded] = useState(false);

  // SEO fields
  const [seoSlug, setSeoSlug] = useState('');
  const [seoMetaDescription, setSeoMetaDescription] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allSectors = [], isSuccess: sectorsReady } = useSectors();

  // Options pour le MultiSelect des secteurs
  const sectorOptions = allSectors.map((s: Sector) => ({
    value: s.id,
    label: s.name,
  }));

  // Charger les secteurs depuis la DB quand le modal s'ouvre ET que allSectors est chargé
  // Use a ref to avoid reloading when allSectors reference changes
  const sectorsLoadedOnceRef = useRef(false);

  useEffect(() => {
    // Reset the flag when dialog closes
    if (!open) {
      sectorsLoadedOnceRef.current = false;
      setSectorsLoaded(false);
      return;
    }

    // Don't reload if already loaded for this opening
    if (sectorsLoadedOnceRef.current) return;

    // Wait for sectors data to be ready
    if (!sectorsReady || !event) return;

    const loadEventSectors = async () => {
      const eventIdForSectors = event.id_event;

      if (!eventIdForSectors) {
        setSelectedSectorIds([]);
        setSectorsLoaded(true);
        sectorsLoadedOnceRef.current = true;
        return;
      }

      const { data, error } = await supabase
        .from('event_sectors')
        .select('sector_id')
        .eq('event_id', eventIdForSectors);

      if (!error && data) {
        // Only keep IDs that exist in allSectors to avoid phantom selections
        const validIds = new Set(allSectors.map(s => s.id));
        const sectorIds = data.map(row => row.sector_id).filter(id => validIds.has(id));
        setSelectedSectorIds(sectorIds);
      } else {
        setSelectedSectorIds([]);
      }
      setSectorsLoaded(true);
      sectorsLoadedOnceRef.current = true;
    };

    loadEventSectors();
  }, [event?.id, open, sectorsReady, allSectors]);

  // Track previous open state to only populate form on open transition
  const prevOpenRef = useRef(false);

  // Load form data + SEO fields ONLY when modal transitions from closed to open
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    // Only populate on open transition (false → true), not on every event change
    if (!open || wasOpen) return;
    if (!event) return;

    console.log('[EventEditModal] Populating form from event:', {
      nom_event: event.nom_event,
      ville: event.ville,
      date_debut: event.date_debut,
      slug: event.slug,
    });
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

    // SEO fields
    setSeoSlug(event.slug || '');
    setSeoMetaDescription(event.meta_description_gen || '');
    setSlugError('');
  }, [event, open]);

  // Handler pour la sélection de secteurs avec limite à 3
  const handleSectorChange = (newSelected: string[]) => {
    if (newSelected.length <= 3) {
      setSelectedSectorIds(newSelected);
    } else {
      toast({
        title: "Limite atteinte",
        description: "Vous ne pouvez sélectionner que 3 secteurs maximum.",
        variant: "destructive",
      });
    }
  };

  // Slug change handler with sanitization
  const handleSlugChange = (raw: string) => {
    const sanitized = sanitizeSlug(raw);
    setSeoSlug(sanitized);
    setSlugError('');
  };

  // Check slug uniqueness
  const checkSlugUniqueness = async (slug: string): Promise<boolean> => {
    if (!slug) {
      setSlugError('Le slug ne peut pas être vide.');
      return false;
    }
    setSlugChecking(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .neq('id', event.id)
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        setSlugError('Ce slug est déjà utilisé par un autre événement.');
        return false;
      }
      return true;
    } catch {
      setSlugError('Erreur lors de la vérification du slug.');
      return false;
    } finally {
      setSlugChecking(false);
    }
  };

  // Meta description length helpers
  const metaLen = seoMetaDescription.length;
  const metaStatus = metaLen === 0 ? 'empty' : metaLen < 140 ? 'short' : metaLen <= 155 ? 'good' : 'long';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const isEventsImport = event.slug?.startsWith('pending-');

      // Validate slug if changed (only for published events)
      const slugChanged = !isEventsImport && seoSlug !== event.slug;
      if (slugChanged) {
        const isUnique = await checkSlugUniqueness(seoSlug);
        if (!isUnique) {
          setIsLoading(false);
          return;
        }
      }

      let data, error;

      if (isEventsImport) {
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
          tarif: formData.tarif || null,
          updated_at: new Date().toISOString(),
        };

        const result = await supabase
          .from('staging_events_import')
          .update(updateData)
          .eq('id', event.id)
          .select()
          .single();

        data = result.data;
        error = result.error;
      } else {
        // Récupérer les noms des secteurs sélectionnés pour la colonne legacy "secteur"
        const selectedSectorNames = allSectors
          .filter(s => selectedSectorIds.includes(s.id))
          .map(s => s.name);

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
          slug: seoSlug || event.slug,
          meta_description_gen: seoMetaDescription || null,
          secteur: selectedSectorNames.length > 0 ? selectedSectorNames : null,
          updated_at: new Date().toISOString(),
        };

        const result = await supabase
          .from('events')
          .update(updateData)
          .eq('id', event.id)
          .select()
          .single();

        data = result.data;
        error = result.error;

        // Mettre à jour les secteurs dans event_sectors
        if (!error && data && sectorsLoaded) {
          const eventIdForSectors = event.id_event;

          if (eventIdForSectors) {
            const { error: deleteError } = await supabase
              .from('event_sectors')
              .delete()
              .eq('event_id', eventIdForSectors);

            if (deleteError) {
              console.error('Error deleting old sectors:', deleteError);
            }

            if (selectedSectorIds.length > 0) {
              const sectorInserts = selectedSectorIds.map(sectorId => ({
                event_id: eventIdForSectors,
                sector_id: sectorId,
              }));

              const { error: insertError } = await supabase
                .from('event_sectors')
                .insert(sectorInserts);

              if (insertError) {
                console.error('Error inserting new sectors:', insertError);
              }
            }
          }
        }
      }

      if (error) throw error;

      toast({
        title: "Événement mis à jour",
        description: slugChanged
          ? "Modifications sauvegardées. ⚠️ Le slug a changé — vérifiez les redirections SEO si nécessaire."
          : "Les modifications ont été sauvegardées avec succès.",
      });

      // Invalider les caches
      if (isEventsImport) {
        queryClient.invalidateQueries({ queryKey: ['admin-event-detail', event.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['event', event.slug] });
        if (slugChanged) {
          queryClient.invalidateQueries({ queryKey: ['event', seoSlug] });
        }
        queryClient.invalidateQueries({ queryKey: ['event-by-id', event.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      const eventIdForSectors = event.id_event || event.id;
      queryClient.invalidateQueries({ queryKey: ['event-sectors', eventIdForSectors] });

      // Construire les secteurs mis à jour pour l'objet Event
      const updatedSectors = allSectors
        .filter(s => selectedSectorIds.includes(s.id))
        .map(s => ({ id: s.id, name: s.name, created_at: '' }));

      const transformedEvent: Event = isEventsImport ? {
        id: data.id,
        id_event: event.id_event,
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
        sectors: updatedSectors,
        is_favorite: event.is_favorite
      } : {
        id: data.id,
        id_event: data.id_event || event.id_event,
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
        meta_description_gen: data.meta_description_gen,
        enrichissement_statut: data.enrichissement_statut,
        enrichissement_date: data.enrichissement_date,
        sectors: updatedSectors,
        is_favorite: event.is_favorite
      };

      onEventUpdated(transformedEvent, slugChanged);
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

  const isEventsImport = event.slug?.startsWith('pending-');
  const canonicalUrl = seoSlug ? `${PUBLISHED_DOMAIN}/events/${seoSlug}` : '';
  const enrichStatus = event.enrichissement_statut;
  const enrichDate = event.enrichissement_date;

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
                onChange={(e) => setFormData((prev) => ({ ...prev, nom_event: e.target.value }))}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description_event">Description</Label>
              <RichTextEditor
                value={formData.description_event}
                onChange={(value) => setFormData((prev) => ({ ...prev, description_event: value }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, date_debut: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="date_fin">Date de fin</Label>
              <Input
                id="date_fin"
                type="date"
                value={formData.date_fin}
                onChange={(e) => setFormData((prev) => ({ ...prev, date_fin: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="ville">Ville *</Label>
              <Input
                id="ville"
                value={formData.ville}
                onChange={(e) => setFormData((prev) => ({ ...prev, ville: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="code_postal">Code postal</Label>
              <Input
                id="code_postal"
                value={formData.code_postal}
                onChange={(e) => setFormData((prev) => ({ ...prev, code_postal: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="nom_lieu">Nom du lieu</Label>
              <Input
                id="nom_lieu"
                value={formData.nom_lieu}
                onChange={(e) => setFormData((prev) => ({ ...prev, nom_lieu: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="rue">Adresse</Label>
              <Input
                id="rue"
                value={formData.rue}
                onChange={(e) => setFormData((prev) => ({ ...prev, rue: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="type_event">Type d'événement</Label>
              <SafeSelect
                ariaLabel="Type d'événement"
                placeholder="Sélectionnez un type"
                value={formData.type_event}
                onChange={(value) => {
                  if (value) {
                    setFormData((prev) => ({ ...prev, type_event: value as Event['type_event'] }));
                  }
                }}
                options={EVENT_TYPES.map(type => ({ value: type.value, label: type.label }))}
                includeAllOption={false}
              />
            </div>

            <div>
              <Label htmlFor="country">Pays</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Secteurs (1 à 3 maximum)</Label>
              <MultiSelect
                options={sectorOptions}
                selected={selectedSectorIds}
                onChange={handleSectorChange}
                placeholder={!sectorsLoaded ? "Chargement des secteurs..." : "Sélectionnez les secteurs..."}
                className="mt-1"
                disabled={!sectorsLoaded}
              />
              {selectedSectorIds.length === 0 && sectorsLoaded && (
                <p className="text-xs text-muted-foreground mt-1">
                  Aucun secteur sélectionné
                </p>
              )}
              {selectedSectorIds.length === 3 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Limite de 3 secteurs atteinte
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="url_image">URL de l'image</Label>
              <Input
                id="url_image"
                type="url"
                value={formData.url_image}
                onChange={(e) => setFormData((prev) => ({ ...prev, url_image: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="url_site_officiel">Site web officiel</Label>
              <Input
                id="url_site_officiel"
                type="url"
                value={formData.url_site_officiel}
                onChange={(e) => setFormData((prev) => ({ ...prev, url_site_officiel: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="tarif">Tarif</Label>
              <Input
                id="tarif"
                value={formData.tarif}
                onChange={(e) => setFormData((prev) => ({ ...prev, tarif: e.target.value }))}
              />
            </div>
          </div>

          {/* ────────────── SECTION SEO ────────────── */}
          {!isEventsImport && (
            <>
              <Separator className="my-2" />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                  Paramètres SEO
                </h3>

                {/* Slug */}
                <div>
                  <Label htmlFor="seo-slug">Slug</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Identifiant utilisé dans l'URL de la page événement.
                  </p>
                  <Input
                    id="seo-slug"
                    value={seoSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="mon-evenement"
                  />
                  {slugError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {slugError}
                    </p>
                  )}
                  {slugChecking && (
                    <p className="text-xs text-muted-foreground mt-1">Vérification…</p>
                  )}
                </div>

                {/* Meta description */}
                <div>
                  <Label htmlFor="seo-meta">Meta description</Label>
                  <Textarea
                    id="seo-meta"
                    value={seoMetaDescription}
                    onChange={(e) => setSeoMetaDescription(e.target.value)}
                    placeholder="Description SEO de l'événement (140-155 caractères recommandés)"
                    rows={3}
                    className="mt-1"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {metaLen} caractère{metaLen !== 1 ? 's' : ''}
                    </span>
                    {metaLen > 0 && (
                      <span className={`text-xs flex items-center gap-1 ${
                        metaStatus === 'good'
                          ? 'text-green-600'
                          : metaStatus === 'short'
                            ? 'text-amber-600'
                            : 'text-destructive'
                      }`}>
                        {metaStatus === 'good' && <><Check className="h-3 w-3" /> Longueur idéale</>}
                        {metaStatus === 'short' && <><AlertTriangle className="h-3 w-3" /> Trop court (cible : 140-155)</>}
                        {metaStatus === 'long' && <><AlertTriangle className="h-3 w-3" /> Trop long (cible : 140-155)</>}
                      </span>
                    )}
                  </div>
                </div>

                {/* Aperçu URL / Canonical */}
                <div>
                  <Label>Aperçu URL finale / Canonical</Label>
                  <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground break-all select-all">
                    {canonicalUrl || <span className="italic">Aucun slug défini</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Canonical calculée automatiquement à partir du slug.
                  </p>
                </div>

                {/* État enrichissement */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Statut enrichissement</Label>
                    <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground">
                      {enrichStatus || '—'}
                    </div>
                  </div>
                  <div>
                    <Label>Date enrichissement</Label>
                    <div className="mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground">
                      {enrichDate
                        ? new Date(enrichDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !!slugError}>
              {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
