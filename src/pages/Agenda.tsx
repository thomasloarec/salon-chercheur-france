import { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarRange, MapPin, Radio, Sparkles, Store } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoriteEvents } from '@/hooks/useFavoriteEvents';
import { useMyExhibitors } from '@/hooks/useMyExhibitors';
import { useLikedNovelties } from '@/hooks/useNoveltyLike';
import { useVisitPlansForUser } from '@/hooks/useVisitPlan';
import { VisitorDashboard } from '@/components/agenda/VisitorDashboard';
import { fetchExhibitorPublicSlugs } from '@/lib/exhibitorPublicSlug';
import { getDaysUntilStart, getEventTemporalState } from '@/lib/eventCapabilities';

/* Format de plage de dates, identique à celui d'EventCard. */
function formatDateRange(start: string, end?: string | null) {
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  if (!start) return '';
  const sd = new Date(start).toLocaleDateString('fr-FR', opt);
  if (!end || end === start) return sd;
  return `${sd} → ${new Date(end).toLocaleDateString('fr-FR', opt)}`;
}

/** Coquille commune : Header, Footer, métadonnées. La page est privée : noindex. */
function AgendaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Mon agenda – Lotexpo</title>
        <meta
          name="description"
          content="Vos salons professionnels, vos exposants à voir et vos nouveautés repérées, réunis dans un seul plan de visite."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

