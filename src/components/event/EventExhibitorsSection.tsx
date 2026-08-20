import React, { useEffect, useMemo, useState } from 'react';
import { Search, Info, Building2, Route, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDebounce } from '@/hooks/useDebounce';
import { useExhibitorsByEvent } from '@/hooks/useExhibitorsByEvent';
import { useEventCategories, type CategoryExhibitorRow } from '@/hooks/useEventCategories';
import { fetchAllEventExhibitors } from '@/lib/fetchAllEventExhibitors';
import { hydrateExhibitor } from '@/lib/hydrateExhibitor';
import { normalizeStandNumber } from '@/utils/standUtils';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';
import EventCategoryCards, {
  iconFor,
  PANEL_SHADOW,
  type CategoryCardModel,
} from './EventCategoryCards';
import ExhibitorCategoryCarousel from './ExhibitorCategoryCarousel';
import ExhibitorAvatar from './ExhibitorAvatar';
import { ExhibitorsModal } from './ExhibitorsModal';
import { ExhibitorDetailDialog } from './ExhibitorDetailDialog';

const OTHERS_KEY = '__others__';
const VISIBLE_CARDS = 4;

const LIST_NOTICE =
  "Cette liste est constituée à partir des informations publiques disponibles. Elle peut être incomplète : certains exposants n'annoncent pas leur participation en ligne. Pour une liste exhaustive, consultez le site officiel de l'événement.";

interface Props {
  event: Event;
  exhibitorCount: number;
  aiAvailable?: boolean;
  onPrepareVisit?: () => void;
}

