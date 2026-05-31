import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  Globe,
  Linkedin,
  MapPin,
  CalendarDays,
  BadgeCheck,
  ShieldCheck,
  Sparkles,
  Clock,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useExhibitorGovernance } from '@/hooks/useExhibitorGovernance';
import {
  useExhibitorProfile,
  useExhibitorUpcomingEvents,
  useExhibitorNovelties,
  type PublicExhibitorProfile,
  type ExhibitorUpcomingEvent,
} from '@/hooks/useExhibitorProfile';
import ExhibitorProfileSEO from '@/components/exhibitor/ExhibitorProfileSEO';
import NotFoundSEO from '@/components/seo/NotFoundSEO';
import ExhibitorClaimModal from '@/components/exhibitor/ExhibitorClaimModal';
import ExhibitorOwnerEditDrawer from '@/components/exhibitor/ExhibitorOwnerEditDrawer';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { canEditExhibitorProfile } from '@/lib/exhibitorOwnerEdit';
import NoveltyCard from '@/components/novelty/NoveltyCard';
import type { Novelty } from '@/hooks/useNovelties';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';
import { normalizeExternalUrl, normalizeLinkedInUrl } from '@/lib/urlUtils';

const EVENTS_PAGE_SIZE = 6;
const NOVELTIES_PAGE_SIZE = 4;

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return '';
  const opt = (d: string) => format(new Date(d), 'dd MMM yyyy', { locale: fr });
  const s = opt(start);
  const e = end ? opt(end) : s;
  return s === e ? s : `${s} – ${e}`;
}

/* ----------------------------- Loading / 404 ----------------------------- */

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

function NotFoundView() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <NotFoundSEO title="Fiche exposant introuvable | Lotexpo" />
      <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">Fiche exposant introuvable</h1>
      <p className="text-muted-foreground mb-6">
        Cette fiche exposant n'existe pas ou n'est pas accessible publiquement.
      </p>
      <Button asChild>
        <Link to="/exposants">Découvrir les exposants</Link>
      </Button>
    </div>
  );
}

/* ------------------------------- Claim CTA ------------------------------- */

function ClaimCta({ profile }: { profile: PublicExhibitorProfile }) {
  const { user } = useAuth();
  const [claimOpen, setClaimOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const slug = profile.public_slug || '';

  // Profil legacy pur (pas de ligne exhibitors moderne) : NON éditable.
  // L'édition owner est court-circuitée — aucune donnée d'édition n'est
  // chargée pour ces profils.
  const isModernExhibitor = !!profile.exhibitor_id;

  const governance = useExhibitorGovernance(
    profile.exhibitor_id || profile.legacy_exposant_id || undefined,
    profile.display_name || profile.canonical_name || undefined
  );

  const isClaimed = profile.is_claimed === true || governance.hasActiveOwner;

  // Bouton "Modifier cette fiche" : visible uniquement si l'utilisateur est
  // connecté, la fiche est moderne (exhibitor_id présent), non-test, et
  // l'utilisateur est gestionnaire validé (owner direct ou team member
  // owner/admin actif). Les profils legacy purs / test n'affichent rien.
  const canEdit = canEditExhibitorProfile({
    isAuthenticated: !!user,
    exhibitorId: profile.exhibitor_id,
    isTest: profile.is_test,
    isManager: governance.isManager,
  });

  const handleClaimClick = () => {
    trackExhibitorEvent('claim_click', slug, {
      authenticated: !!user,
    });
    if (!user) {
      setAuthOpen(true);
    } else {
      setClaimOpen(true);
    }
  };

  if (governance.isLoading) {
    return <Skeleton className="h-9 w-44" />;
  }

  // State 5: validated manager → "Modifier cette fiche" (active, Phase 4A-C).
  if (canEdit) {
    return (
      <>
        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
          Modifier cette fiche
        </Button>
        <ExhibitorOwnerEditDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          exhibitorId={profile.exhibitor_id as string}
          publicSlug={profile.public_slug}
          exhibitorName={profile.display_name || profile.canonical_name || 'Exposant'}
        />
      </>
    );
  }

  // State 4: claimed by a third party → no claim button (badge shown in hero).
  if (isClaimed) {
    return null;
  }

  // State 3: user has a pending claim → static message, no second button.
  if (governance.hasPendingClaim) {
    return (
      <p className="text-sm text-muted-foreground bg-muted/50 border rounded-md px-3 py-2">
        Votre demande de gestion est en cours de traitement.
      </p>
    );
  }

  // States 1 & 2: not claimed → "Revendiquer cette fiche".
  return (
    <>
      <Button variant="outline" onClick={handleClaimClick} className="gap-2">
        <ShieldCheck className="h-4 w-4" />
        Revendiquer cette fiche
      </Button>

      <ExhibitorClaimModal
        open={claimOpen}
        onOpenChange={setClaimOpen}
        exhibitorId={profile.exhibitor_id || ''}
        exhibitorName={profile.display_name || profile.canonical_name || ''}
        exhibitorWebsite={profile.website || undefined}
        idExposant={profile.legacy_exposant_id || undefined}
      />
      <AuthRequiredModal open={authOpen} onOpenChange={setAuthOpen} actionType="add-novelty" />
    </>
  );
}

/* --------------------------------- Hero --------------------------------- */

function SourceBadge({ sourceType }: { sourceType: string | null }) {
  if (sourceType === 'modern' || sourceType === 'linked') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Sparkles className="h-3 w-3" />
        Profil enrichi
      </Badge>
    );
  }
  return null;
}

