import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  MapPin,
  Radio,
  Route,
  Sparkles,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { EventSectors } from '@/components/ui/event-sectors';
import { MonthSeparator } from '@/components/MonthSeparator';
import { ExhibitorFullProfileCTA } from '@/components/exhibitor/ExhibitorFullProfileCTA';
import { RequestMeetingButton } from '@/components/exhibitor/RequestMeetingButton';
import { useVisitPlansForUser, VisitPlan } from '@/hooks/useVisitPlan';
import { useEventCardStats } from '@/hooks/useEventCardStats';
import { useToggleFavorite } from '@/hooks/useFavorites';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchExhibitorPublicSlugs,
  resolvePublicSlug,
  type PublicSlugMaps,
} from '@/lib/exhibitorPublicSlug';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { normalizeStandNumber } from '@/utils/standUtils';
import { EVENT_PLACEHOLDER } from '@/lib/images';
import {
  getDaysUntilStart,
  getEventCapabilities,
  getEventTemporalState,
} from '@/lib/eventCapabilities';
import { cn } from '@/lib/utils';

const NOVELTY_TYPE_LABELS = {
  Launch: 'Lancement',
  Prototype: 'Prototype',
  MajorUpdate: 'Mise à jour majeure',
  LiveDemo: 'Démo live',
  Partnership: 'Partenariat',
  Offer: 'Offre spéciale',
  Talk: 'Conférence',
};

/* Offset sticky : header seul (4rem), cette page n'a pas de barre de filtres. */
const STICKY_TOP = '4rem';

function formatDateRange(start: string, end?: string | null) {
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  if (!start) return '';
  const sd = new Date(start).toLocaleDateString('fr-FR', opt);
  if (!end || end === start) return sd;
  return `${sd} → ${new Date(end).toLocaleDateString('fr-FR', opt)}`;
}

/* ------------------------------------------------------------------ */
/* Révélation au scroll — mêmes réglages que la liste /salons,          */
/* dupliqués localement pour ne pas modifier EventsResultsInfinite.     */
/* ------------------------------------------------------------------ */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

