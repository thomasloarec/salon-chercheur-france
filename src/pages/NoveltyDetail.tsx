import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Calendar,
  MapPin,
  Building2,
  Clock,
  FileText,
  Download,
  CalendarCheck,
  ChevronRight,
  Link2,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import NotFoundSEO from '@/components/seo/NotFoundSEO';
import LeadForm from '@/components/novelty/LeadForm';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useNoveltyLike, useNoveltyLikesCount } from '@/hooks/useNoveltyLike';
import {
  useNoveltyPublic,
  useNoveltyAround,
  NOVELTY_TYPE_LABELS,
  type PublicNovelty,
} from '@/hooks/useNoveltyPublic';
import { cn } from '@/lib/utils';

const SITE_ORIGIN = 'https://lotexpo.com';

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url);
}

export default function NoveltyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: novelty, isLoading, isError } = useNoveltyPublic(slug);
  const { data: around } = useNoveltyAround(novelty ?? null);

  const { user } = useAuth();
  const { isLiked, toggleLike, isPending } = useNoveltyLike(
    novelty?.id ?? '',
    novelty?.event_id,
  );
  const { data: likesCount = 0 } = useNoveltyLikesCount(novelty?.id ?? '');

  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadType, setLeadType] =
    useState<'brochure_download' | 'meeting_request'>('meeting_request');
  const [copied, setCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (isLoading) {
    return (
      <MainLayout title="Chargement…">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-[4/5] w-full rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isError || !novelty) {
    return (
      <MainLayout title="Page introuvable">
        <NotFoundSEO title="Nouveauté introuvable | Lotexpo" />
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Nouveauté introuvable</h1>
          <p className="mt-3 text-muted-foreground">
            Cette nouveauté est introuvable ou n'est plus disponible.
          </p>
          <Button asChild className="mt-6">
            <Link to="/nouveautes">Voir toutes les nouveautés</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const typeLabel = NOVELTY_TYPE_LABELS[novelty.type] || novelty.type;
  const images = (novelty.media_urls ?? []).filter((u) => u && isImage(u));
  const logo = getExhibitorLogoUrl(novelty.exhibitor_logo_url ?? undefined, undefined);
  const exhibitorName = novelty.exhibitor_display_name || 'Exposant';
  const imgAlt = `${novelty.title} – ${exhibitorName}`;

  const reasons = [novelty.reason_1, novelty.reason_2, novelty.reason_3].filter(
    Boolean,
  ) as string[];

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

  const canonical = `${SITE_ORIGIN}/nouveautes/${novelty.slug}`;
  const metaDescription =
    (novelty.summary ||
      novelty.details ||
      reasons.join(' ') ||
      `${novelty.title} présenté par ${exhibitorName}${
        novelty.event_name ? ` à ${novelty.event_name}` : ''
      }.`).slice(0, 160);
  const pageTitle = `${novelty.title} — ${exhibitorName}${
    novelty.event_name ? ` à ${novelty.event_name}` : ''
  }`;
  const ogImage = images[0] || `${SITE_ORIGIN}/og-exhibitor-default.png`;

  const creativeWork: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: novelty.title,
    url: canonical,
  };
  if (images.length) creativeWork.image = images;
  if (novelty.audience_tags?.length || novelty.type)
    creativeWork.keywords = [typeLabel, ...(novelty.audience_tags ?? [])].join(', ');
  if (novelty.summary || novelty.details)
    creativeWork.about = (novelty.summary || novelty.details || '').slice(0, 500);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_ORIGIN },
      ...(novelty.event_slug && novelty.event_name
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: novelty.event_name,
              item: `${SITE_ORIGIN}/events/${novelty.event_slug}`,
            },
            { '@type': 'ListItem', position: 3, name: novelty.title, item: canonical },
          ]
        : [{ '@type': 'ListItem', position: 2, name: novelty.title, item: canonical }]),
    ],
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonical);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  };

  const handleInterestToggle = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    toggleLike();
  };

  const hasBrochure = !!(novelty.doc_url || novelty.resource_url);
  const brochureUrl = novelty.doc_url || novelty.resource_url || undefined;

  return (
    <MainLayout title={pageTitle} description={metaDescription} canonical={canonical}>
      <Helmet>
        <meta name="robots" content={novelty.seo_indexable ? 'index, follow' : 'noindex, follow'} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(creativeWork)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">Accueil</Link>
          {novelty.event_slug && novelty.event_name && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link to={`/events/${novelty.event_slug}`} className="truncate hover:text-primary">
                {novelty.event_name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate font-medium text-foreground">{novelty.title}</span>
        </nav>

        {/* Two-column layout (desktop) / one column (mobile) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* LEFT — image carousel, original aspect, capped height on mobile */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {images.length > 0 ? (
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
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-gradient-to-br from-muted to-muted/40">
                <Building2 className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* RIGHT — vertical details column */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-medium">{typeLabel}</Badge>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-8 w-8 text-muted-foreground"
                    aria-label="Plus d'actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyLink}>
                    {copied ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    {copied ? 'Lien copié' : 'Copier le lien'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
              {novelty.title}
            </h1>

            {/* Exhibitor */}
            <div className="flex items-center gap-3">
              {logo ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white">
                  <img src={logo} alt={exhibitorName} className="max-h-full max-w-full object-contain" loading="lazy" />
                </span>
              ) : (
                <Building2 className="h-8 w-8 shrink-0 text-muted-foreground" />
              )}
              {novelty.exhibitor_public_slug ? (
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
            {reasons.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Pourquoi c'est intéressant
                </h2>
                <ul className="space-y-2">
                  {reasons.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="whitespace-pre-line">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary / details */}
            {(novelty.summary || novelty.details) && (
              <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
                {novelty.summary && <p className="whitespace-pre-line font-medium">{novelty.summary}</p>}
                {novelty.details && <p className="whitespace-pre-line text-muted-foreground">{novelty.details}</p>}
              </div>
            )}

            {/* Lead capture */}
            <Card className="space-y-3 border-primary/20 bg-primary/[0.03] p-4">
              <p className="text-sm font-medium">Intéressé·e par cette nouveauté ?</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setLeadType('meeting_request');
                    setShowLeadForm(true);
                  }}
                  className="gap-1.5"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Demander un rendez-vous
                </Button>
                {hasBrochure && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLeadType('brochure_download');
                      setShowLeadForm(true);
                    }}
                    className="gap-1.5 border-accent/40 bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground hover:border-accent"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger la brochure
                  </Button>
                )}
                <Button
                  onClick={handleInterestToggle}
                  disabled={isPending}
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
              {hasBrochure && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" /> Document disponible
                </p>
              )}
            </Card>

            {/* Event block */}
            {novelty.event_slug && novelty.event_name && (
              <Link
                to={`/events/${novelty.event_slug}`}
                className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
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
              </Link>
            )}
          </div>
        </div>

        {/* AROUND — crawlable internal linking */}
        {around && (around.sameEvent.length > 0 || around.sameExhibitor.length > 0) && (
          <div className="mt-12 space-y-10">
            {around.sameEvent.length > 0 && novelty.event_name && (
              <AroundBlock
                title={`Autres nouveautés à ${novelty.event_name}`}
                items={around.sameEvent}
              />
            )}
            {around.sameExhibitor.length > 0 && (
              <AroundBlock
                title={`Autres nouveautés de ${exhibitorName}`}
                items={around.sameExhibitor}
              />
            )}
          </div>
        )}
      </div>

      <LeadForm
        isOpen={showLeadForm}
        onClose={() => setShowLeadForm(false)}
        noveltyId={novelty.id}
        leadType={leadType}
        brochureUrl={brochureUrl}
      />

      <AuthRequiredModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
    </MainLayout>
  );
}

function AroundBlock({ title, items }: { title: string; items: PublicNovelty[] }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold tracking-tight">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => {
          const img = (n.media_urls ?? []).find((u) => u && isImage(u));
          return (
            <Link
              key={n.id}
              to={`/nouveautes/${n.slug}`}
              className="group flex gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {img ? (
                  <img
                    src={img}
                    alt={`${n.title} – ${n.exhibitor_display_name ?? 'Exposant'}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground/40" />
                )}
              </span>
              <span className="min-w-0">
                <Badge variant="secondary" className="mb-1 font-medium">
                  {NOVELTY_TYPE_LABELS[n.type] || n.type}
                </Badge>
                <span className="line-clamp-2 block text-sm font-semibold leading-snug group-hover:text-primary">
                  {n.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {n.exhibitor_display_name}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}