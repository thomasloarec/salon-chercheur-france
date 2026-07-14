import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';
import { Info, Loader2, Camera, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSectors } from '@/hooks/useSectors';
import { useAuth } from '@/contexts/AuthContext';
import type { Event } from '@/types/event';
import type { Sector } from '@/types/sector';
import { scoreSeoQuality } from '@/lib/seoQuality';

interface OrganizerEventEditFormProps {
  event: Event;
  onSubmitted?: () => void;
}

const secteurToNames = (secteur: unknown): string[] => {
  if (Array.isArray(secteur)) return secteur.map((s) => String(s).trim()).filter(Boolean);
  if (typeof secteur === 'string' && secteur.trim()) {
    return secteur.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
};

export const OrganizerEventEditForm: React.FC<OrganizerEventEditFormProps> = ({ event, onSubmitted }) => {
  const { user } = useAuth();
  const { data: allSectors = [], isSuccess: sectorsReady } = useSectors();

  const [formData, setFormData] = useState({
    nom_event: '',
    date_debut: '',
    date_fin: '',
    affluence: '',
    tarif: '',
    url_image: '',
    description_event: '',
  });
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initialRef = useRef<{
    nom_event: string;
    date_debut: string;
    date_fin: string;
    affluence: string;
    tarif: string;
    url_image: string;
    description_event: string;
    secteurNames: string[];
  } | null>(null);

  const sectorOptions = useMemo(
    () => allSectors.map((s: Sector) => ({ value: s.id, label: s.name })),
    [allSectors],
  );

  const seo = useMemo(
    () =>
      formData.description_event && formData.description_event.trim()
        ? scoreSeoQuality(formData.description_event)
        : null,
    [formData.description_event],
  );

  const resolvedDescription = useMemo(() => {
    return event.enrichissement_statut === 'valide' && event.description_enrichie
      ? event.description_enrichie
      : event.description_event || '';
  }, [event]);

  useEffect(() => {
    if (!event || !sectorsReady) return;
    const secteurNames = secteurToNames(event.secteur);
    const matchedIds = allSectors
      .filter((s) => secteurNames.some((n) => n.toLowerCase() === s.name.toLowerCase()))
      .map((s) => s.id);

    const initial = {
      nom_event: event.nom_event || '',
      date_debut: event.date_debut || '',
      date_fin: event.date_fin || '',
      affluence: event.affluence ? String(event.affluence) : '',
      tarif: event.tarif || '',
      url_image: event.url_image || '',
      description_event: resolvedDescription,
      secteurNames: allSectors.filter((s) => matchedIds.includes(s.id)).map((s) => s.name),
    };

    setFormData({
      nom_event: initial.nom_event,
      date_debut: initial.date_debut,
      date_fin: initial.date_fin,
      affluence: initial.affluence,
      tarif: initial.tarif,
      url_image: initial.url_image,
      description_event: initial.description_event,
    });
    setSelectedSectorIds(matchedIds);
    initialRef.current = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, sectorsReady]);

  const handleSectorChange = (next: string[]) => {
    if (next.length <= 3) setSelectedSectorIds(next);
    else toast.error('Vous ne pouvez sélectionner que 3 secteurs maximum.');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `event-images/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('novelties')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('novelties').getPublicUrl(filePath);
      setFormData((prev) => ({ ...prev, url_image: data.publicUrl }));
      toast.success('Image téléversée.');
    } catch (err) {
      console.error('Error uploading event image:', err);
      toast.error("Erreur lors de l'upload de l'image.");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const buildChanges = (): Record<string, unknown> => {
    const initial = initialRef.current;
    if (!initial) return {};
    const changes: Record<string, unknown> = {};
    if (formData.nom_event.trim() !== initial.nom_event) changes.nom_event = formData.nom_event.trim();
    if (formData.date_debut !== initial.date_debut) changes.date_debut = formData.date_debut;
    if (formData.date_fin !== initial.date_fin) changes.date_fin = formData.date_fin;
    if (formData.affluence !== initial.affluence) changes.affluence = formData.affluence;
    if (formData.tarif !== initial.tarif) changes.tarif = formData.tarif;
    if (formData.url_image !== initial.url_image) changes.url_image = formData.url_image;
    if (formData.description_event !== initial.description_event) {
      changes.description_event = formData.description_event;
    }
    const selectedNames = allSectors
      .filter((s) => selectedSectorIds.includes(s.id))
      .map((s) => s.name);
    if (!arraysEqual(selectedNames, initial.secteurNames)) changes.secteur = selectedNames;
    return changes;
  };

  const changes = buildChanges();
  const hasChanges = Object.keys(changes).length > 0;

  const handleSubmit = async () => {
    if (!hasChanges) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('event-change-manage', {
        body: { action: 'submit', event_id: event.id, changes },
      });
      if (error) throw error;
      toast.success(
        data?.message || 'Vos modifications ont été soumises et seront examinées sous 24-48h.',
      );
      onSubmitted?.();
    } catch (err: any) {
      toast.error(err?.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground/80">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
        <span>Vos modifications seront vérifiées par notre équipe avant d'être publiées.</span>
      </div>

      <div>
        <Label htmlFor="org-nom_event">Nom de l'événement</Label>
        <Input
          id="org-nom_event"
          value={formData.nom_event}
          onChange={(e) => setFormData((p) => ({ ...p, nom_event: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="org-date_debut">Date de début</Label>
          <Input
            id="org-date_debut"
            type="date"
            value={formData.date_debut}
            onChange={(e) => setFormData((p) => ({ ...p, date_debut: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="org-date_fin">Date de fin</Label>
          <Input
            id="org-date_fin"
            type="date"
            value={formData.date_fin}
            onChange={(e) => setFormData((p) => ({ ...p, date_fin: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label>Secteur(s) (1 à 3 maximum)</Label>
        <MultiSelect
          options={sectorOptions}
          selected={selectedSectorIds}
          onChange={handleSectorChange}
          placeholder={!sectorsReady ? 'Chargement des secteurs...' : 'Sélectionnez les secteurs...'}
          className="mt-1"
          disabled={!sectorsReady}
        />
      </div>

      <div>
        <Label htmlFor="org-affluence">Nombre de visiteurs</Label>
        <Input
          id="org-affluence"
          value={formData.affluence}
          onChange={(e) => setFormData((p) => ({ ...p, affluence: e.target.value }))}
          placeholder="ex: 15000 ou Non communiqué"
        />
      </div>

      <div>
        <Label htmlFor="org-tarif">Tarif</Label>
        <Input
          id="org-tarif"
          value={formData.tarif}
          onChange={(e) => setFormData((p) => ({ ...p, tarif: e.target.value }))}
        />
      </div>

      <div>
        <Label>Photo</Label>
        <div className="mt-1 flex items-center gap-3">
          {formData.url_image ? (
            <img
              src={formData.url_image}
              alt=""
              className="h-20 w-16 rounded object-cover border bg-white flex-shrink-0"
            />
          ) : (
            <div className="h-20 w-16 rounded border bg-muted flex items-center justify-center flex-shrink-0">
              <Camera className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById('org-image-upload')?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Upload...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  {formData.url_image ? 'Changer la photo' : 'Ajouter une photo'}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">Format vertical recommandé. Max 5 Mo.</p>
          </div>
          <input
            id="org-image-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleImageUpload}
            className="hidden"
            disabled={uploading}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="org-description">Description</Label>
        <Textarea
          id="org-description"
          value={formData.description_event}
          onChange={(e) => setFormData((p) => ({ ...p, description_event: e.target.value }))}
          rows={10}
          className="mt-1"
          placeholder="Décrivez votre salon..."
        />
        {seo && (
          <div className="mt-2 space-y-2">
            <span
              className={
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                (seo.score >= 80
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800')
              }
            >
              {seo.score >= 80 ? 'Qualité SEO : Super' : 'Qualité SEO : Alerte'} · {seo.score}/100
            </span>
            {seo.advice.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <div className="font-medium">Pour améliorer :</div>
                <ul className="list-disc pl-5">
                  {seo.advice.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Visez un score Super pour un bon référencement de votre salon sur Google.
            </p>
          </div>
        )}
      </div>

      {!hasChanges && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" /> Aucune modification pour le moment.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!hasChanges || submitting || uploading}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Envoi...
            </>
          ) : (
            'Envoyer pour validation'
          )}
        </Button>
      </div>
    </div>
  );
};

export default OrganizerEventEditForm;