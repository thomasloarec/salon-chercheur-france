import { useEffect, useRef, useState } from 'react';
import { Building2, CalendarDays, Globe, Linkedin, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

import { normalizeExternalUrl, normalizeLinkedInUrl } from '@/lib/urlUtils';
import {
  LOGO_ACCEPT_ATTR,
  uploadExhibitorLogo,
  validateLogoFile,
} from '@/lib/exhibitorLogoUpload';
import {
  useExhibitorEditableFields,
  useExhibitorOwnerUpdate,
} from '@/hooks/useExhibitorOwnerEdit';
import { resolveDescriptionPrefill } from '@/lib/exhibitorOwnerEdit';

const DESCRIPTION_MAX = 3000;

interface ParticipationRow {
  id_participation: string;
  id_event: string;
  stand_exposant: string | null;
  events: {
    nom_event: string | null;
    date_debut: string | null;
    ville: string | null;
  } | null;
}

function formatEventDate(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Section « Vos salons et stands » — indépendante des champs de fiche. */
function ExhibitorStandsSection({
  exhibitorId,
  open,
}: {
  exhibitorId: string;
  open: boolean;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exhibitor-participations-stands', exhibitorId],
    enabled: open && !!exhibitorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participation')
        .select(
          'id_participation, id_event, stand_exposant, events!inner(nom_event, date_debut, ville)',
        )
        .eq('exhibitor_id', exhibitorId);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ParticipationRow[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ts = (r: ParticipationRow) => {
        const d = r.events?.date_debut ? new Date(r.events.date_debut) : null;
        return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
      };
      const upcoming = (r: ParticipationRow) => ts(r) >= today.getTime();
      return rows.sort((a, b) => {
        const ua = upcoming(a) ? 0 : 1;
        const ub = upcoming(b) ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return ua === 0 ? ts(a) - ts(b) : ts(b) - ts(a);
      });
    },
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setDrafts({});
  }, [open]);

  const handleSaveStand = async (row: ParticipationRow) => {
    const current = row.stand_exposant ?? '';
    const next = (drafts[row.id_participation] ?? current).trim();
    if (next === current.trim()) return;
    setSavingId(row.id_participation);
    try {
      const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
        body: {
          action: 'set_stand',
          exhibitor_id: exhibitorId,
          event_id: row.id_event,
          stand: next,
        },
      });
      if (error) throw error;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      toast.success('Stand mis à jour');
      await refetch();
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[row.id_participation];
        return copy;
      });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "La mise à jour du stand a échoué.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-3 border-t pt-6">
      <div>
        <Label className="text-base">Vos salons et stands</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Renseignez votre numéro de stand pour chaque salon. Il sera affiché sur
          la fiche du salon.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Impossible de charger vos salons. Réessayez plus tard.
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Vous n'êtes référencé sur aucun salon pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => {
            const current = row.stand_exposant ?? '';
            const value = drafts[row.id_participation] ?? current;
            const dirty = value.trim() !== current.trim();
            const busy = savingId === row.id_participation;
            const dateLabel = formatEventDate(row.events?.date_debut ?? null);
            return (
              <li
                key={row.id_participation}
                className="rounded-lg border bg-muted/20 p-3 space-y-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {row.events?.nom_event ?? 'Salon'}
                  </p>
                  {(dateLabel || row.events?.ville) && (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {[dateLabel, row.events?.ville].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={value}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id_participation]: e.target.value,
                      }))
                    }
                    placeholder="Numéro de stand (ex. B12)"
                    maxLength={50}
                    disabled={busy}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveStand(row)}
                    disabled={!dirty || busy}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Enregistrer'
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface ExhibitorOwnerEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modern exhibitor UUID — guaranteed present (legacy-pure is short-circuited). */
  exhibitorId: string;
  publicSlug: string | null;
  exhibitorName: string;
  /**
   * Bloc C — description ACTUELLEMENT affichée et résolue sur la fiche publique
   * (owner > IA > legacy, déjà nettoyée). Sert de fallback de préremplissage
   * quand exhibitors.description brut est vide. La sauvegarde écrit toujours
   * exhibitors.description.
   */
  resolvedDescription?: string | null;
}