/** Recherche transversale : cherche parmi TOUS les exposants du salon. */
const SearchResults: React.FC<{
  event: Event;
  query: string;
  onSelect: (exhibitor: any) => void;
}> = ({ event, query, onSelect }) => {
  const { data, isLoading } = useExhibitorsByEvent(event.slug || '', query, 24, 0, event.id_event);
  const rows = data?.exhibitors || [];

  if (isLoading) {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">Aucun exposant trouvé pour « {query} ».</p>;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((ex: any) => (
        <button
          key={ex.id}
          type="button"
          onClick={() => onSelect(ex)}
          className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors duration-200 hover:border-primary/50"
        >
          <ExhibitorAvatar
            name={ex.exhibitor_name || ex.name}
            logoUrl={ex.logo_url}
            website={ex.website || ex.website_exposant}
            className="h-10 w-10"
            textClassName="text-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {ex.exhibitor_name || ex.name}
            </p>
            {(ex.stand_exposant || ex.stand) && (
              <p className="text-xs text-muted-foreground">
                Stand {normalizeStandNumber(ex.stand_exposant || ex.stand)}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

export const EventExhibitorsSection: React.FC<Props> = ({
  event,
  exhibitorCount,
  aiAvailable = false,
  onPrepareVisit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [allExhibitors, setAllExhibitors] = useState<any[] | null>(null);
  const [selectedExhibitor, setSelectedExhibitor] = useState<any | null>(null);
  const [openedFromModal, setOpenedFromModal] = useState(false);

  const { data: categories, isLoading: loadingCategories } = useEventCategories(event.id);

  const { retained, singletonIds, uncategorizedCount, othersCount, totalFromRpc } = useMemo(() => {
    const rows = categories || [];
    const named = rows.filter((r) => r.category_id);
    return {
      retained: named.filter((r) => r.exhibitor_count > 1),
      singletonIds: named.filter((r) => r.exhibitor_count === 1).map((r) => r.category_id as string),
      uncategorizedCount: rows.find((r) => !r.category_id)?.exhibitor_count ?? 0,
      othersCount:
        named.filter((r) => r.exhibitor_count === 1).length +
        (rows.find((r) => !r.category_id)?.exhibitor_count ?? 0),
      totalFromRpc: rows.reduce((sum, r) => sum + r.exhibitor_count, 0),
    };
  }, [categories]);

  const total = exhibitorCount || totalFromRpc;
  const hasCategoryNav = retained.length > 0;
  const hasOthers = othersCount > 0;

  const cards: CategoryCardModel[] = useMemo(() => {
    const base: CategoryCardModel[] = retained.map((r) => ({
      key: r.category_id as string,
      label: r.label,
      slug: r.slug,
      count: r.exhibitor_count,
      examples: r.example_names || [],
    }));
    if (hasOthers && hasCategoryNav) {
      base.push({
        key: OTHERS_KEY,
        label: 'Autres exposants',
        slug: 'autres-exposants',
        count: othersCount,
        examples: [],
      });
    }
    return base;
  }, [retained, hasOthers, hasCategoryNav, othersCount]);

  // Lot 9 — toutes les catégories, singletons compris, pour permettre
  // la sélection directe d'une catégorie à un seul exposant depuis le drawer.
  const allCards: CategoryCardModel[] = useMemo(() => {
    const named = (categories || []).filter((r) => r.category_id);
    const base: CategoryCardModel[] = named.map((r) => ({
      key: r.category_id as string,
      label: r.label,
      slug: r.slug,
      count: r.exhibitor_count,
      examples: r.example_names || [],
    }));
    if (hasOthers && hasCategoryNav) {
      base.push({
        key: OTHERS_KEY,
        label: 'Autres exposants',
        slug: 'autres-exposants',
        count: othersCount,
        examples: [],
      });
    }
    return base;
  }, [categories, hasOthers, hasCategoryNav, othersCount]);

  // Première catégorie sélectionnée par défaut.
  useEffect(() => {
    if (!activeKey && cards.length > 0) setActiveKey(cards[0].key);
  }, [cards, activeKey]);

  const activeCard = allCards.find((c) => c.key === activeKey) ?? cards[0] ?? null;

  // Les cartes visibles : les plus fournies, plus la catégorie active
  // si elle a été choisie depuis le drawer (singleton compris).
  const visibleCards: CategoryCardModel[] = useMemo(() => {
    const head = cards.slice(0, VISIBLE_CARDS);
    if (!activeCard || head.some((c) => c.key === activeCard.key)) return head;
    // La carte « Autres exposants » reste accessible en dernier rang.
    const othersCard = head.find((c) => c.key === OTHERS_KEY);
    const rest = head.filter((c) => c.key !== OTHERS_KEY);
    const kept = rest.slice(0, VISIBLE_CARDS - 1 - (othersCard ? 1 : 0));
    return othersCard ? [activeCard, ...kept, othersCard] : [activeCard, ...kept];
  }, [cards, activeCard]);

  // Paramètres du carousel selon l'état (catégorie, bucket « Autres », ou repli).
  const carousel = useMemo(() => {
    if (!hasCategoryNav) {
      // Repli : aucune catégorie n'atteint 2 exposants → liste complète.
      const allIds = (categories || [])
        .filter((r) => r.category_id)
        .map((r) => r.category_id as string);
      return {
        categoryIds: allIds,
        includeUncategorized: uncategorizedCount > 0,
        title: 'Tous les exposants',
      };
    }
    if (activeCard?.key === OTHERS_KEY) {
      return {
        categoryIds: singletonIds,
        includeUncategorized: uncategorizedCount > 0,
        title: 'Autres exposants',
      };
    }
    return {
      categoryIds: activeCard ? [activeCard.key] : [],
      includeUncategorized: false,
      title: activeCard ? `Exposants en ${activeCard.label}` : 'Exposants',
    };
  }, [hasCategoryNav, activeCard, singletonIds, uncategorizedCount, categories]);

  const openFromRpcRow = async (row: CategoryExhibitorRow) => {
    await openExhibitor(
      {
        id_exposant: row.id_exposant,
        exhibitor_name: row.display_name,
        stand_exposant: row.stand,
        website_exposant: row.website,
        logo_url: row.logo_url,
        public_slug: row.public_slug,
        seo_indexable: row.seo_indexable ?? false,
        is_test: false,
      },
      false,
    );
  };

  const openExhibitor = async (exhibitor: any, fromModal: boolean) => {
    const light = {
      id_exposant: exhibitor.id_exposant || exhibitor.id,
      exhibitor_uuid: exhibitor.exhibitor_uuid,
      exhibitor_name: exhibitor.exhibitor_name || exhibitor.name,
      stand_exposant: exhibitor.stand_exposant || exhibitor.stand,
      website_exposant: exhibitor.website_exposant || exhibitor.website,
      exposant_description: exhibitor.exposant_description,
      urlexpo_event: exhibitor.urlexpo_event,
      logo_url: exhibitor.logo_url || null,
    };

    const full = await hydrateExhibitor(light);

    setSelectedExhibitor({
      id_exposant: light.id_exposant,
      exhibitor_uuid: full.exhibitor_uuid || exhibitor.exhibitor_uuid,
      exhibitor_name: full.exhibitor_name,
      name_final: full.exhibitor_name,
      stand_exposant: light.stand_exposant,
      website_exposant: full.website_exposant,
      website_final: full.website_exposant,
      exposant_description: full.exposant_description,
      description_final: full.exposant_description,
      ai_resume_court: full.ai_resume_court || exhibitor.ai_resume_court,
      urlexpo_event: full.urlexpo_event,
      logo_url: full.logo_url || null,
      public_slug: exhibitor.public_slug ?? null,
      seo_indexable: exhibitor.seo_indexable ?? false,
      is_test: exhibitor.is_test ?? false,
    });
    setOpenedFromModal(fromModal);
  };

  const handleOpenModal = async () => {
    setShowAllModal(true);
    setOpenedFromModal(false);
    if (allExhibitors === null) {
      const rows = await fetchAllEventExhibitors({ slug: event.slug, idEvent: event.id_event });
      setAllExhibitors(rows);
    }
  };

  // État sans exposant : message existant, pas de catégories, pas de carousel.
  if (total === 0) {
    return (
      <div className="w-full">
        <h2 className="heading-display text-xl font-semibold">Exposants</h2>
        <div className="mt-4 rounded-md bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">
            Liste des exposants non disponible pour le moment.
          </p>
          <p>
            Consultez le{' '}
            {event.url_site_officiel ? (
              <a
                href={event.url_site_officiel}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                site officiel
              </a>
            ) : (
              <span>site officiel</span>
            )}{' '}
            de l'événement pour plus d'informations.
          </p>
        </div>
      </div>
    );
  }

  const isSearching = debouncedSearch.trim().length >= 2;

  return (
    <>
      <div className="w-full">
        {/* Étape 1 — en-tête */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="heading-display text-xl font-semibold">Exposants ({total})</h2>
            <Popover>
              <PopoverTrigger
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="À propos de cette liste"
              >
                <Info className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent className="w-80 text-xs leading-relaxed text-muted-foreground">
                {LIST_NOTICE}
              </PopoverContent>
            </Popover>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un exposant…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isSearching ? (
          <SearchResults
            event={event}
            query={debouncedSearch.trim()}
            onSelect={(ex) => openExhibitor(ex, false)}
          />
        ) : (
          <>
            {/* Étape 2 — onglets de catégories (une seule rangée défilable) */}
            {loadingCategories ? (
              <div className="mt-5 flex gap-2.5 overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[86px] w-[13rem] flex-none rounded-xl" />
                ))}
              </div>
            ) : hasCategoryNav ? (
              <div className="mt-5">
                <EventCategoryCards
                  cards={visibleCards}
                  activeKey={activeCard?.key ?? null}
                  onSelect={setActiveKey}
                  panelId="exposants-panel"
                  onShowAll={
                    cards.length > VISIBLE_CARDS ? () => setAllCategoriesOpen(true) : undefined
                  }
                  showAllCount={(categories || []).filter((c) => c.category_id).length}
                />
              </div>
            ) : null}

            {/* Étape 3 — panneau relié à l'onglet actif (surface blanche continue) */}
            <div
              id="exposants-panel"
              role={hasCategoryNav ? 'tabpanel' : undefined}
              aria-labelledby={
                hasCategoryNav && activeCard ? `cat-tab-${activeCard.key}` : undefined
              }
              style={hasCategoryNav ? { boxShadow: PANEL_SHADOW } : undefined}
              className={cn(hasCategoryNav && 'rounded-xl border-0 bg-card px-4 pb-4 pt-1')}
            >
              <ExhibitorCategoryCarousel
                key={carousel.title}
                eventId={event.id}
                eventSlug={event.slug}
                categoryIds={carousel.categoryIds}
                includeUncategorized={carousel.includeUncategorized}
                title={carousel.title}
                titleIcon={
                  hasCategoryNav && activeCard
                    ? iconFor(activeCard.slug || activeCard.key)
                    : undefined
                }
                onSelect={openFromRpcRow}
              />
            </div>




            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleOpenModal}>
                <Building2 className="mr-1.5 h-4 w-4" />
                Voir tous les exposants ({total})
              </Button>
              {aiAvailable && onPrepareVisit && (
                <Button variant="ghost" size="sm" onClick={onPrepareVisit} className="gap-1.5">
                  <Route className="h-4 w-4" />
                  Créer un parcours IA
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Toutes les catégories, singletons compris */}
      <Sheet open={allCategoriesOpen} onOpenChange={setAllCategoriesOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="heading-display">Toutes les catégories</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1.5">
            {(categories || [])
              .filter((c) => c.category_id)
              .map((c) => (
                <button
                  key={c.category_id}
                  type="button"
                  onClick={() => {
                    // Lot 9 — même pour une catégorie à un seul exposant,
                    // on affiche SA catégorie et non le bucket « Autres ».
                    setActiveKey(c.category_id as string);
                    setAllCategoriesOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200',
                    activeKey === c.category_id ? 'border-primary bg-accent' : 'hover:bg-muted/50',
                  )}
                >
                  <span className="min-w-0 flex-1 text-foreground">{c.label}</span>
                  <span className="flex-none text-xs font-medium text-muted-foreground">
                    {c.exhibitor_count}
                  </span>
                </button>
              ))}
            {uncategorizedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveKey(hasCategoryNav ? OTHERS_KEY : activeKey);
                  setAllCategoriesOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <span className="text-foreground">Non catégorisés</span>
                <span className="text-xs font-medium text-muted-foreground">{uncategorizedCount}</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ExhibitorsModal
        open={showAllModal}
        onOpenChange={setShowAllModal}
        exhibitors={
          allExhibitors?.map((ex) => ({
            id_exposant: ex.id,
            exhibitor_name: ex.name,
            stand_exposant: ex.stand,
            website_exposant: ex.website_exposant || ex.website,
            logo_url: ex.logo_url,
          })) || []
        }
        loading={allExhibitors === null}
        onSelect={async (ex) => {
          setShowAllModal(false);
          const fullEx = allExhibitors?.find((e) => e.id === ex.id_exposant);
          await openExhibitor(fullEx ?? { ...ex, id: ex.id_exposant }, true);
        }}
      />

      <ExhibitorDetailDialog
        open={!!selectedExhibitor}
        onOpenChange={(open) => !open && setSelectedExhibitor(null)}
        exhibitor={selectedExhibitor}
        event={event}
        onBackToAll={
          openedFromModal
            ? () => {
                setSelectedExhibitor(null);
                setShowAllModal(true);
              }
            : undefined
        }
      />
    </>
  );
};

export default EventExhibitorsSection;