function RevealItem({ index, children }: { index: number; children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reduced) {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [reduced]);

  const delay = reduced ? 0 : Math.min(index, 5) * 60;
  return (
    <div
      ref={ref}
      style={{
        transition: reduced
          ? undefined
          : 'opacity 500ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: inView ? `${delay}ms` : '0ms',
        opacity: inView || reduced ? 1 : 0,
        transform: inView || reduced ? 'none' : 'translateY(12px)',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

interface VisitorDashboardProps {
  events: any[];
  pastEvents?: any[];
  likedNovelties: any[];
  isLoading?: boolean;
}

export function VisitorDashboard({
  events,
  pastEvents = [],
  likedNovelties,
  isLoading,
}: VisitorDashboardProps) {
  // Une ligne ouverte par défaut : la première (le salon le plus proche).
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  const [expandedNovelties, setExpandedNovelties] = useState<Set<string>>(new Set());
  const { data: visitPlans = [] } = useVisitPlansForUser();

  // Statistiques publiques groupées (exposants + nouveautés), même source que /salons.
  const { data: statsMap } = useEventCardStats((events ?? []).map((e) => e.id));

  // Tous les exposants référencés par les parcours, résolus en UNE requête groupée.
  const planExhibitorIds = Array.from(
    new Set(
      visitPlans.flatMap((plan) =>
        [...(plan.prioritaires || []), ...(plan.optionnels || [])]
          .map((rec: any) => rec?.exhibitor_id)
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0),
      ),
    ),
  );

  const { data: slugMaps } = useQuery({
    queryKey: ['visit-plan-exhibitor-slugs', planExhibitorIds],
    enabled: planExhibitorIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PublicSlugMaps> => {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // Un exhibitor_id est soit un UUID moderne, soit un id_exposant legacy.
      const uuids = planExhibitorIds.filter((id) => UUID_RE.test(id));
      const legacy = planExhibitorIds.filter((id) => !UUID_RE.test(id));
      return fetchExhibitorPublicSlugs(uuids, legacy);
    },
  });

  const plansByEvent = visitPlans.reduce((acc, plan) => {
    acc[plan.event_id] = plan;
    return acc;
  }, {} as Record<string, VisitPlan>);

  const noveltiesByEvent = likedNovelties.reduce((acc, novelty) => {
    const eventId = novelty.event_id;
    if (!acc[eventId]) acc[eventId] = [];
    acc[eventId].push(novelty);
    return acc;
  }, {} as Record<string, any[]>);

  /* ---------------- Sections par urgence ---------------- */
  const sections = useMemo(() => {
    const ongoing: any[] = [];
    const week: any[] = [];
    const month: any[] = [];
    const later: any[] = [];

    for (const event of events ?? []) {
      const state = getEventTemporalState(event.date_debut, event.date_fin);
      if (state === 'en_cours' || state === 'imminent') {
        ongoing.push(event);
        continue;
      }
      const days = getDaysUntilStart(event.date_debut);
      if (days !== null && days <= 7) week.push(event);
      else if (days !== null && days <= 31) month.push(event);
      else later.push(event);
    }

    return [
      { key: 'ongoing', label: 'En cours', ongoing: true, events: ongoing },
      { key: 'week', label: 'Dans les 7 jours', ongoing: false, events: week },
      { key: 'month', label: 'Dans le mois', ongoing: false, events: month },
      { key: 'later', label: 'Plus tard', ongoing: false, events: later },
    ].filter((s) => s.events.length > 0);
  }, [events]);

  /* ---------------- Barre de préparation ---------------- */
  const prep = useMemo(() => {
    let withPlan = 0;
    const toPrepare: any[] = [];
    for (const event of events ?? []) {
      const exhibitorCount = statsMap?.[event.id]?.exhibitor_count ?? 0;
      if (plansByEvent[event.id]) {
        withPlan += 1;
        continue;
      }
      // Source unique de vérité : le parcours IA n'existe qu'au-delà du seuil
      // d'exposants et sur un salon non terminé.
      if (getEventCapabilities(event, exhibitorCount).canPrepareVisit) {
        toPrepare.push(event);
      }
    }
    return { withPlan, toPrepare };
  }, [events, statsMap, plansByEvent]);

  const toggleRow = (eventId: string, current: boolean) =>
    setOpenOverrides((prev) => ({ ...prev, [eventId]: !current }));

  const toggleNovelties = (eventId: string) =>
    setExpandedNovelties((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

  if (isLoading) {
    return (
      <div className="flex flex-col divide-y divide-border/60 border-y border-border/60">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex animate-pulse gap-4 py-5 sm:gap-6">
            <div className="aspect-[16/10] w-32 shrink-0 rounded-xl bg-muted sm:w-48" />
            <div className="min-w-0 flex-1 space-y-3 py-1">
              <div className="h-5 w-3/5 rounded bg-muted" />
              <div className="h-3 w-2/5 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
            <div className="hidden w-24 flex-col gap-2 py-1 sm:flex">
              <div className="h-8 rounded bg-muted" />
              <div className="h-8 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="space-y-8">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h3 className="heading-display mb-2 text-2xl text-foreground">
            Votre agenda est vide
          </h3>
          <p className="mb-6 text-muted-foreground">
            Ajoutez un salon à votre agenda, ou repérez une nouveauté : son salon
            apparaîtra ici automatiquement.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to="/salons">Découvrir les salons</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/nouveautes">Voir les nouveautés</Link>
            </Button>
          </div>
        </div>
        <PastEventsAccordion events={pastEvents} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Barre de préparation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
        <p className="text-sm text-foreground">
          Sur {events.length} salon{events.length > 1 ? 's' : ''} :{' '}
          <span className="font-semibold">
            {prep.withPlan} parcours prêt{prep.withPlan > 1 ? 's' : ''}
          </span>
          {prep.toPrepare.length > 0 && (
            <>
              {' · '}
              <span className="text-muted-foreground">
                {prep.toPrepare.length} salon{prep.toPrepare.length > 1 ? 's' : ''} à préparer
              </span>
            </>
          )}
        </p>
        {prep.toPrepare.length > 0 && (
          <Link
            to={`/events/${prep.toPrepare[0].slug}?prepare=1`}
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            <Sparkles className="h-4 w-4" />
            Préparer {prep.toPrepare[0].nom_event}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>

      {/* Sections par urgence */}
      {sections.map((section) => (
        <section key={section.key}>
          <MonthSeparator
            label={section.label}
            count={section.events.length}
            ongoing={section.ongoing}
            stickyTop={STICKY_TOP}
          />
          <div className="flex flex-col">
            {section.events.map((event: any, i: number) => {
              const isOpen = openOverrides[event.id] ?? (section.key === sections[0].key && i === 0);
              return (
                <RevealItem key={event.id} index={i}>
                  <AgendaEventRow
                    event={event}
                    plan={plansByEvent[event.id]}
                    novelties={noveltiesByEvent[event.id] || []}
                    stat={statsMap?.[event.id]}
                    slugMaps={slugMaps}
                    isOpen={isOpen}
                    onToggle={() => toggleRow(event.id, isOpen)}
                    noveltiesExpanded={expandedNovelties.has(event.id)}
                    onToggleNovelties={() => toggleNovelties(event.id)}
                  />
                </RevealItem>
              );
            })}
          </div>
        </section>
      ))}

      <PastEventsAccordion events={pastEvents} />
    </div>
  );
}

/* ================================================================== */
/* Une ligne de salon, au format de la liste /salons, dépliable         */
/* ================================================================== */
function AgendaEventRow({
  event,
  plan,
  novelties,
  stat,
  slugMaps,
  isOpen,
  onToggle,
  noveltiesExpanded,
  onToggleNovelties,
}: {
  event: any;
  plan?: VisitPlan;
  novelties: any[];
  stat?: { exhibitor_count: number; novelty_count: number };
  slugMaps?: PublicSlugMaps | null;
  isOpen: boolean;
  onToggle: () => void;
  noveltiesExpanded: boolean;
  onToggleNovelties: () => void;
}) {
  const state = getEventTemporalState(event.date_debut, event.date_fin);
  const ongoing = state === 'en_cours' || state === 'imminent';
  const days = ongoing ? null : getDaysUntilStart(event.date_debut);

  const exhibitorCount = stat?.exhibitor_count ?? 0;
  const noveltyCount = stat?.novelty_count ?? 0;
  const capabilities = getEventCapabilities(event, exhibitorCount);

  const planCount = (plan?.prioritaires?.length || 0) + (plan?.optionnels?.length || 0);
  const hasPersonalMetrics = planCount > 0 || novelties.length > 0;
  const hasPanel = !!plan || novelties.length > 0 || capabilities.canPrepareVisit;

  const displayedNovelties = noveltiesExpanded ? novelties : novelties.slice(0, 3);

  return (
    <article
      className={cn(
        'group relative border-b border-border/60 transition-colors duration-200 ease-out',
        'hover:bg-muted/40 motion-reduce:transition-none',
        ongoing && 'bg-primary/[0.03]',
      )}
    >
      <div className="grid grid-cols-1 gap-4 p-4 min-[560px]:grid-cols-[140px_1fr] min-[1040px]:grid-cols-[172px_1fr_auto] min-[1040px]:items-center min-[1040px]:gap-6">
        {/* Vignette */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted min-[560px]:w-[140px] min-[1040px]:w-[172px]">
          <img
            src={(event.url_image ?? '').trim() || EVENT_PLACEHOLDER}
            alt={`Visuel — ${event.nom_event || 'Événement'}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = EVENT_PLACEHOLDER;
            }}
          />
        </div>

        {/* Corps */}
        <div className="flex min-w-0 flex-col gap-2">
          <EventSectors event={event} className="flex flex-wrap items-center gap-1.5" />

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="heading-display text-[1.2rem] leading-tight text-foreground">
              <Link
                to={`/events/${event.slug}`}
                className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
              >
                {event.nom_event}
              </Link>
            </h3>
            {plan && (
              <Badge className="gap-1 border-info/30 bg-info/10 text-xs text-info">
                <CheckCircle2 className="h-3 w-3" />
                Parcours prêt
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {formatDateRange(event.date_debut, event.date_fin)}
              </span>
            </span>
            {event.ville && (
              <>
                <span aria-hidden="true" className="text-border">·</span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {event.ville}
                    {event.nom_lieu ? ` · ${event.nom_lieu}` : ''}
                  </span>
                </span>
              </>
            )}
            {ongoing ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                <Radio className="h-3 w-3 animate-pulse motion-reduce:animate-none" />
                En cours
              </span>
            ) : days !== null && days >= 0 ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                {days === 0 ? "Aujourd'hui" : `J-${days}`}
              </span>
            ) : null}
          </div>

          {/* Chiffres publics du salon, en second niveau */}
          {(exhibitorCount > 0 || noveltyCount > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {exhibitorCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-bubble-border bg-bubble px-2 py-0.5 text-xs font-medium text-bubble-foreground">
                  <Store className="h-3 w-3 shrink-0" />
                  {exhibitorCount} {exhibitorCount > 1 ? 'exposants' : 'exposant'} sur le salon
                </span>
              )}
              {noveltyCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-bubble-border bg-bubble px-2 py-0.5 text-xs font-medium text-bubble-foreground">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  {noveltyCount} {noveltyCount > 1 ? 'nouveautés' : 'nouveauté'} publiée
                  {noveltyCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rail : MES chiffres */}
        <div className="col-span-full flex flex-col gap-3 border-t border-border/60 pt-3 min-[1040px]:col-span-1 min-[1040px]:w-[240px] min-[1040px]:border-l min-[1040px]:border-t-0 min-[1040px]:pl-6 min-[1040px]:pt-0">
          {hasPersonalMetrics && (
            <div className="flex items-center gap-4 min-[1040px]:justify-end">
              {planCount > 0 && (
                <div className="flex flex-col leading-none">
                  <span className="heading-display text-2xl tabular-nums text-foreground">
                    {planCount}
                  </span>
                  <span className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {planCount > 1 ? 'exposants à voir' : 'exposant à voir'}
                  </span>
                </div>
              )}
              {planCount > 0 && novelties.length > 0 && (
                <span aria-hidden="true" className="h-8 w-px bg-border" />
              )}
              {novelties.length > 0 && (
                <div className="flex flex-col leading-none">
                  <span className="heading-display text-2xl tabular-nums text-foreground">
                    {novelties.length}
                  </span>
                  <span className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {novelties.length > 1 ? 'nouveautés repérées' : 'nouveauté repérée'}
                  </span>
                </div>
              )}
            </div>
          )}
          <Link
            to={`/events/${event.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all hover:gap-2 min-[1040px]:self-end"
          >
            Voir le salon
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
        {hasPanel ? (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-foreground transition-colors hover:text-primary"
            aria-expanded={isOpen}
          >
            <Route className="h-4 w-4" />
            Ma préparation
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : (
          <span />
        )}
        <RemoveFromAgendaButton
          eventId={event.id}
          eventName={event.nom_event}
          noveltyIds={novelties.map((n: any) => n.id)}
        />
      </div>

      {/* Panneau déplié */}
      {hasPanel && isOpen && (
        <div className="animate-panel-in space-y-7 border-t border-border/60 bg-muted/20 px-4 py-6">
          {/* Parcours de visite */}
          {plan && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-semibold text-foreground">
                  <Route className="h-5 w-5 text-primary" />
                  Mon parcours de visite
                  <Badge variant="secondary" className="text-xs">{planCount}</Badge>
                </h4>
                <Link to={`/events/${event.slug}?prepare=1`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Mettre à jour ma liste
                  </Button>
                </Link>
              </div>

              {plan.prioritaires && plan.prioritaires.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                    Incontournables
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {plan.prioritaires.map((rec: any) => (
                      <ExhibitorRow
                        key={rec.exhibitor_id}
                        rec={rec}
                        eventSlug={event.slug}
                        eventId={event.id}
                        slugMaps={slugMaps}
                      />
                    ))}
                  </div>
                </div>
              )}

              {plan.optionnels && plan.optionnels.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    À voir si le temps le permet
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {plan.optionnels.map((rec: any) => (
                      <ExhibitorRow
                        key={rec.exhibitor_id}
                        rec={rec}
                        eventSlug={event.slug}
                        eventId={event.id}
                        slugMaps={slugMaps}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Incitation au parcours IA — uniquement au-dessus du seuil d'exposants */}
          {!plan && capabilities.canPrepareVisit && (
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-[46ch]">
                  <p className="heading-display text-lg text-foreground">
                    {exhibitorCount} exposants sur ce salon.
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    L'IA vous sélectionne ceux qui comptent pour vous, avec leur stand et
                    la raison d'y passer. Quelques questions suffisent.
                  </p>
                </div>
                <Link to={`/events/${event.slug}?prepare=1`} className="shrink-0">
                  <Button className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Créer mon parcours
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Nouveautés repérées */}
          {novelties.length > 0 && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-semibold text-foreground">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Nouveautés repérées
                  <Badge variant="secondary" className="text-xs">{novelties.length}</Badge>
                </h4>
                {novelties.length > 3 && (
                  <Button variant="ghost" size="sm" onClick={onToggleNovelties} className="gap-1">
                    {noveltiesExpanded ? (
                      <>
                        Réduire <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Voir tout ({novelties.length}) <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayedNovelties.map((novelty: any) => (
                  <Link
                    key={novelty.id}
                    to={novelty.slug ? `/nouveautes/${novelty.slug}` : `/events/${event.slug}`}
                    className="group/nov flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background transition-colors hover:border-primary/40"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                      <img
                        src={(novelty.media_urls?.[0] ?? '').trim() || EVENT_PLACEHOLDER}
                        alt={novelty.title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover/nov:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/nov:scale-100"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = EVENT_PLACEHOLDER;
                        }}
                      />
                      <Badge
                        variant="outline"
                        className="absolute left-2 top-2 border-border bg-background/90 text-[11px] backdrop-blur"
                      >
                        {NOVELTY_TYPE_LABELS[novelty.type as keyof typeof NOVELTY_TYPE_LABELS] ||
                          novelty.type}
                      </Badge>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover/nov:text-primary">
                        {novelty.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {novelty.exhibitors?.name}
                      </p>
                      {novelty.stand_info && (
                        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-bubble-border bg-bubble px-2 py-0.5 text-[11px] font-semibold text-bubble-foreground">
                          <MapPin className="h-3 w-3" />
                          Stand {normalizeStandNumber(novelty.stand_info)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ================================================================== */
/* Carte exposant du parcours de visite                                 */
/* ================================================================== */
function ExhibitorRow({
  rec,
  eventSlug,
  eventId,
  slugMaps,
}: {
  rec: any;
  eventSlug: string;
  eventId: string;
  slugMaps?: PublicSlugMaps | null;
}) {
  const logoUrl = getExhibitorLogoUrl(rec.logo_url || null, rec.website || null);
  const standNumber = rec.stand ? normalizeStandNumber(rec.stand) : null;
  const slugInfo = resolvePublicSlug(slugMaps, {
    exhibitorId: rec.exhibitor_id,
    legacyId: rec.exhibitor_id,
  });

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/40">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
        {logoUrl ? (
          <img src={logoUrl} alt={rec.name} className="h-full w-full object-contain" />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight text-foreground">{rec.name}</p>
          {standNumber && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-bubble-border bg-bubble px-2 py-0.5 text-[11px] font-semibold text-bubble-foreground">
              <MapPin className="h-3 w-3" />
              Stand {standNumber}
            </span>
          )}
        </div>
        {rec.raison && (
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {rec.raison}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {slugInfo && !slugInfo.is_test && (
            <ExhibitorFullProfileCTA
              publicSlug={slugInfo.public_slug}
              seoIndexable={slugInfo.seo_indexable}
              isTest={slugInfo.is_test}
              openInNewTab
              surface="event_exhibitor_list"
              eventSlug={eventSlug}
              variant="link"
            />
          )}
          {slugInfo && slugInfo.has_active_manager && !slugInfo.is_test && (
            <RequestMeetingButton
              exhibitorRef={rec.exhibitor_id}
              eventId={eventId}
              exhibitorName={rec.name}
              variant="compact"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Salons passés                                                        */
/* ================================================================== */
function PastEventsAccordion({ events }: { events: any[] }) {
  if (!events || events.length === 0) return null;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="past" className="rounded-xl border border-border/60 px-4">
        <AccordionTrigger className="hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="h-4 w-4 text-muted-foreground" />
            Salons passés
            <Badge variant="secondary" className="text-xs">{events.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col divide-y divide-border/60">
            {events.map((event: any) => (
              <div key={event.id} className="flex items-center gap-3 py-3">
                <div className="relative aspect-[16/10] w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img
                    src={(event.url_image ?? '').trim() || EVENT_PLACEHOLDER}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = EVENT_PLACEHOLDER;
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/events/${event.slug}`}
                    className="text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {event.nom_event}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(event.date_debut), 'dd MMM yyyy', { locale: fr })}
                    {event.ville ? ` · ${event.ville}` : ''}
                  </p>
                </div>
                <Link
                  to={`/events/${event.slug}`}
                  className="shrink-0 text-sm font-medium text-primary"
                >
                  Revoir
                </Link>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/* ================================================================== */
/* Retrait d'agenda — logique strictement inchangée                     */
/* ================================================================== */
function RemoveFromAgendaButton({
  eventId,
  eventName,
  noveltyIds = [],
}: {
  eventId: string;
  eventName: string;
  noveltyIds?: string[];
}) {
  const toggleFavorite = useToggleFavorite();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      // 1. Repasser les nouveautés likées de cet événement en "non intéressé"
      //    (sinon elles ré-injectent l'événement dans l'agenda).
      for (const noveltyId of noveltyIds) {
        const { error } = await supabase.functions.invoke('novelty-like-toggle', {
          body: { novelty_id: noveltyId },
        });
        if (error) throw error;
      }

      // 2. Retirer l'événement des favoris (s'il y est encore).
      await toggleFavorite.mutateAsync(eventId);

      // 3. Rafraîchir l'agenda et les états de like.
      queryClient.invalidateQueries({ queryKey: ['liked-novelties', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['novelties'] });

      toast({
        title: 'Retiré de votre agenda',
        description: `"${eventName}" a été retiré de votre agenda.`,
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de retirer cet événement.',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={toggleFavorite.isPending || isRemoving}
      className="text-muted-foreground hover:bg-destructive/90 hover:text-white"
    >
      <CalendarX className="mr-1.5 h-4 w-4" />
      Retirer de mon agenda
    </Button>
  );
}