function ExhibitorHero({
  profile,
  hasAnyActivity,
}: {
  profile: PublicExhibitorProfile;
  hasAnyActivity: boolean;
}) {
  const slug = profile.public_slug || '';
  const name = profile.display_name || profile.canonical_name || 'Exposant';
  const logo = getExhibitorLogoUrl(profile.logo_url, profile.website);
  // Normalized external links — CTAs only render for valid, absolute URLs.
  const websiteUrl = normalizeExternalUrl(profile.website);
  const linkedinUrl = normalizeLinkedInUrl(profile.linkedin_url);

  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Logo / avatar fallback */}
          <div className="w-20 h-20 rounded-xl bg-white border flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logo ? (
              <img
                src={logo}
                alt={`Logo ${name}`}
                className="max-w-full max-h-full object-contain p-1"
              />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                Entreprise exposante
              </Badge>
              {profile.is_claimed && (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  Fiche revendiquée
                </Badge>
              )}
              {profile.is_verified && (
                <Badge className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Vérifiée
                </Badge>
              )}
              <SourceBadge sourceType={profile.source_type} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">
              {name}
            </h1>

            {profile.description ? (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {profile.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Cette fiche n'a pas encore été complétée par l'entreprise.
              </p>
            )}

            {!hasAnyActivity && (
              <p className="text-sm text-muted-foreground mt-2">
                Aucune participation aux salons identifiée pour le moment.
              </p>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {websiteUrl && (
                <Button
                  asChild
                  variant="default"
                  className="gap-2"
                  onClick={() =>
                    trackExhibitorEvent('website_click', slug, {
                      target_url: websiteUrl,
                    })
                  }
                >
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4" />
                    Site officiel
                  </a>
                </Button>
              )}
              {linkedinUrl && (
                <Button
                  asChild
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    trackExhibitorEvent('linkedin_click', slug, {
                      target_url: linkedinUrl,
                    })
                  }
                >
                  <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </a>
                </Button>
              )}
              <ClaimCta profile={profile} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- Stats block ----------------------------- */

function StatsBlock({ profile }: { profile: PublicExhibitorProfile }) {
  const future = profile.future_participations_count ?? 0;
  const past = profile.past_participations_count ?? 0;
  const novelties = profile.published_novelties_count ?? 0;
  const total = profile.total_participations ?? 0;

  const stats = [
    { label: 'Salons à venir / en cours', value: future },
    { label: 'Participations passées', value: past },
    { label: 'Nouveautés publiées', value: novelties },
    { label: 'Participations connues', value: total },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {profile.next_event_at && (
        <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Prochain salon / salon en cours :{' '}
          <span className="font-medium text-foreground">
            {format(new Date(profile.next_event_at), 'dd MMMM yyyy', { locale: fr })}
          </span>
        </p>
      )}
    </section>
  );
}

/* --------------------------- Upcoming events block ----------------------- */

function EventCardRow({
  event,
  slug,
}: {
  event: ExhibitorUpcomingEvent;
  slug: string;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-snug">{event.nom_event}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {formatDateRange(event.date_debut, event.date_fin)}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4 shrink-0" />
            {[event.ville, event.nom_lieu].filter(Boolean).join(' · ') || '—'}
          </p>
          {event.stand && (
            <p className="text-sm text-primary font-medium mt-1">
              Stand {event.stand}
            </p>
          )}
        </div>
        {event.slug && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() =>
              trackExhibitorEvent('event_click', slug, { event_slug: event.slug })
            }
          >
            <Link to={`/events/${event.slug}`}>Voir le salon</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingEventsBlock({ profile }: { profile: PublicExhibitorProfile }) {
  const slug = profile.public_slug || '';
  const [visible, setVisible] = useState(EVENTS_PAGE_SIZE);
  const { data: events = [], isLoading } = useExhibitorUpcomingEvents(
    profile.exhibitor_id,
    profile.legacy_exposant_id
  );

  const shown = events.slice(0, visible);
  const remaining = events.length - shown.length;

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">À voir sur les salons</h2>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">
          Aucun salon à venir identifié pour le moment.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {shown.map((e) => (
              <EventCardRow key={e.id} event={e} slug={slug} />
            ))}
          </div>
          {remaining > 0 && (
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setVisible((v) => v + EVENTS_PAGE_SIZE)}
              >
                Voir les {remaining} salon{remaining > 1 ? 's' : ''} suivant
                {remaining > 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------ Novelties block -------------------------- */

/**
 * Wraps a NoveltyCard and records a single `novelty_click` per novelty per
 * page mount. Clicks that originate inside the image carousel (prev/next/dots)
 * are ignored so navigation does not generate false-positive engagement.
 */
function TrackedNovelty({
  novelty,
  slug,
}: {
  novelty: Novelty;
  slug: string;
}) {
  const tracked = useRef(false);

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tracked.current) return;
    // Ignore carousel navigation (arrows / dots live inside this container).
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-suppress-global-arrows="true"]')) return;
    tracked.current = true;
    trackExhibitorEvent('novelty_click', slug, { novelty_id: novelty.id });
  };

  return (
    <div onClickCapture={handleClickCapture}>
      <NoveltyCard novelty={novelty} />
    </div>
  );
}

function NoveltiesBlock({ profile }: { profile: PublicExhibitorProfile }) {
  const slug = profile.public_slug || '';
  const [visible, setVisible] = useState(NOVELTIES_PAGE_SIZE);
  const { data: novelties = [], isLoading } = useExhibitorNovelties(
    profile.exhibitor_id
  );

  const shown = novelties.slice(0, visible);
  const remaining = novelties.length - shown.length;

  if (!profile.exhibitor_id) {
    return (
      <section>
        <h2 className="text-xl font-bold mb-4">Nouveautés</h2>
        <p className="text-muted-foreground">
          Aucune nouveauté publiée pour le moment.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">Nouveautés</h2>
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : novelties.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune nouveauté publiée pour le moment.
        </p>
      ) : (
        <>
          <div className="space-y-6">
            {shown.map((n) => (
              <TrackedNovelty key={n.id} novelty={n} slug={slug} />
            ))}
          </div>
          {remaining > 0 && (
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setVisible((v) => v + NOVELTIES_PAGE_SIZE)}
              >
                Voir les {remaining} nouveauté{remaining > 1 ? 's' : ''} suivante
                {remaining > 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------- About block ----------------------------- */

function AboutBlock({ profile }: { profile: PublicExhibitorProfile }) {
  const text = profile.description || profile.ai_summary;
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">À propos</h2>
      {text ? (
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
          {text}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Aucune description publique disponible pour le moment.
        </p>
      )}
    </section>
  );
}

/* --------------------------- Trust / info block -------------------------- */

const SOURCE_TYPE_LABELS: Record<string, string> = {
  modern: 'Fiche entreprise enrichie',
  linked: 'Fiche reliée à un exposant identifié',
  legacy: 'Fiche issue de notre base historique',
};

function TrustBlock({ profile }: { profile: PublicExhibitorProfile }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">Informations</h2>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          Statut :{' '}
          {profile.is_claimed
            ? 'fiche revendiquée par l\u2019entreprise'
            : 'fiche non revendiquée'}
        </p>
        <p>
          Type de fiche :{' '}
          {SOURCE_TYPE_LABELS[profile.source_type || ''] || 'Fiche exposant'}
        </p>
        {profile.last_activity_at && (
          <p>
            Dernière activité :{' '}
            {format(new Date(profile.last_activity_at), 'dd MMMM yyyy', {
              locale: fr,
            })}
          </p>
        )}
      </div>
    </section>
  );
}

/* --------------------------------- Page ---------------------------------- */

export default function ExhibitorProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: profile, isLoading, isError } = useExhibitorProfile(slug);

  // Analytics: fire profile_view exactly once per mount, as soon as a
  // visible (non-test) profile is available. The ref guard guarantees a
  // single call regardless of rerenders.
  const profileSlug = profile?.public_slug;
  const isVisibleProfile = !!profile && profile.is_test !== true;
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!viewTracked.current && isVisibleProfile && profileSlug) {
      viewTracked.current = true;
      trackExhibitorEvent('profile_view', profileSlug);
    }
  }, [isVisibleProfile, profileSlug]);

  const hasAnyActivity = useMemo(() => {
    if (!profile) return false;
    return (
      (profile.future_participations_count ?? 0) > 0 ||
      (profile.past_participations_count ?? 0) > 0 ||
      (profile.published_novelties_count ?? 0) > 0 ||
      (profile.total_participations ?? 0) > 0
    );
  }, [profile]);

  // Product decision: test profiles 404 for everyone (incl. admins).
  const notFound = !isLoading && (isError || !profile || profile.is_test === true);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {isLoading ? (
          <ProfileSkeleton />
        ) : notFound || !profile ? (
          <NotFoundView />
        ) : (
          <>
            <ExhibitorProfileSEO profile={profile} />
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
              <ExhibitorHero profile={profile} hasAnyActivity={hasAnyActivity} />
              {hasAnyActivity && <StatsBlock profile={profile} />}
              <UpcomingEventsBlock profile={profile} />
              <NoveltiesBlock profile={profile} />
              <AboutBlock profile={profile} />
              <TrustBlock profile={profile} />
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}