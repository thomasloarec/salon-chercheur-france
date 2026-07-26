import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  MapPin,
  Building2,
  Clock,
  FileText,
  Download,
  CalendarCheck,
  ChevronRight,
  ImagePlus,
  X,
  Plus,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { NOVELTY_TYPE_LABELS } from '@/hooks/useNoveltyPublic';
import { cn } from '@/lib/utils';

function isImage(url: string) {
  return /^blob:|^data:image\//i.test(url) || /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url);
}

/* ------------------------------------------------------------------ *
 * Édition en place — primitives internes (mode `editable` uniquement) *
 * ------------------------------------------------------------------ */

const EDITABLE_ZONE =
  'cursor-text rounded-md transition-colors hover:bg-muted/50 focus-within:bg-muted/40';

interface InPlaceTextProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  min?: number;
  max: number;
  className?: string;
  /** Message de limite affiché uniquement pendant l'édition. */
  hint?: string;
  ariaLabel: string;
}

/** Zone de texte auto-extensible, sans allure de formulaire. */
function InPlaceText({
  value,
  onChange,
  placeholder,
  min,
  max,
  className,
  hint,
  ariaLabel,
}: InPlaceTextProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const tooShort = min !== undefined && value.trim().length > 0 && value.trim().length < min;

  return (
    <div className={cn(EDITABLE_ZONE, '-mx-2 px-2 py-1')}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={max}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ring-0 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0',
          className,
        )}
      />
      {focused && (
        <p className="pt-1 text-[11px] text-muted-foreground/70">
          {hint ? `${hint} · ` : ''}
          <span className={cn('tabular-nums', tooShort && 'text-destructive')}>
            {value.trim().length}
          </span>
          /{max}
        </p>
      )}
    </div>
  );
}

/* --------------------------- Vignette triable --------------------------- */

function SortableImage({
  src,
  index,
  alt,
  onRemove,
}: {
  src: string;
  index: number;
  alt: string;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: src,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex max-h-[52vh] items-center justify-center overflow-hidden rounded-xl border bg-muted',
        isDragging && 'z-10 opacity-80 shadow-lg',
      )}
    >
      <img src={src} alt={alt} className="max-h-[52vh] w-auto max-w-full object-contain" />
      <span
        className={cn(
          'absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium',
          index === 0
            ? 'bg-foreground text-background'
            : 'bg-background/90 text-muted-foreground border',
        )}
      >
        {index === 0 ? "Image d'entête" : index + 1}
      </span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Déplacer l'image"
        className="absolute bottom-2 left-2 cursor-grab touch-none rounded-full border bg-background/90 p-1.5 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Retirer l'image"
        className="absolute right-2 top-2 rounded-full border bg-background/90 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Forme minimale nécessaire à l'affichage. Compatible PublicNovelty, mais
 * aussi avec un objet construit en mémoire (atelier de publication).
 */
export interface NoveltyDetailViewNovelty {
  title: string;
  type: string;
  reason_1?: string | null;
  reason_2?: string | null;
  reason_3?: string | null;
  summary?: string | null;
  details?: string | null;
  media_urls?: string[] | null;
  doc_url?: string | null;
  resource_url?: string | null;
  stand_info?: string | null;
  exhibitor_display_name?: string | null;
  exhibitor_logo_url?: string | null;
  exhibitor_public_slug?: string | null;
  event_slug?: string | null;
  event_name?: string | null;
  event_date_debut?: string | null;
  event_ville?: string | null;
}

export interface NoveltyDetailViewProps {
  novelty: NoveltyDetailViewNovelty;
  /** Nombre de « stands à voir ». Masqué si 0 ou non fourni. */
  likesCount?: number;
  isLiked?: boolean;
  onInterestToggle?: () => void;
  interestPending?: boolean;
  onRequestMeeting?: () => void;
  onDownloadBrochure?: () => void;
  /** Zone d'actions à droite des badges (menu « copier le lien » par ex.). */
  headerActions?: ReactNode;
  /**
   * Mode aperçu : aucun lien n'est cliquable, les boutons de la carte CTA sont
   * inertes, et des textes d'attente remplacent les champs vides.
   */
  preview?: boolean;
  /**
   * Mode édition en place (atelier) : les zones éditables deviennent des
   * éditeurs, les zones de contexte restent identiques aux autres modes.
   * Aucun chargement de données ici non plus.
   */
  editable?: boolean;
  onTitleChange?: (v: string) => void;
  onTypeChange?: (v: string) => void;
  onReason1Change?: (v: string) => void;
  onReason2Change?: (v: string | null) => void;
  onReason3Change?: (v: string | null) => void;
  onSummaryChange?: (v: string) => void;
  onAddImages?: (files: FileList | null) => void;
  onRemoveImage?: (index: number) => void;
  /** Réorganisation des images (glisser-déposer) en mode editable. */
  onReorderImages?: (from: number, to: number) => void;
  onSetBrochure?: (file: File | null) => void;
  /** Nom du PDF choisi, en mode editable. */
  brochureName?: string | null;
  className?: string;
}

