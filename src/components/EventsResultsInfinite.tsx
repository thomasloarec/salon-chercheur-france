import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import EventCard from './EventCard';
import { Calendar, Loader2, Radar } from 'lucide-react';
import type { Event } from '@/types/event';
import { groupEventsByMonth } from '@/utils/eventGrouping';
import { useEventCardStats } from '@/hooks/useEventCardStats';
import { useLatestCrmImportCompanyIds } from '@/hooks/useLatestCrmImportCompanyIds';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

type SortMode = 'date' | 'exhibitors' | 'novelties';

// Offset sticky: header (4rem) + StickyFiltersBar (~3.5rem) + SectorIconBar (~3.5rem)
const STICKY_TOP = 'calc(4rem + 3.5rem + 3.5rem)';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

/** Reveal-on-scroll wrapper. Stagger plafonné, respecte reduced-motion. */
function RevealItem({ index, children }: { index: number; children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reduced) { setInView(true); return; }
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setInView(true); obs.disconnect(); }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [reduced]);

  const delay = reduced ? 0 : Math.min(index, 5) * 60; // stagger plafonné à 6 items
  return (
    <div
      ref={ref}
      style={{
        transition: reduced
          ? undefined
          : 'opacity 500ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: inView ? `${delay}ms` : '0ms',
        opacity: inView ? 1 : reduced ? 1 : 0,
        transform: inView || reduced ? 'none' : 'translateY(12px)',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  label,
  count,
  ongoing = false,
}: {
  label: string;
  count: number;
  ongoing?: boolean;
}) {
  return (
    <div
      className="sticky z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60"
      style={{ top: STICKY_TOP }}
    >
      <div className="flex items-center gap-3 py-3">
        {ongoing && (
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        )}
        <h2 className="heading-display text-xl md:text-2xl text-foreground capitalize">
          {label}
        </h2>
        <span className="flex-1 h-px bg-border/70" aria-hidden="true" />
        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 shrink-0">
          {count} salon{count > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// Local YYYY-MM-DD (pas UTC) pour comparer les dates d'événement
function todayYmdLocal(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Un événement est "en cours" si date_debut <= aujourd'hui <= date_fin
function isOngoing(event: Event, today: string): boolean {
  const start = event.date_debut;
  const end = event.date_fin || event.date_debut;
  return !!(start && end && start <= today && today <= end);
}

interface EventsResultsInfiniteProps {
  events: Event[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  totalCount: number;
}

export const EventsResultsInfinite = ({ 
  events, 
  isLoading, 
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  totalCount
}: EventsResultsInfiniteProps) => {
  const observerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [radarTeaserOpen, setRadarTeaserOpen] = useState(false);

  // Statut Radar : authentifié + import CRM terminé (au moins 1 entreprise)
  const { session } = useAuth();
  const isAuthenticated = !!session?.user?.id;
  const { data: crmCompanyIds } = useLatestCrmImportCompanyIds();
  const hasRadar = isAuthenticated && (crmCompanyIds?.length ?? 0) > 0;

  // Batched public stats (exposants + nouveautés) pour toutes les cartes affichées
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { data: statsMap } = useEventCardStats(eventIds);

  // Préchargement des stats pour toute la liste filtrée quand un tri par métrique est actif
  const allFilteredIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { data: sortStatsMap } = useEventCardStats(
    sortMode === 'date' ? [] : allFilteredIds
  );

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const element = observerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px', // Load more when 200px from bottom
      threshold: 0.1
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Séparer les événements en cours des événements à venir, en respectant le tri
  const { ongoingEvents, groupedEvents, upcomingFlat } = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        ongoingEvents: [] as Event[],
        groupedEvents: [] as ReturnType<typeof groupEventsByMonth>,
        upcomingFlat: [] as Event[],
      };
    }

    const today = todayYmdLocal();
    const metricOf = (e: Event): number => {
      const s = sortStatsMap?.[e.id];
      if (!s) return -1;
      return sortMode === 'exhibitors' ? s.exhibitor_count : s.novelty_count;
    };

    const sorted = [...events].sort((a, b) => {
      if (sortMode === 'date') {
        return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
      }
      const diff = metricOf(b) - metricOf(a);
      if (diff !== 0) return diff;
      // Fallback stable : date ASC
      return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
    });

    const ongoing = sorted.filter((e) => isOngoing(e, today));
    const upcoming = sorted.filter((e) => !isOngoing(e, today));

    if (sortMode === 'date') {
      return {
        ongoingEvents: ongoing,
        groupedEvents: groupEventsByMonth(upcoming),
        upcomingFlat: [] as Event[],
      };
    }
    return {
      ongoingEvents: ongoing,
      groupedEvents: [] as ReturnType<typeof groupEventsByMonth>,
      upcomingFlat: upcoming,
    };
  }, [events, sortMode, sortStatsMap]);

  const renderCard = useCallback(
    (event: Event) => {
      const stat = statsMap?.[event.id];
      return (
        <EventCard
          key={event.id}
          event={event}
          view="grid"
          exhibitorCount={stat?.exhibitor_count}
          noveltyCount={stat?.novelty_count}
        />
      );
    },
    [statsMap]
  );

  if (isLoading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col divide-y divide-border/60 border-y border-border/60">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-4 sm:gap-6 py-5 animate-pulse">
            <div className="w-32 sm:w-48 aspect-[16/10] rounded-lg bg-muted shrink-0" />
            <div className="flex-1 min-w-0 space-y-3 py-1">
              <div className="h-5 bg-muted rounded w-3/5" />
              <div className="h-3 bg-muted rounded w-2/5" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
            <div className="hidden sm:flex flex-col gap-2 w-24 py-1">
              <div className="h-8 bg-muted rounded" />
              <div className="h-8 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-5">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <h3 className="heading-display text-2xl text-foreground mb-2">
          Aucun salon trouvé
        </h3>
        <p className="text-muted-foreground mb-6">
          Essayez d'élargir votre recherche ou de retirer certains filtres.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate('/salons', { replace: true })}
        >
          Réinitialiser les filtres
        </Button>
      </div>
    );
  }

  const SortAndRadarBar = (
    <div className="flex flex-wrap items-center justify-end gap-3 mb-4 pt-4">
      {/* Interrupteur promotionnel Radar CRM */}
      {hasRadar ? (
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5">
          <Radar className="h-4 w-4 text-primary" aria-hidden="true" />
          <Label htmlFor="radar-toggle" className="text-sm font-medium text-foreground cursor-default">
            Comptes Radar CRM
          </Label>
          <Switch
            id="radar-toggle"
            checked
            onCheckedChange={() => { /* verrouillé côté Radar user */ }}
            aria-label="Comptes Radar CRM (activé)"
          />
        </div>
      ) : (
        <Popover open={radarTeaserOpen} onOpenChange={setRadarTeaserOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-muted transition-colors px-3 py-1.5 group"
              aria-label="En savoir plus sur Radar CRM"
            >
              <Radar className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Comptes Radar CRM</span>
              <Switch
                checked={false}
                onCheckedChange={() => setRadarTeaserOpen(true)}
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Radar CRM</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Voyez à quels salons les entreprises de votre CRM exposent. Importez votre CRM
                (Excel ou CSV) et Lotexpo fait le rapprochement automatiquement.
              </p>
              <Link to="/radar-crm" onClick={() => setRadarTeaserOpen(false)}>
                <Button size="sm" className="w-full">Découvrir Radar CRM</Button>
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Contrôle de tri */}
      <div className="flex items-center gap-2">
        <Label htmlFor="sort-select" className="text-sm text-muted-foreground">
          Trier par
        </Label>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger id="sort-select" className="h-9 w-[220px] rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date (plus proche)</SelectItem>
            <SelectItem value="exhibitors">Nombre d'exposants</SelectItem>
            <SelectItem value="novelties">Nombre de nouveautés</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
      {SortAndRadarBar}
      {ongoingEvents.length > 0 && (
        <section className="mb-10">
          <SectionHeader label="Événements en cours" count={ongoingEvents.length} ongoing />
          <div className="flex flex-col">
            {ongoingEvents.map((event, i) => (
              <RevealItem key={event.id} index={i}>{renderCard(event)}</RevealItem>
            ))}
          </div>
        </section>
      )}

      {sortMode === 'date' && groupedEvents.map(({ monthLabel, events: monthEvents }) => (
        <section key={monthLabel} className="mb-10">
          <SectionHeader label={monthLabel} count={monthEvents.length} />
          <div className="flex flex-col">
            {monthEvents.map((event, i) => (
              <RevealItem key={event.id} index={i}>{renderCard(event)}</RevealItem>
            ))}
          </div>
        </section>
      ))}

      {sortMode !== 'date' && upcomingFlat.length > 0 && (
        <section className="mb-10">
          <div className="flex flex-col">
            {upcomingFlat.map((event, i) => (
              <RevealItem key={event.id} index={i}>{renderCard(event)}</RevealItem>
            ))}
          </div>
        </section>
      )}

      {/* Infinite scroll trigger */}
      <div ref={observerRef} className="flex justify-center py-8">
        {isFetchingNextPage ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Chargement de plus d'événements...</span>
          </div>
        ) : hasNextPage ? (
          <div className="text-muted-foreground text-sm">
            {events.length} sur {totalCount} événements affichés
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            Tous les événements sont affichés ({totalCount})
          </div>
        )}
      </div>
    </div>
  );
};
