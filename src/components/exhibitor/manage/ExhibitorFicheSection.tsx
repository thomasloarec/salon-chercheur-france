import { useEffect, useRef, useState } from 'react';
import {
  Award,
  Building2,
  Check,
  FileText,
  Globe,
  Image as ImageIcon,
  Linkedin,
  Loader2,
  Lock,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

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
import type { ExhibitorCompletion, ExhibitorTier } from '@/hooks/useExhibitorCompletion';

const DESCRIPTION_MAX = 3000;

const TIER_META: Record<ExhibitorTier, { label: string; className: string }> = {
  bronze: { label: 'Bronze', className: 'border-border bg-muted text-muted-foreground' },
  argent: { label: 'Argent', className: 'border-border/40 bg-border/60 text-muted-foreground' },
  or: { label: 'Or', className: 'border-primary/40 bg-primary/10 text-primary' },
};

interface ExhibitorFicheSectionProps {
  exhibitorId: string;
  publicSlug: string | null;
  exhibitorName: string;
  resolvedDescription: string | null;
  completion?: ExhibitorCompletion;
  completionLoading: boolean;
  /** Bascule vers la section « Mon équipe » (item de gouvernance). */
  onGoToTeam: () => void;
}

export default function ExhibitorFicheSection({
  exhibitorId,
  publicSlug,
  exhibitorName,
  resolvedDescription,
  completion,
  completionLoading,
  onGoToTeam,
}: ExhibitorFicheSectionProps) {
  const { data: editable, isLoading, isError } = useExhibitorEditableFields(exhibitorId, true);
  const updateMutation = useExhibitorOwnerUpdate(publicSlug);

  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (editable && !initialized.current) {
      setDescription(resolveDescriptionPrefill(editable, resolvedDescription));
      setWebsite(editable.website ?? '');
      setLinkedin(editable.linkedin_url ?? '');
      setLogoUrl(editable.logo_url ?? null);
      initialized.current = true;
    }
  }, [editable, resolvedDescription]);

  useEffect(() => {
    return () => {
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    };
  }, [pendingLogoPreview]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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

  const trimmedWebsite = website.trim();
  const trimmedLinkedin = linkedin.trim();
  const websiteInvalid = trimmedWebsite.length > 0 && normalizeExternalUrl(trimmedWebsite) === null;
  const linkedinInvalid =
    trimmedLinkedin.length > 0 && normalizeLinkedInUrl(trimmedLinkedin) === null;
  const descriptionTooLong = description.length > DESCRIPTION_MAX;
  const canSave = !saving && !websiteInvalid && !linkedinInvalid && !descriptionTooLong;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      if (pendingLogo) {
        finalLogoUrl = await uploadExhibitorLogo(exhibitorId, pendingLogo);
      }
      await updateMutation.mutateAsync({
        exhibitor_id: exhibitorId,
        description: description.trim().length > 0 ? description.trim() : null,
        website: trimmedWebsite.length > 0 ? trimmedWebsite : null,
        linkedin_url: trimmedLinkedin.length > 0 ? trimmedLinkedin : null,
        logo_url: finalLogoUrl,
      });
      setLogoUrl(finalLogoUrl);
      setPendingLogo(null);
      setPendingLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.success('Fiche mise à jour', {
        description: 'Vos modifications sont visibles sur votre fiche publique.',
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'La sauvegarde a échoué. Veuillez réessayer.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const previewLogo = pendingLogoPreview ?? logoUrl;

  const focusField = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => (el as HTMLElement).focus(), 350);
  };

  const items = completion
    ? ([
        {
          key: 'description',
          label: 'Description (120 caractères minimum)',
          icon: FileText,
          done: completion.has_description,
          action: () => focusField('exhibitor-description'),
        },
        {
          key: 'logo',
          label: 'Logo',
          icon: ImageIcon,
          done: completion.has_logo,
          action: () => focusField('exhibitor-logo-trigger'),
        },
        {
          key: 'website',
          label: 'Site officiel',
          icon: Globe,
          done: completion.has_website,
          action: () => focusField('exhibitor-website'),
        },
        {
          key: 'linkedin',
          label: 'Page LinkedIn',
          icon: Linkedin,
          done: completion.has_linkedin,
          action: () => focusField('exhibitor-linkedin'),
        },
        {
          key: 'governance',
          label: 'Gouvernance de la page',
          icon: Users,
          done: completion.governance_confirmed,
          action: onGoToTeam,
        },
      ] as const)
    : [];

  return (
    <div className="space-y-6">
      {/* Complétude */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold">Complétude de votre fiche</h3>
          {completion && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {completion.profile_score}/100
              </span>
              {completion.tier && (
                <Badge variant="outline" className={`gap-1 ${TIER_META[completion.tier].className}`}>
                  <Award className="h-3 w-3" />
                  {TIER_META[completion.tier].label}
                </Badge>
              )}
            </div>
          )}
        </div>

        {completionLoading || !completion ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : (
          <>
            <Progress value={completion.profile_score} className="h-2" />
            <ul className="space-y-1.5">
              {items.map((item) => {
                const Icon = item.icon;
                if (item.done) {
                  return (
                    <li
                      key={item.key}
                      className="flex items-center gap-2 py-1 text-sm text-muted-foreground"
                    >
                      <Check className="h-4 w-4 text-info flex-shrink-0" />
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </li>
                  );
                }
                return (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 flex-shrink-0"
                      onClick={item.action}
                    >
                      Compléter
                    </Button>
                  </li>
                );
              })}
            </ul>
            {!completion.governance_confirmed && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                La gouvernance se confirme dans la section « Mon équipe ».
              </p>
            )}
          </>
        )}
      </Card>

      <Card className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Impossible de charger les informations de la fiche. Réessayez plus tard.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-20 h-20 rounded-xl bg-card border flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                    id="exhibitor-logo-trigger"
                    htmlFor="exhibitor-logo-input"
                    tabIndex={-1}
                    className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
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
                    JPEG, PNG ou WebP, 5 Mo maximum.
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
                rows={8}
                disabled={saving}
                maxLength={DESCRIPTION_MAX + 100}
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Cette description est affichée sur votre fiche exposant publique.
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

            {/* Site officiel */}
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
                Ajoutez uniquement la page LinkedIn de l'entreprise, pas un profil personnel.
              </p>
              {linkedinInvalid && (
                <p className="text-xs text-destructive">
                  Seules les pages entreprise LinkedIn (/company/ ou /showcase/) sont acceptées.
                </p>
              )}
            </div>

            {/* Aperçu local */}
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
                  Aucune description pour le moment.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {trimmedWebsite && !websiteInvalid && (
                  <Badge variant="outline" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Site officiel
                  </Badge>
                )}
                {trimmedLinkedin && !linkedinInvalid && (
                  <Badge variant="outline" className="gap-1">
                    <Linkedin className="h-3 w-3" />
                    LinkedIn
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={!canSave}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer les modifications
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
