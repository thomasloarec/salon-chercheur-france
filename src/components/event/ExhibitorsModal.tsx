import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { formatStandShort, normalizeStandNumber } from '@/utils/standUtils';
import {
  useEventCategories,
  CATEGORY_PAGE_SIZE,
  type CategoryExhibitorRow,
} from '@/hooks/useEventCategories';
import ExhibitorAvatar from './ExhibitorAvatar';
import useExhibitorLink from '@/hooks/useExhibitorLink';

interface Exhibitor {
  id_exposant: string;
  exhibitor_name: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
  logo_url?: string;
  public_slug?: string | null;
  seo_indexable?: boolean | null;
  // Fields from participations_with_exhibitors view
  name_final?: string;
  legacy_name?: string;
}

interface ExhibitorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Liste complète du salon : sert à la recherche transversale. */
  exhibitors: Exhibitor[];
  loading?: boolean;
  onSelect: (exhibitor: Exhibitor) => void;
  eventId?: string | null;
  /** Slug du salon — métadonnée de tracking uniquement. */
  eventSlug?: string;
  /** Total affiché sur la page salon (source de vérité des compteurs). */
  totalCount?: number;
}

const ALL_KEY = '__all__';
const OTHERS_KEY = '__others__';

const getDisplayName = (exhibitor: Exhibitor): string => {
  const rawName = exhibitor.name_final || exhibitor.exhibitor_name || exhibitor.legacy_name || '';
  return rawName.trim().replace(/^[\s\u00A0\u200B]+/, '');
};

interface Group {
  key: string;
  label: string;
  categoryIds: string[];
  includeUncategorized: boolean;
  count: number;
}

