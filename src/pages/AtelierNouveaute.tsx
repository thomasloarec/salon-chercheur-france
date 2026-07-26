import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Loader2, X, PanelRightOpen, CheckCircle2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NoveltyDetailView from '@/components/novelty/NoveltyDetailView';
import NoveltyAiAssistant, { type NoveltyAngle } from '@/components/novelty/NoveltyAiAssistant';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const REASON_MIN = 10;
const REASON_MAX = 1000;
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
  const [type, setType] = useState('');
  const [reason, setReason] = useState('');
  const [reason2, setReason2] = useState<string | null>(null);
  const [reason3, setReason3] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [brochure, setBrochure] = useState<File | null>(null);
  const [audienceInput, setAudienceInput] = useState('');
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
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
        .select('id, nom_event, slug, ville, date_debut')
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

  /* ---------------- Canevas : la Nouveauté brouillon ---------------- */

  const draft = useMemo(
    () => ({
      title,
      type,
      reason_1: reason,
      reason_2: reason2,
      reason_3: reason3,
      summary,
      media_urls: images.map((i) => i.previewUrl),
      doc_url: null,
      exhibitor_display_name: exhibitor?.name || 'Votre entreprise',
      exhibitor_logo_url: exhibitor?.logo_url || null,
      event_name: (event as any)?.nom_event ?? null,
      event_ville: (event as any)?.ville ?? null,
      event_date_debut: (event as any)?.date_debut ?? null,
    }),
    [title, type, reason, reason2, reason3, summary, images, exhibitor, event],
  );

  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const next: PickedImage[] = [];
    for (const file of Array.from(files)) {
      if (images.length + next.length >= MAX_IMAGES) {
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

  const reorderImages = (from: number, to: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
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

  /* ---------------- Assistant IA : application d'un angle ---------------- */

  const canvasHasContent =
    title.trim().length > 0 ||
    reason.trim().length > 0 ||
    (reason2 ?? '').trim().length > 0 ||
    (reason3 ?? '').trim().length > 0 ||
    summary.trim().length > 0;

  const applyAngle = (angle: NoveltyAngle) => {
    setTitle(angle.title || '');
    if (angle.type) setType(angle.type);
    setReason(angle.reason_1 || '');
    setReason2(angle.reason_2 ?? null);
    setReason3(angle.reason_3 ?? null);
    setSummary(angle.summary || '');
    if (Array.isArray(angle.audience_tags)) setAudienceTags(angle.audience_tags.filter(Boolean));
    toast({
      title: 'Angle appliqué',
      description: 'Ajustez librement chaque zone du canevas.',
    });
  };

  /* ---------------- Complétude ---------------- */

  const missing: string[] = [];
  if (title.trim().length < TITLE_MIN) missing.push('Écrivez un titre (3 caractères minimum)');
  if (title.trim().length > TITLE_MAX) missing.push('Le titre dépasse 120 caractères');
  if (reason.trim().length < REASON_MIN)
    missing.push('Dites pourquoi venir la voir (10 caractères minimum)');
  if (reason.trim().length > REASON_MAX) missing.push('La raison dépasse 1000 caractères');
  if (!type) missing.push('Choisissez le type de nouveauté');
  if (images.length === 0) missing.push('Ajoutez au moins une image');

  const canPublish = missing.length === 0 && !!eventId && !!exhibitorId && !submitting;

  /* ---------------- Publication ---------------- */

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
      if (reason2?.trim()) payload.reason_2 = reason2.trim();
      if (reason3?.trim()) payload.reason_3 = reason3.trim();
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

  /* ---------------- États bloquants ---------------- */

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

  /* ---------------- Panneau droit ---------------- */

  const isReady = missing.length === 0 && !!eventId && !!exhibitorId;

  const publicationBar = isReady ? (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#6b51ff]" />
        Votre nouveauté est prête.
      </p>
      <Button
        onClick={handlePublish}
        disabled={!canPublish}
        className="w-full bg-[#6b51ff] text-white shadow-sm hover:bg-[#5b43e6]"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Publier ma nouveauté
      </Button>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-left text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
          >
            Encore {missing.length} élément{missing.length > 1 ? 's' : ''} à compléter avant de
            publier
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-72">
          <p className="mb-2 text-xs font-medium text-foreground">Avant de publier, complétez :</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {missing.map((m) => (
              <li key={m} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                {m}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        disabled
        className="shrink-0 text-xs text-muted-foreground/70"
        size="sm"
      >
        Publier
      </Button>
    </div>
  );

  const panelRest = (
    <div className="space-y-8">
      {/* Assistant IA */}
      <NoveltyAiAssistant
        eventId={eventId}
        exhibitorId={exhibitorId}
        currentType={type || undefined}
        canvasHasContent={canvasHasContent}
        onApplyAngle={applyAngle}
      />

      {/* Détails optionnels */}
      <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown className={cn('h-4 w-4 transition-transform', extrasOpen && 'rotate-180')} />
          Détails optionnels
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-4">
          <Label htmlFor="audience" className="text-xs font-medium">
            Profils visés (facultatif)
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
              placeholder="Ex : responsable production"
              className="h-9 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag}>
              Ajouter
            </Button>
          </div>
          {audienceTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {audienceTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setAudienceTags((prev) => prev.filter((x) => x !== t))}
                    aria-label={`Retirer ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  const panel = (
    <div className="space-y-6">
      {panelRest}
      <div className="border-t pt-4">{publicationBar}</div>
    </div>
  );

  const canvas = (
    <NoveltyDetailView
      novelty={draft}
      editable
      brochureName={brochure?.name ?? null}
      onTitleChange={setTitle}
      onTypeChange={setType}
      onReason1Change={setReason}
      onReason2Change={setReason2}
      onReason3Change={setReason3}
      onSummaryChange={setSummary}
      onAddImages={handleImages}
      onRemoveImage={removeImage}
      onReorderImages={reorderImages}
      onSetBrochure={handlePdf}
    />
  );

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex" />
      </Helmet>
      <MainLayout title="Publier une nouveauté">
        <div className="py-8 md:py-12">
          <div className="mb-8 flex items-center justify-between gap-4 border-b pb-6">
            <button
              type="button"
              onClick={() => navigate(event?.slug ? `/events/${event.slug}` : (-1 as any))}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {event?.nom_event || 'Retour'}
            </button>
            <div className="flex items-center gap-3">
              <h1 className="heading-display text-xl md:text-2xl">Publier une nouveauté</h1>
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <PanelRightOpen className="h-4 w-4" />
                      Publier
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                    <div className="pt-4">{panel}</div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
            <div className="min-w-0 flex-1">{canvas}</div>
            <aside className="hidden w-[360px] shrink-0 lg:block xl:w-[380px]">
              <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col border-l bg-muted/30">
                <div className="min-h-0 flex-1 overflow-y-auto p-5">{panelRest}</div>
                <div
                  className={cn(
                    'shrink-0 border-t p-4',
                    isReady ? 'border-[#6b51ff]/20 bg-background' : 'bg-muted/40',
                  )}
                >
                  {publicationBar}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </MainLayout>
    </>
  );
}