export default function ExhibitorOwnerEditDrawer({
  open,
  onOpenChange,
  exhibitorId,
  publicSlug,
  exhibitorName,
  resolvedDescription,
}: ExhibitorOwnerEditDrawerProps) {
  // Charge les champs ÉDITORIAUX BRUTS (exhibitors.*) uniquement à l'ouverture.
  const { data: editable, isLoading, isError } = useExhibitorEditableFields(
    exhibitorId,
    open,
  );
  const updateMutation = useExhibitorOwnerUpdate(publicSlug);

  // ── État local du formulaire (source unique de la prévisualisation) ──
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Logo en attente d'upload (aperçu local via createObjectURL).
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  // Préremplissage : UNIQUEMENT depuis exhibitors.* (jamais ai_summary,
  // jamais fallback legacy, jamais la valeur calculée de la vue).
  useEffect(() => {
    if (open && editable && !initialized.current) {
      setDescription(resolveDescriptionPrefill(editable, resolvedDescription));
      setWebsite(editable.website ?? '');
      setLinkedin(editable.linkedin_url ?? '');
      setLogoUrl(editable.logo_url ?? null);
      initialized.current = true;
    }
  }, [open, editable, resolvedDescription]);

  // Réinitialisation à la fermeture.
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      setPendingLogo(null);
      setPendingLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open]);

  // Nettoyage de l'objet URL au démontage.
  useEffect(() => {
    return () => {
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    };
  }, [pendingLogoPreview]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;
    const validation = validateLogoFile(file);
    if (!validation.ok) {
      toast.error(validation.error ?? 'Fichier invalide.');
      return;
    }
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogo(file);
    setPendingLogoPreview(URL.createObjectURL(file));
  };

  // Validation frontend (miroir du backend), n'altère pas l'état saisi.
  const trimmedWebsite = website.trim();
  const trimmedLinkedin = linkedin.trim();
  const websiteInvalid =
    trimmedWebsite.length > 0 && normalizeExternalUrl(trimmedWebsite) === null;
  const linkedinInvalid =
    trimmedLinkedin.length > 0 && normalizeLinkedInUrl(trimmedLinkedin) === null;
  const descriptionTooLong = description.length > DESCRIPTION_MAX;
  const canSave =
    !saving && !websiteInvalid && !linkedinInvalid && !descriptionTooLong;

  const handleSave = async () => {
    if (!canSave || saving) return; // garde anti double-clic
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;

      // 1) Upload du logo en attente, le cas échéant.
      if (pendingLogo) {
        finalLogoUrl = await uploadExhibitorLogo(exhibitorId, pendingLogo);
      }

      // 2) Sauvegarde des 4 champs publics via l'edge function.
      await updateMutation.mutateAsync({
        exhibitor_id: exhibitorId,
        description: description.trim().length > 0 ? description.trim() : null,
        website: trimmedWebsite.length > 0 ? trimmedWebsite : null,
        linkedin_url: trimmedLinkedin.length > 0 ? trimmedLinkedin : null,
        logo_url: finalLogoUrl,
      });

      toast.success('Fiche mise à jour', {
        description: 'Vos modifications sont visibles sur votre fiche publique.',
      });
      onOpenChange(false);
    } catch (err) {
      // Message lisible, valeurs conservées (pas de reset).
      const message =
        err instanceof Error && err.message
          ? err.message
          : "La sauvegarde a échoué. Veuillez réessayer.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Aperçu du logo : 100% état local (jamais d'appel réseau).
  const previewLogo = pendingLogoPreview ?? logoUrl;

  return (
    <Sheet open={open} onOpenChange={(o) => (!saving ? onOpenChange(o) : undefined)}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Modifier cette fiche</SheetTitle>
          <SheetDescription>
            Modifiez les informations publiques de {exhibitorName}. Ces
            informations sont affichées sur votre fiche exposant publique.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Impossible de charger les informations de la fiche. Réessayez plus
            tard.
          </p>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-white border flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {previewLogo ? (
                    <img
                      src={previewLogo}
                      alt={`Logo ${exhibitorName}`}
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="exhibitor-logo-input"
                    className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium hover:bg-primary"
                  >
                    <Upload className="h-4 w-4" />
                    {previewLogo ? 'Remplacer le logo' : 'Téléverser un logo'}
                  </Label>
                  <input
                    id="exhibitor-logo-input"
                    type="file"
                    accept={LOGO_ACCEPT_ATTR}
                    className="sr-only"
                    onChange={handleLogoSelect}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG ou WebP — 5 Mo maximum.
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="exhibitor-description">Description publique</Label>
              <Textarea
                id="exhibitor-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre entreprise en quelques lignes..."
                rows={6}
                disabled={saving}
                maxLength={DESCRIPTION_MAX + 100}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Cette description est affichée sur votre fiche exposant
                  publique.
                </p>
                <span
                  className={`text-xs ${
                    descriptionTooLong ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {description.length}/{DESCRIPTION_MAX}
                </span>
              </div>
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="exhibitor-website">Site officiel</Label>
              <Input
                id="exhibitor-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="exemple.fr"
                inputMode="url"
                disabled={saving}
                aria-invalid={websiteInvalid}
              />
              {websiteInvalid && (
                <p className="text-xs text-destructive">
                  Entrez une adresse de site valide (ex. exemple.fr).
                </p>
              )}
            </div>

            {/* LinkedIn */}
            <div className="space-y-2">
              <Label htmlFor="exhibitor-linkedin">Page LinkedIn</Label>
              <Input
                id="exhibitor-linkedin"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="linkedin.com/company/votre-entreprise"
                inputMode="url"
                disabled={saving}
                aria-invalid={linkedinInvalid}
              />
              <p className="text-xs text-muted-foreground">
                Ajoutez uniquement la page LinkedIn de l'entreprise, pas un
                profil personnel.
              </p>
              {linkedinInvalid && (
                <p className="text-xs text-destructive">
                  Seules les pages entreprise LinkedIn (/company/ ou /showcase/)
                  sont acceptées.
                </p>
              )}
            </div>

            {/* Prévisualisation rapide (100% état local) */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Aperçu
              </p>
              <p className="font-semibold">{exhibitorName}</p>
              {description.trim() ? (
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">
                  {description.trim()}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Aucune description.
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                {trimmedWebsite && !websiteInvalid && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" /> Site officiel
                  </span>
                )}
                {trimmedLinkedin && !linkedinInvalid && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                  </span>
                )}
              </div>
            </div>

            {/* Salons et stands (indépendant des champs de fiche) */}
            <ExhibitorStandsSection exhibitorId={exhibitorId} open={open} />
          </div>
        )}

        <SheetFooter className="mt-6 flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isLoading || isError}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              'Sauvegarder'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}