/** Une page de 50 exposants d'un groupe (borne serveur de la RPC). */
async function fetchGroupPage(
  eventId: string,
  group: Group,
  offset: number,
): Promise<CategoryExhibitorRow[]> {
  const { data, error } = await supabase.rpc('get_public_event_exhibitors_by_category', {
    p_event_id: eventId,
    p_category_ids: group.categoryIds,
    p_include_uncategorized: group.includeUncategorized,
    p_limit: CATEGORY_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  return (data || []) as CategoryExhibitorRow[];
}

/**
 * Lot 16 — carte aérée : visuel 40 px, nom sur deux lignes maximum,
 * stand au format court, descriptif sur une seule ligne quand il existe.
 */
const ExhibitorRow: React.FC<{
  name: string;
  stand?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  publicSlug?: string | null;
  isTest?: boolean | null;
  eventSlug?: string;
  onCloseModal: () => void;
  onClick: () => void;
}> = ({ name, stand, tagline, logoUrl, website, publicSlug, isTest, eventSlug, onCloseModal, onClick }) => {
  const shortStand = formatStandShort(stand);
  const link = useExhibitorLink({
    publicSlug,
    isTest,
    surface: 'event_exhibitor_list',
    eventSlug,
    onNavigate: onCloseModal,
  });

  const inner = (
    <>
      <ExhibitorAvatar
        name={name}
        logoUrl={logoUrl || undefined}
        website={website || undefined}
        className="h-10 w-10 flex-none"
        textClassName="text-xs"
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {name}
        </span>
        {shortStand && (
          <span
            className="mt-0.5 block truncate text-xs text-muted-foreground"
            title={`Stand ${normalizeStandNumber(stand)}`}
          >
            Stand {shortStand}
          </span>
        )}
        {tagline && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground/90">
            {tagline}
          </span>
        )}
      </span>
    </>
  );

  const rowClass =
    'group flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60';

  if (link) {
    return (
      <a href={link.href} onClick={link.onClick} className={rowClass}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={rowClass}>
      {inner}
    </button>
  );
};



export const ExhibitorsModal: React.FC<ExhibitorsModalProps> = ({
  open,
  onOpenChange,
  exhibitors = [],
  loading = false,
  onSelect,
  eventId,
  eventSlug,
  totalCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeKey, setActiveKey] = useState<string>(ALL_KEY);

  const { data: categories } = useEventCategories(open ? eventId : null);

  const total = totalCount ?? exhibitors.length;

  // ── Groupes
  // « Tous les exposants » regroupe les catégories fournies puis un bucket
  // « Autres exposants » (singletons + non catégorisés) pour rester lisible.
  // La colonne de navigation, elle, expose CHAQUE catégorie nommée : lot 9,
  // une catégorie à un seul exposant doit s'afficher pour elle-même.
  const { allGroups, navGroups, navEntries } = useMemo(() => {
    const rows = categories || [];
    const named = rows
      .filter((r) => r.category_id)
      .slice()
      .sort((a, b) => b.exhibitor_count - a.exhibitor_count);
    const singletons = named.filter((r) => r.exhibitor_count === 1);
    const retained = named.filter((r) => r.exhibitor_count > 1);
    const uncategorized = rows.find((r) => !r.category_id)?.exhibitor_count ?? 0;
    const othersCount = singletons.reduce((s, r) => s + r.exhibitor_count, 0) + uncategorized;

    const toGroup = (r: (typeof named)[number]): Group => ({
      key: r.category_id as string,
      label: r.label,
      categoryIds: [r.category_id as string],
      includeUncategorized: false,
      count: r.exhibitor_count,
    });

    const overview: Group[] = retained.map(toGroup);
    if (othersCount > 0) {
      overview.push({
        key: OTHERS_KEY,
        label: 'Autres exposants',
        categoryIds: singletons.map((r) => r.category_id as string),
        includeUncategorized: uncategorized > 0,
        count: othersCount,
      });
    }

    const nav: Group[] = named.map(toGroup);
    if (uncategorized > 0) {
      nav.push({
        key: OTHERS_KEY,
        label: 'Autres exposants',
        categoryIds: [],
        includeUncategorized: true,
        count: uncategorized,
      });
    }

    return {
      allGroups: overview,
      navGroups: nav,
      navEntries: [
        { key: ALL_KEY, label: 'Tous les exposants', count: total },
        ...nav.map((g) => ({ key: g.key, label: g.label, count: g.count })),
      ],
    };
  }, [categories, total]);

  const groups = allGroups;

  const activeGroups = useMemo(
    () => (activeKey === ALL_KEY ? allGroups : navGroups.filter((g) => g.key === activeKey)),
    [allGroups, navGroups, activeKey],

  );

  // ── Chargement progressif, groupe par groupe, page par page
  const [loaded, setLoaded] = useState<Record<string, CategoryExhibitorRow[]>>({});
  const [cursor, setCursor] = useState(0); // index du groupe en cours
  const [fetching, setFetching] = useState(false);
  const doneRef = useRef(false);

  const resetProgressive = useCallback(() => {
    setLoaded({});
    setCursor(0);
    doneRef.current = false;
  }, []);

  useEffect(() => {
    resetProgressive();
  }, [activeKey, eventId, resetProgressive]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setActiveKey(ALL_KEY);
      resetProgressive();
    }
  }, [open, resetProgressive]);

  /**
   * Lot 16 — l'ordre alphabétique n'est pas rompu côté client : la RPC trie
   * d'abord par richesse (logo, site, fiche publique) puis par nom. Une page
   * de 50 est donc une tranche « riche » du groupe, et le tri local ne peut
   * pas deviner les noms encore absents. On complète donc un groupe en
   * chaînant ses pages (jusqu'à 200 lignes) avant de rendre la main au
   * défilement, ce qui supprime les sauts de A à M puis retour à B.
   */
  const EAGER_ROWS = 200;

  const loadMore = useCallback(async () => {
    if (!eventId || fetching || doneRef.current) return;
    const group = activeGroups[cursor];
    if (!group) {
      doneRef.current = true;
      return;
    }
    setFetching(true);
    try {
      let offset = (loaded[group.key] || []).length;
      let fetchedNow = 0;
      let reachedEnd = false;
      while (!reachedEnd && fetchedNow < EAGER_ROWS) {
        const rows = await fetchGroupPage(eventId, group, offset);
        setLoaded((prev) => ({ ...prev, [group.key]: [...(prev[group.key] || []), ...rows] }));
        offset += rows.length;
        fetchedNow += rows.length;
        reachedEnd = rows.length < CATEGORY_PAGE_SIZE || offset >= group.count;
      }
      if (reachedEnd) {
        if (cursor + 1 >= activeGroups.length) doneRef.current = true;
        else setCursor((c) => c + 1);
      }
    } catch {
      doneRef.current = true;
    } finally {
      setFetching(false);
    }
  }, [eventId, fetching, activeGroups, cursor, loaded]);


  const isSearching = debouncedSearch.trim().length >= 2;

  // Sentinelle de défilement
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || isSearching) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '200px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, isSearching, loadMore]);

  // Premier chargement dès l'ouverture / changement de catégorie
  useEffect(() => {
    if (open && !isSearching && activeGroups.length > 0 && Object.keys(loaded).length === 0) {
      void loadMore();
    }
  }, [open, isSearching, activeGroups.length, loaded, loadMore]);

  const searchResults = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return exhibitors
      .filter((e) => {
        const name = getDisplayName(e).toLowerCase();
        return name.includes(q) || (e.stand_exposant ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'fr', { sensitivity: 'base' }));
  }, [exhibitors, debouncedSearch]);

  const visibleCount = isSearching
    ? searchResults.length
    : activeGroups.reduce((sum, g) => sum + (loaded[g.key]?.length || 0), 0);

  const hasCategories = groups.length > 0;
  /** Repli (sidebar legacy, salon sans taxonomie) : liste plate alphabétique. */
  const flatMode = !isSearching && !eventId ? true : !isSearching && !!categories && !hasCategories;
  const flatList = useMemo(() => {
    if (isSearching) return searchResults;
    if (!flatMode) return [] as Exhibitor[];
    return [...exhibitors].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b), 'fr', { sensitivity: 'base' }),
    );
  }, [isSearching, searchResults, flatMode, exhibitors]);

  const selectRpcRow = (row: CategoryExhibitorRow) =>
    onSelect({
      id_exposant: row.id_exposant,
      exhibitor_name: row.display_name,
      stand_exposant: row.stand ?? undefined,
      website_exposant: row.website ?? undefined,
      logo_url: row.logo_url ?? undefined,
      public_slug: row.public_slug,
      seo_indexable: row.seo_indexable,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 p-0 sm:h-[85vh]">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="heading-display text-xl">
            Tous les exposants ({total})
          </DialogTitle>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un exposant…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <span className="flex-none text-xs text-muted-foreground">
              {isSearching
                ? `${searchResults.length} résultat${searchResults.length > 1 ? 's' : ''}`
                : `${visibleCount} affiché${visibleCount > 1 ? 's' : ''}`}
            </span>
          </div>
        </DialogHeader>

        {/* Mobile : catégories en rangée défilable */}
        {hasCategories && !isSearching && (
          <div className="flex gap-2 overflow-x-auto border-b px-4 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setActiveKey(entry.key)}
                className={cn(
                  'flex-none rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  activeKey === entry.key
                    ? 'bg-[#EEEDFE] text-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {entry.label} ({entry.count})
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Desktop : colonne de navigation par catégories */}
          {hasCategories && !isSearching && (
            <nav
              aria-label="Catégories d'exposants"
              className="hidden w-[240px] flex-none overflow-y-auto border-r py-2 md:block"
            >
              {navEntries.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setActiveKey(entry.key)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 border-l-2 px-4 py-2 text-left text-sm transition-colors',
                    activeKey === entry.key
                      ? 'border-primary bg-[#EEEDFE] font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  <span className="flex-none text-xs tabular-nums">{entry.count}</span>
                </button>
              ))}
            </nav>
          )}

          {/* Liste dense */}
          <div className="min-w-0 flex-1 overflow-y-auto px-3 py-2">
            {isSearching || flatMode ? (
              flatList.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {isSearching
                    ? `Aucun exposant trouvé pour « ${debouncedSearch.trim()} ».`
                    : 'Aucun exposant à afficher.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  {flatList.map((ex) => (
                    <ExhibitorRow
                      key={ex.id_exposant}
                      name={getDisplayName(ex)}
                      stand={ex.stand_exposant}
                      tagline={ex.exposant_description}
                      logoUrl={ex.logo_url}
                      website={ex.website_exposant}
                      publicSlug={ex.public_slug}
                      eventSlug={eventSlug}
                      onCloseModal={() => onOpenChange(false)}
                      onClick={() => onSelect(ex)}
                    />
                  ))}
                </div>
              )
            ) : (
              <>
                {activeGroups.map((group) => {
                  const rows = loaded[group.key] || [];
                  if (rows.length === 0) return null;
                  const sorted = [...rows].sort((a, b) =>
                    a.display_name.localeCompare(b.display_name, 'fr', { sensitivity: 'base' }),
                  );
                  return (
                    <section key={group.key}>
                      {activeKey === ALL_KEY && (
                        <h3 className="sticky top-0 z-10 -mx-3 bg-background/95 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground backdrop-blur">
                          {group.label} ({group.count})
                        </h3>
                      )}
                      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                        {sorted.map((row) => (
                          <ExhibitorRow
                            key={row.id_exposant}
                            name={row.display_name}
                            stand={row.stand}
                            tagline={row.tagline}
                            logoUrl={row.logo_url}
                            website={row.website}
                            publicSlug={row.public_slug}
                            eventSlug={eventSlug}
                            onCloseModal={() => onOpenChange(false)}
                            onClick={() => selectRpcRow(row)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}

                <div ref={sentinelRef} className="flex justify-center py-4">
                  {(fetching || loading) && (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  )}
                </div>

                {!fetching && visibleCount === 0 && !loading && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Aucun exposant à afficher.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
