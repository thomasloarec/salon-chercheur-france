import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Building2, ChevronRight, Link2, MoreHorizontal, Check } from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotFoundSEO from '@/components/seo/NotFoundSEO';
import LeadForm from '@/components/novelty/LeadForm';
import NoveltyDetailView from '@/components/novelty/NoveltyDetailView';
import NoveltyComments from '@/components/novelty/NoveltyComments';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { useAuth } from '@/contexts/AuthContext';
import { useNoveltyLike, useNoveltyLikesCount } from '@/hooks/useNoveltyLike';
import { useNoveltyComments } from '@/hooks/useNoveltyComments';
import {
  useNoveltyPublic,
  useNoveltyAround,
  NOVELTY_TYPE_LABELS,
  type PublicNovelty,
} from '@/hooks/useNoveltyPublic';

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
  const { data: comments = [] } = useNoveltyComments(novelty?.id ?? '');

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
  const exhibitorName = novelty.exhibitor_display_name || 'Exposant';

  const reasons = [novelty.reason_1, novelty.reason_2, novelty.reason_3].filter(
    Boolean,
  ) as string[];

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
        <NoveltyDetailView
          novelty={novelty}
          likesCount={likesCount}
          isLiked={isLiked}
          interestPending={isPending}
          onInterestToggle={handleInterestToggle}
          onRequestMeeting={() => {
            setLeadType('meeting_request');
            setShowLeadForm(true);
          }}
          onDownloadBrochure={() => {
            setLeadType('brochure_download');
            setShowLeadForm(true);
          }}
          headerActions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
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
          }
        />

        {/* COMMENTAIRES */}
        <section id="commentaires" className="mt-12 scroll-mt-24">
          <h2 className="heading-display section-rule mb-4 text-xl font-bold tracking-tight">
            {comments.length > 0
              ? `Commentaires (${comments.length})`
              : 'Commentaires'}
          </h2>
          <div className="max-w-3xl">
            <NoveltyComments noveltyId={novelty.id} showAll />
          </div>
        </section>

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
      <h2 className="heading-display section-rule mb-4 text-xl font-bold tracking-tight">{title}</h2>
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