/**
 * Présentation pure de la page « Nouveauté » (deux colonnes : visuel à gauche,
 * texte à droite). AUCUN hook de requête ici : toutes les données arrivent en
 * props, ce qui permet de réutiliser le même rendu dans l'atelier de création.
 */
export default function NoveltyDetailView({
  novelty,
  likesCount = 0,
  isLiked = false,
  onInterestToggle,
  interestPending = false,
  onRequestMeeting,
  onDownloadBrochure,
  headerActions,
  preview = false,
  editable = false,
  onTitleChange,
  onTypeChange,
  onReason1Change,
  onReason2Change,
  onReason3Change,
  onSummaryChange,
  onAddImages,
  onRemoveImage,
  onReorderImages,
  onSetBrochure,
  brochureName = null,
  className,
}: NoveltyDetailViewProps) {
  const typeLabel = NOVELTY_TYPE_LABELS[novelty.type] || novelty.type;
  const images = (novelty.media_urls ?? []).filter((u) => u && isImage(u)) as string[];
  const logo = getExhibitorLogoUrl(novelty.exhibitor_logo_url ?? undefined, undefined);
  const exhibitorName = novelty.exhibitor_display_name || 'Exposant';
  const imgAlt = `${novelty.title} – ${exhibitorName}`;

  const reasons = [novelty.reason_1, novelty.reason_2, novelty.reason_3].filter(
    Boolean,
  ) as string[];

  const inert = preview || editable;
  const MAX_IMAGES = 3;
  const canAddReason =
    editable &&
    (novelty.reason_2 === null || novelty.reason_2 === undefined
      ? true
      : novelty.reason_3 === null || novelty.reason_3 === undefined);

  const daysUntil = novelty.event_date_debut
    ? differenceInDays(new Date(novelty.event_date_debut), new Date())
    : null;
  const isImminent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14;
  const countdownLabel =
    daysUntil === null
      ? null
      : daysUntil <= 0
        ? 'En cours'
        : daysUntil === 1
          ? 'J-1'
          : `J-${daysUntil}`;

  const isPastEvent = novelty.event_date_debut
    ? new Date(novelty.event_date_debut).getTime() < new Date().setHours(0, 0, 0, 0)
    : false;

  const hasBrochure = !!(novelty.doc_url || novelty.resource_url);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = images.indexOf(String(active.id));
    const to = images.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorderImages?.(from, to);
  };

  return (
    <div className={cn('grid grid-cols-1 gap-8 lg:grid-cols-2', className)}>
      {/* LEFT — image carousel, original aspect, capped height on mobile */}
      <div className={cn(!inert && 'lg:sticky lg:top-24 lg:self-start')}>
        {editable ? (
          <div className="space-y-3">
            {images.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={images} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 gap-3">
                    {images.map((src, i) => (
                      <SortableImage
                        key={src}
                        src={src}
                        index={i}
                        alt={`${imgAlt} (${i + 1})`}
                        onRemove={() => onRemoveImage?.(i)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null}
            {images.length < MAX_IMAGES && (
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground',
                  images.length === 0 ? 'aspect-[4/5]' : 'h-24',
                )}
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-sm">
                  {images.length === 0 ? 'Ajouter une image' : 'Ajouter une autre image'}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {images.length}/{MAX_IMAGES}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onAddImages?.(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">
              Format vertical recommandé (4:5). JPG, PNG ou WEBP, 5 Mo maximum par image.
              {images.length > 1 && ' Glissez les vignettes pour changer l’image d’entête.'}
            </p>
          </div>
        ) : images.length > 0 ? (
          <Carousel className="w-full" opts={{ loop: images.length > 1 }}>
            <CarouselContent>
              {images.map((src, i) => (
                <CarouselItem key={src}>
                  <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-xl border bg-muted lg:max-h-none">
                    <img
                      src={src}
                      alt={images.length > 1 ? `${imgAlt} (${i + 1}/${images.length})` : imgAlt}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      className="max-h-[60vh] w-auto max-w-full object-contain lg:max-h-[72vh]"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border bg-gradient-to-br from-muted to-muted/40">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            {preview && (
              <span className="text-xs text-muted-foreground/70">
                Votre image apparaîtra ici
              </span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT — vertical details column */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/70"
                >
                  {typeLabel}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {Object.entries(NOVELTY_TYPE_LABELS).map(([value, label]) => (
                  <DropdownMenuItem key={value} onSelect={() => onTypeChange?.(value)}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="secondary" className="font-medium">{typeLabel}</Badge>
          )}
          {countdownLabel && (
            <span
              className={
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ' +
                (isImminent
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-foreground/80')
              }
            >
              <Clock className="h-3 w-3" />
              {countdownLabel}
            </span>
          )}
          {headerActions && <div className="ml-auto">{headerActions}</div>}
        </div>

        {editable ? (
          <InPlaceText
            value={novelty.title || ''}
            onChange={(v) => onTitleChange?.(v)}
            placeholder="Votre titre"
            ariaLabel="Titre de la nouveauté"
            min={3}
            max={120}
            hint="3 à 120 caractères"
            className="heading-display text-2xl font-bold leading-tight tracking-tight md:text-3xl"
          />
        ) : (
          <h1
            className={cn(
              'heading-display text-2xl font-bold leading-tight tracking-tight md:text-3xl',
              preview && !novelty.title && 'font-normal italic text-muted-foreground/50',
            )}
          >
            {novelty.title || (preview ? 'Votre titre apparaîtra ici' : '')}
          </h1>
        )}

        {/* Exhibitor */}
        <div className="flex items-center gap-3">
          {logo ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white">
              <img src={logo} alt={exhibitorName} className="max-h-full max-w-full object-contain" loading="lazy" />
            </span>
          ) : (
            <Building2 className="h-8 w-8 shrink-0 text-muted-foreground" />
          )}
          {novelty.exhibitor_public_slug && !inert ? (
            <Link
              to={`/exposants/${novelty.exhibitor_public_slug}`}
              className="font-semibold text-primary hover:underline"
            >
              {exhibitorName}
            </Link>
          ) : (
            <span className="font-semibold">{exhibitorName}</span>
          )}
          {novelty.stand_info && (
            <span className="text-sm text-primary font-medium">· Stand {novelty.stand_info}</span>
          )}
        </div>

        {/* Reasons to visit */}
        {editable ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pourquoi c'est intéressant
            </h2>
            <div className="flex gap-2">
              <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-foreground" />
              <div className="min-w-0 flex-1">
                <InPlaceText
                  value={novelty.reason_1 || ''}
                  onChange={(v) => onReason1Change?.(v)}
                  placeholder="Pourquoi faut-il venir la voir ?"
                  ariaLabel="Raison principale"
                  min={10}
                  max={1000}
                  hint="10 à 1000 caractères"
                  className="text-sm leading-relaxed"
                />
              </div>
            </div>
            {novelty.reason_2 !== null && novelty.reason_2 !== undefined && (
              <div className="flex gap-2">
                <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-foreground" />
                <div className="min-w-0 flex-1">
                  <InPlaceText
                    value={novelty.reason_2 || ''}
                    onChange={(v) => onReason2Change?.(v)}
                    placeholder="Une deuxième raison"
                    ariaLabel="Deuxième raison"
                    max={1000}
                    className="text-sm leading-relaxed"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onReason2Change?.(null)}
                  aria-label="Retirer cette raison"
                  className="mt-1 h-fit rounded p-1 text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {novelty.reason_3 !== null && novelty.reason_3 !== undefined && (
              <div className="flex gap-2">
                <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-foreground" />
                <div className="min-w-0 flex-1">
                  <InPlaceText
                    value={novelty.reason_3 || ''}
                    onChange={(v) => onReason3Change?.(v)}
                    placeholder="Une troisième raison"
                    ariaLabel="Troisième raison"
                    max={1000}
                    className="text-sm leading-relaxed"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onReason3Change?.(null)}
                  aria-label="Retirer cette raison"
                  className="mt-1 h-fit rounded p-1 text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {canAddReason && (
              <button
                type="button"
                onClick={() =>
                  novelty.reason_2 === null || novelty.reason_2 === undefined
                    ? onReason2Change?.('')
                    : onReason3Change?.('')
                }
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> ajouter une raison
              </button>
            )}
          </div>
        ) : reasons.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pourquoi c'est intéressant
            </h2>
            <ul className="space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span className="whitespace-pre-line">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : preview ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pourquoi c'est intéressant
            </h2>
            <p className="text-sm italic text-muted-foreground/50">
              Votre texte « pourquoi venir la voir » apparaîtra ici.
            </p>
          </div>
        ) : null}

        {/* Summary / details */}
        {editable ? (
          <InPlaceText
            value={novelty.summary || ''}
            onChange={(v) => onSummaryChange?.(v)}
            placeholder="Résumé court (facultatif)"
            ariaLabel="Résumé"
            max={500}
            className="text-sm font-medium leading-relaxed text-foreground/90"
          />
        ) : (novelty.summary || novelty.details) ? (
          <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
            {novelty.summary && <p className="whitespace-pre-line font-medium">{novelty.summary}</p>}
            {novelty.details && <p className="whitespace-pre-line text-muted-foreground">{novelty.details}</p>}
          </div>
        ) : null}

        {/* Lead capture */}
        {!isPastEvent && (
          <Card className="space-y-3 border-primary/20 bg-primary/[0.03] p-4">
            <p className="text-sm font-medium">Intéressé·e par cette nouveauté ?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={inert ? undefined : onRequestMeeting}
                disabled={inert}
                className="gap-1.5"
              >
                <CalendarCheck className="h-4 w-4" />
                Demander un rendez-vous
              </Button>
              {editable ? (
                brochureName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
                    <FileText className="h-4 w-4" />
                    <span className="max-w-[180px] truncate">{brochureName}</span>
                    <button
                      type="button"
                      onClick={() => onSetBrochure?.(null)}
                      aria-label="Retirer la brochure"
                      className="opacity-70 hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" />
                    ajouter une brochure PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        onSetBrochure?.(e.target.files?.[0] ?? null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )
              ) : hasBrochure ? (
                <Button
                  variant="outline"
                  onClick={inert ? undefined : onDownloadBrochure}
                  disabled={inert}
                  className="gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
                >
                  <Download className="h-4 w-4" />
                  Télécharger la brochure
                </Button>
              ) : null}
              <Button
                onClick={inert ? undefined : onInterestToggle}
                disabled={inert || interestPending}
                variant="outline"
                className={cn(
                  'gap-1.5',
                  isLiked &&
                    'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                )}
                aria-pressed={isLiked}
                aria-label={isLiked ? 'Retirer de mes stands à voir' : 'Ajouter à mes stands à voir'}
              >
                <MapPin className={cn('h-4 w-4', isLiked && 'fill-current')} />
                {isLiked ? 'Dans vos stands à voir' : 'Stand à voir'}
                {likesCount > 0 && (
                  <span className="text-xs tabular-nums opacity-70">{likesCount}</span>
                )}
              </Button>
            </div>
            {hasBrochure && !editable && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" /> Document disponible
              </p>
            )}
          </Card>
        )}

        {/* Event block */}
        {novelty.event_name &&
          (() => {
            const inner = (
              <>
                <Calendar className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">{novelty.event_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {novelty.event_date_debut && (
                      <>{format(new Date(novelty.event_date_debut), 'dd MMM yyyy', { locale: fr })}</>
                    )}
                    {novelty.event_ville && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {novelty.event_ville}
                      </span>
                    )}
                  </p>
                </div>
              </>
            );
            if (novelty.event_slug && !inert) {
              return (
                <Link
                  to={`/events/${novelty.event_slug}`}
                  className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  {inner}
                </Link>
              );
            }
            return <div className="flex items-start gap-3 rounded-lg border p-4">{inner}</div>;
          })()}
      </div>
    </div>
  );
}