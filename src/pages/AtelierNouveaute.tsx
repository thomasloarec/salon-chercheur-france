import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ImagePlus, Loader2, X, FileText } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NoveltyPreviewCard, {
  NOVELTY_TYPE_LABELS,
} from '@/components/novelty/atelier/NoveltyPreviewCard';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const REASON_MIN = 10;
const REASON_MAX = 1000;
const SUMMARY_MAX = 500;
const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const sanitizeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase();

interface PickedImage {
  file: File;
  previewUrl: string;
}

export default function AtelierNouveaute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isRealUser, loading: authLoading } = useAuth() as any;

  const eventId = params.get('event') || '';
  const exhibitorId = params.get('exhibitor') || '';

  const [title, setTitle] = useState('');
  const [type, setType] = useState('Launch');
  const [reason, setReason] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [summary, setSummary] = useState('');
  const [reason2, setReason2] = useState('');
  const [reason3, setReason3] = useState('');
  const [audienceInput, setAudienceInput] = useState('');
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
  const [brochure, setBrochure] = useState<File | null>(null);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: event } = useQuery({
    queryKey: ['atelier-event', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, nom_event, slug, ville')
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: exhibitor } = useQuery({
    queryKey: ['atelier-exhibitor', exhibitorId],
    enabled: !!exhibitorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exhibitors')
        .select('id, name, logo_url')
        .eq('id', exhibitorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const canPublish =
    title.trim().length >= TITLE_MIN &&
    title.trim().length <= TITLE_MAX &&
    reason.trim().length >= REASON_MIN &&
    reason.trim().length <= REASON_MAX &&
    images.length >= 1 &&
    !!eventId &&
    !!exhibitorId &&
    !submitting;

  const previewData = useMemo(
    () => ({
      title: title.trim(),
      type,
      reason_1: reason.trim() || undefined,
      reason_2: reason2.trim() || undefined,
      reason_3: reason3.trim() || undefined,
      audience_tags: audienceTags,
      media_urls: images.map((i) => i.previewUrl),
      doc_url: brochure ? 'local' : null,
      exhibitorName: exhibitor?.name || 'Votre entreprise',
      exhibitorLogoUrl: exhibitor?.logo_url || null,
    }),
    [title, type, reason, reason2, reason3, audienceTags, images, brochure, exhibitor],
  );

  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const next: PickedImage[] = [];
    for (const file of Array.from(files)) {
      if (images.length + next.length > MAX_IMAGES) {
        toast({ title: `Maximum ${MAX_IMAGES} images`, variant: 'destructive' });
        break;
      }
      if (!IMAGE_TYPES.includes(file.type)) {
        toast({ title: `${file.name} : format non accepté (JPG, PNG, WEBP)`, variant: 'destructive' });
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast({ title: `${file.name} : dépasse 5 Mo`, variant: 'destructive' });
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length) setImages((prev) => [...prev, ...next]);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handlePdf = (file: File | null) => {
    if (!file) return setBrochure(null);
    if (file.type !== 'application/pdf') {
      toast({ title: 'Le document doit être un PDF', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      toast({ title: 'Le PDF dépasse 20 Mo', variant: 'destructive' });
      return;
    }
    setBrochure(file);
  };

  const addTag = () => {
    const t = audienceInput.trim();
    if (!t) return;
    if (!audienceTags.includes(t)) setAudienceTags((prev) => [...prev, t]);
    setAudienceInput('');
  };

  const uploadFile = async (file: File, folder: 'images' | 'brochures') => {
    const filePath = `${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from('novelties').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('novelties').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      for (const img of images) {
        imageUrls.push(await uploadFile(img.file, 'images'));
      }
      const brochureUrl = brochure ? await uploadFile(brochure, 'brochures') : null;

      const payload: Record<string, unknown> = {
        event_id: eventId,
        exhibitor_id: exhibitorId,
        title: title.trim(),
        novelty_type: type,
        reason: reason.trim(),
        images: imageUrls,
        brochure_pdf: brochureUrl,
      };
      if (reason2.trim()) payload.reason_2 = reason2.trim();
      if (reason3.trim()) payload.reason_3 = reason3.trim();
      if (summary.trim()) payload.summary = summary.trim();
      if (audienceTags.length > 0) payload.audience_tags = audienceTags;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novelties-create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        /* pas de corps JSON */
      }

      if (!res.ok) {
        if (res.status === 403 && json?.code === 'EXHIBITOR_ALREADY_MANAGED') {
          toast({
            title: 'Entreprise déjà administrée',
            description:
              "Cette entreprise est déjà gérée par une autre personne. Demandez-lui de vous ajouter à l'équipe pour publier.",
            variant: 'destructive',
          });
        } else if (res.status === 403) {
          toast({
            title: 'Quota atteint',
            description:
              json?.message || 'Vous avez atteint le nombre de nouveautés autorisées pour ce salon.',
            variant: 'destructive',
          });
        } else if (res.status === 400) {
          const details = json?.details as Record<string, string[]> | undefined;
          const lisible = details
            ? Object.entries(details)
                .map(([k, v]) => `${k} : ${v.join(', ')}`)
                .join(' · ')
            : json?.message || 'Certaines informations sont invalides.';
          toast({ title: 'Publication refusée', description: lisible, variant: 'destructive' });
        } else {
          toast({
            title: 'Publication impossible',
            description: json?.message || `Erreur ${res.status}`,
            variant: 'destructive',
          });
        }
        return;
      }

      toast({
        title: 'Nouveauté publiée ✓',
        description: 'Elle apparaîtra sur la page du salon.',
      });
      navigate(event?.slug ? `/events/${event.slug}` : '/nouveautes');
    } catch (e: any) {
      toast({
        title: 'Une erreur est survenue',
        description: e?.message || 'Réessayez dans un instant.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // --- États bloquants ---
  if (!authLoading && !isRealUser) {
    return (
      <MainLayout title="Publier une nouveauté">
        <div className="max-w-lg mx-auto py-24 text-center space-y-4">
          <h1 className="heading-display text-2xl">Connectez-vous pour publier</h1>
          <p className="text-muted-foreground">
            La publication d'une nouveauté nécessite un compte professionnel.
          </p>
          <Button asChild>
            <Link to="/auth">Se connecter</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (!eventId || !exhibitorId) {
    return (
      <MainLayout title="Atelier nouveauté">
        <div className="max-w-lg mx-auto py-24 text-center space-y-4">
          <h1 className="heading-display text-2xl">Salon ou exposant manquant</h1>
          <p className="text-muted-foreground">
            Ouvrez l'atelier avec l'adresse{' '}
            <code className="text-xs">/publier-nouveaute/atelier?event=…&amp;exhibitor=…</code>
          </p>
          <Button variant="outline" asChild>
            <Link to="/publier-nouveaute">Choisir un salon</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex" />
      </Helmet>
      <MainLayout title="Publier une nouveauté">
        <div className="py-8 md:py-12">
          {/* En-tête */}
          <div className="flex items-center justify-between gap-4 mb-10 border-b pb-6">
            <button
              type="button"
              onClick={() => navigate(event?.slug ? `/events/${event.slug}` : -1 as any)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {event?.nom_event || 'Retour'}
            </button>
            <h1 className="heading-display text-xl md:text-2xl">Publier une nouveauté</h1>
          </div>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
            {/* Colonne de saisie */}
            <div className="space-y-10">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Titre de la nouveauté
                </Label>
                <Input
                  id="title"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Presse hydraulique X200, pilotage à distance"
                  className="h-12 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  {TITLE_MIN} à {TITLE_MAX} caractères · {title.trim().length}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOVELTY_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium">
                  Pourquoi venir la voir ?
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  maxLength={REASON_MAX}
                  onChange={(e) => setReason(e.target.value)}
                  rows={7}
                  placeholder="Ce que le visiteur verra, comprendra ou repartira avec, sur votre stand."
                  className="text-base resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {REASON_MIN} à {REASON_MAX} caractères · {reason.trim().length}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Images (1 à 3, requis)</Label>
                <div className="flex flex-wrap gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={img.previewUrl}
                      className="relative h-24 w-24 rounded-lg overflow-hidden border bg-muted"
                    >
                      <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 rounded-full bg-background/90 border p-1"
                        aria-label="Retirer l'image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <label
                      className={cn(
                        'h-24 w-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors',
                        images.length === 0 && 'border-foreground/25',
                      )}
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[11px]">Ajouter</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleImages(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP · 5 Mo maximum par image</p>
              </div>

              {/* Repli discret */}
              <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', extrasOpen && 'rotate-180')}
                  />
                  Éléments complémentaires
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-6 space-y-8">
                  <div className="space-y-2">
                    <Label htmlFor="summary" className="text-sm font-medium">
                      Résumé court
                    </Label>
                    <Textarea
                      id="summary"
                      value={summary}
                      maxLength={SUMMARY_MAX}
                      rows={3}
                      onChange={(e) => setSummary(e.target.value)}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {summary.length} / {SUMMARY_MAX}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason2" className="text-sm font-medium">
                      Deuxième raison
                    </Label>
                    <Textarea
                      id="reason2"
                      value={reason2}
                      maxLength={REASON_MAX}
                      rows={3}
                      onChange={(e) => setReason2(e.target.value)}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason3" className="text-sm font-medium">
                      Troisième raison
                    </Label>
                    <Textarea
                      id="reason3"
                      value={reason3}
                      maxLength={REASON_MAX}
                      rows={3}
                      onChange={(e) => setReason3(e.target.value)}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audience" className="text-sm font-medium">
                      Profils visés
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="audience"
                        value={audienceInput}
                        onChange={(e) => setAudienceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Ex : responsable maintenance"
                      />
                      <Button type="button" variant="outline" onClick={addTag}>
                        Ajouter
                      </Button>
                    </div>
                    {audienceTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {audienceTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => setAudienceTags((p) => p.filter((t) => t !== tag))}
                          >
                            {tag} <X className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Document de présentation (PDF)</Label>
                    {brochure ? (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[280px]">{brochure.name}</span>
                        <button
                          type="button"
                          onClick={() => setBrochure(null)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Retirer le PDF"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground border rounded-lg px-4 py-2 cursor-pointer hover:text-foreground transition-colors">
                        <FileText className="h-4 w-4" />
                        Choisir un PDF (20 Mo max)
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            handlePdf(e.target.files?.[0] || null);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="pt-2 space-y-2">
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={!canPublish}
                  onClick={handlePublish}
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Publier ma nouveauté
                </Button>
                {!canPublish && !submitting && (
                  <p className="text-xs text-muted-foreground">
                    Il faut un titre, un texte et au moins une image.
                  </p>
                )}
              </div>
            </div>

            {/* Colonne aperçu */}
            <div className="lg:sticky lg:top-24 lg:self-start space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Aperçu en direct
              </p>
              <div className="rounded-2xl bg-muted/30 border p-4 md:p-6">
                <NoveltyPreviewCard data={previewData} />
              </div>
              <p className="text-xs text-muted-foreground">
                Tout ce que vous saisissez apparaît ici, tel qu'un visiteur le verra.
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    </>
  );
}