const Agenda = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: allEvents = [], isLoading, error } = useFavoriteEvents();
  const { data: likedNovelties = [] } = useLikedNovelties();
  const { data: memberships = [], isLoading: membershipsLoading } = useMyExhibitors();
  const { data: visitPlans = [] } = useVisitPlansForUser();

  // Les anciens liens « espace exposant » redirigent vers la nouvelle page de
  // gestion de l'entreprise (ou vers le profil si l'utilisateur en gère
  // plusieurs). Comportement inchangé.
  const wantsExhibitor =
    searchParams.get('tab') === 'exposant' || searchParams.get('section') === 'rendezvous';

  useEffect(() => {
    if (!wantsExhibitor || !user || membershipsLoading) return;
    let cancelled = false;
    const run = async () => {
      // Entreprise ciblée par le lien (notifications) si l'utilisateur en est membre,
      // sinon l'unique entreprise gérée.
      const wanted = searchParams.get('exhibitor');
      const target = wanted && memberships.some((m) => m.exhibitor_id === wanted)
        ? wanted
        : memberships.length === 1
          ? memberships[0].exhibitor_id
          : null;
      if (!target) {
        navigate('/profile', { replace: true });
        return;
      }
      // Onglet d'arrivée : les leads ouvrent « Rendez-vous », les nouveautés « Mes nouveautés ».
      const rawSection = searchParams.get('section');
      const section = rawSection === 'rendezvous' || window.location.hash === '#leads'
        ? 'rendezvous'
        : rawSection === 'novelties'
          ? 'nouveautes'
          : null;
      const exhibitorId = target;
      const slugs = await fetchExhibitorPublicSlugs([exhibitorId], []);
      if (cancelled) return;
      const info = slugs.byExhibitorId.get(exhibitorId);
      if (info && !info.is_test && info.public_slug) {
        navigate(`/exposants/${info.public_slug}/gerer${section ? `?section=${section}` : ''}`, { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [wantsExhibitor, user, memberships, membershipsLoading, navigate, searchParams]);

  // Fusion favoris + événements issus des nouveautés likées (filet de sécurité
  // au cas où l'auto-favori n'aurait pas pu s'appliquer), puis séparation
  // à venir / passés. Logique de fusion strictement inchangée.
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const favoriteIds = new Set(allEvents.map((e: any) => e.id));
    const eventsFromNovelties = (likedNovelties as any[])
      .map((n) => n.events)
      .filter((e) => e && !favoriteIds.has(e.id))
      .reduce((acc: any[], e: any) => {
        if (!acc.some((x) => x.id === e.id)) acc.push(e);
        return acc;
      }, []);

    const merged = [...allEvents, ...eventsFromNovelties];
    const isPast = (e: any) => getEventTemporalState(e.date_debut, e.date_fin) === 'termine';

    return {
      upcomingEvents: merged
        .filter((e: any) => !isPast(e))
        .sort(
          (a: any, b: any) =>
            new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime(),
        ),
      pastEvents: merged
        .filter((e: any) => isPast(e))
        .sort(
          (a: any, b: any) =>
            new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime(),
        ),
    };
  }, [allEvents, likedNovelties]);

  // Compteurs personnels du bandeau : uniquement sur les salons à venir.
  const { exhibitorsToSee, noveltiesSpotted } = useMemo(() => {
    const ids = new Set(upcomingEvents.map((e: any) => e.id));
    const exhibitors = visitPlans
      .filter((p) => ids.has(p.event_id))
      .reduce(
        (n, p) => n + (p.prioritaires?.length || 0) + (p.optionnels?.length || 0),
        0,
      );
    const novelties = (likedNovelties as any[]).filter((n) => ids.has(n.event_id)).length;
    return { exhibitorsToSee: exhibitors, noveltiesSpotted: novelties };
  }, [upcomingEvents, visitPlans, likedNovelties]);

  const nextEvent = upcomingEvents[0];
  const nextState = nextEvent
    ? getEventTemporalState(nextEvent.date_debut, nextEvent.date_fin)
    : null;
  const nextOngoing = nextState === 'en_cours' || nextState === 'imminent';
  const daysToNext = nextEvent ? getDaysUntilStart(nextEvent.date_debut) : null;

  if (!user) {
    return (
      <AgendaShell>
        <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <CalendarRange className="h-8 w-8 text-primary" />
            </div>
            <h1 className="heading-display text-2xl text-foreground mb-2">
              Connectez-vous pour voir votre agenda
            </h1>
            <p className="text-muted-foreground mb-6">
              Vos salons, vos exposants à voir et vos nouveautés repérées, réunis dans un
              seul plan de visite.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link to="/auth">Se connecter</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/salons">Parcourir les salons</Link>
              </Button>
            </div>
          </div>
        </div>
      </AgendaShell>
    );
  }

  if (error) {
    return (
      <AgendaShell>
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <div className="text-center">
            <p className="text-destructive mb-4">Erreur lors du chargement de votre agenda</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Réessayer
            </Button>
          </div>
        </div>
      </AgendaShell>
    );
  }

  const counters = [
    { value: upcomingEvents.length, label: upcomingEvents.length > 1 ? 'salons à venir' : 'salon à venir', icon: CalendarRange },
    { value: exhibitorsToSee, label: exhibitorsToSee > 1 ? 'exposants à voir' : 'exposant à voir', icon: Store },
    { value: noveltiesSpotted, label: noveltiesSpotted > 1 ? 'nouveautés repérées' : 'nouveauté repérée', icon: Sparkles },
  ];

  return (
    <AgendaShell>
      {/* ============================= EN-TÊTE PERSONNEL ============================= */}
      <section className="relative overflow-hidden bg-surface-inverse text-inverse">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'url(/home-texture-plexus.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.28,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.85))',
          }}
        />

        <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-inverse/20 bg-inverse/5 pl-2 pr-4 py-1.5 text-sm font-semibold text-inverse">
            <span className="rounded-full bg-inverse-primary px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-surface-inverse">
              Mon espace
            </span>
            Votre plan de visite
          </span>

          <h1 className="heading-display mt-4 flex items-center gap-3 text-[clamp(1.8rem,3.2vw,2.9rem)]">
            <CalendarRange className="h-8 w-8 shrink-0 text-inverse-primary" aria-hidden="true" />
            Mon agenda
          </h1>

          {isLoading ? (
            <div className="mt-7 h-[132px] max-w-3xl animate-pulse rounded-2xl border border-inverse/15 bg-inverse/5" />
          ) : nextEvent ? (
            <div className="mt-7 grid gap-5 rounded-2xl border border-inverse/15 bg-inverse/5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="min-w-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-inverse-primary">
                  {nextOngoing ? 'En ce moment' : 'Prochain salon'}
                </p>
                <Link
                  to={`/events/${nextEvent.slug}`}
                  className="heading-display text-[clamp(1.4rem,2.4vw,2rem)] transition-colors hover:text-inverse-primary"
                >
                  {nextEvent.nom_event}
                </Link>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-inverse-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {formatDateRange(nextEvent.date_debut, nextEvent.date_fin)}
                  </span>
                  {nextEvent.ville && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {nextEvent.ville}
                      {nextEvent.nom_lieu ? ` · ${nextEvent.nom_lieu}` : ''}
                    </span>
                  )}
                </p>
              </div>

              <div className="shrink-0">
                {nextOngoing ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-inverse-primary px-4 py-2 text-sm font-bold text-surface-inverse">
                    <Radio className="h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                    En cours
                  </span>
                ) : daysToNext !== null && daysToNext >= 0 ? (
                  <div className="leading-none lg:text-right">
                    <div className="heading-display text-[clamp(2.2rem,4vw,3.4rem)] tabular-nums text-inverse">
                      {daysToNext === 0 ? "Aujourd'hui" : `J-${daysToNext}`}
                    </div>
                    {daysToNext > 0 && (
                      <div className="mt-2 text-[11px] uppercase tracking-wide text-inverse-muted">
                        avant l'ouverture
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-6 max-w-[52ch] text-lg text-inverse-muted">
              Votre agenda est encore vide. Ajoutez un salon pour préparer votre visite,
              repérer les exposants à rencontrer et garder vos nouveautés sous la main.
            </p>
          )}

          {/* Compteurs personnels */}
          <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-6">
            {counters.map((c) => (
              <div key={c.label} className="flex items-center gap-3">
                <c.icon className="h-5 w-5 shrink-0 text-inverse-primary" aria-hidden="true" />
                <div className="leading-none">
                  <div className="heading-display text-2xl tabular-nums text-inverse">
                    {isLoading ? '—' : c.value}
                  </div>
                  <div className="mt-1.5 text-[11px] uppercase tracking-wide text-inverse-muted">
                    {c.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {nextEvent && (
              <Button asChild className="h-11 gap-2 rounded-xl px-5">
                <Link to={`/events/${nextEvent.slug}`}>
                  Ouvrir mon prochain salon
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl border-inverse/30 bg-transparent px-5 text-inverse hover:bg-inverse/10 hover:text-inverse"
            >
              <Link to="/salons">Ajouter un salon</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============================= CONTENU ============================= */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VisitorDashboard
          events={upcomingEvents}
          pastEvents={pastEvents}
          likedNovelties={likedNovelties}
          isLoading={isLoading}
        />
      </div>
    </AgendaShell>
  );
};

export default Agenda;
