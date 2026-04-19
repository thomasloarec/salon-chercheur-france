import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Sparkles, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SafeSelect } from "@/components/ui/SafeSelect";
import NoveltyWatchCard from "@/components/novelty/NoveltyWatchCard";
import { useNoveltiesWatch, type NoveltyWatchRow, type WatchHorizon } from "@/hooks/useNoveltiesWatch";
import { CANONICAL_SECTORS, NOVELTY_TYPES_OPTIONS } from "@/lib/noveltiesWatchOptions";
import { fetchAllRegions } from "@/lib/filtersData";
import { useQuery } from "@tanstack/react-query";
import { sectorSlugToDbLabels } from "@/lib/taxonomy";

const HORIZON_OPTIONS = [
  { value: "30", label: "30 prochains jours" },
  { value: "60", label: "60 prochains jours" },
  { value: "90", label: "90 prochains jours" },
];

function getHorizon(raw: string | null): WatchHorizon {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (n === 30 || n === 60 || n === 90) return n;
  return null;
}

function uniqueCount<T>(items: T[]) {
  return new Set(items).size;
}

function getEventSectors(secteur: unknown): string[] {
  if (!secteur) return [];
  if (Array.isArray(secteur)) return secteur.filter((s): s is string => typeof s === "string");
  if (typeof secteur === "string") {
    try {
      const parsed = JSON.parse(secteur);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
    } catch {
      return secteur.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [secteur];
  }
  return [];
}

export default function Nouveautes() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sectorParam = searchParams.get("sectors");
  const sectorSlug = sectorParam && sectorParam !== "all" ? sectorParam : null;
  const typeFilter = searchParams.get("novelty_type");
  const horizonFilter = getHorizon(searchParams.get("horizon"));
  const regionFilter = searchParams.get("region");

  const filters = useMemo(
    () => ({
      sectors: sectorSlug ? [sectorSlug] : [],
      type: null, // type d'événement non utilisé sur cette page
      horizon: horizonFilter,
      region: regionFilter,
    }),
    [sectorSlug, horizonFilter, regionFilter]
  );

  const { data: rows = [], isLoading, error } = useNoveltiesWatch(filters);

  // Filtre supplémentaire client-side : type de nouveauté (champ novelties.type)
  const novelties = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((n) => n.type === typeFilter);
  }, [rows, typeFilter]);

  const { data: regions = [] } = useQuery({
    queryKey: ["filters:regions"],
    queryFn: fetchAllRegions,
    staleTime: 5 * 60_000,
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams(searchParams);
    ["sectors", "novelty_type", "horizon", "region"].forEach((k) => next.delete(k));
    setSearchParams(next);
  };

  const hasActiveFilters = !!(sectorSlug || typeFilter || horizonFilter || regionFilter);

  // Compteurs hero (basés sur l'ensemble non filtré pour rester stables)
  const { data: allRows = [] } = useNoveltiesWatch({
    sectors: [],
    type: null,
    horizon: null,
    region: null,
  });
  const heroStats = useMemo(() => {
    const totalNovelties = allRows.length;
    const totalEvents = uniqueCount(allRows.map((n) => n.event_id));
    const sectorsSet = new Set<string>();
    for (const n of allRows) {
      for (const s of getEventSectors(n.events?.secteur)) sectorsSet.add(s);
    }
    return { totalNovelties, totalEvents, totalSectors: sectorsSet.size };
  }, [allRows]);

  // À surveiller maintenant : 3 à 6 priorités (dates les plus proches)
  const watchNow = useMemo(() => {
    if (hasActiveFilters) return [];
    return allRows.slice(0, 6);
  }, [allRows, hasActiveFilters]);

  // Veille par secteur : groupe par secteur, n'affiche que ceux qui ont >= 1 nouveauté
  const bySector = useMemo(() => {
    const map = new Map<string, NoveltyWatchRow[]>();
    for (const n of novelties) {
      const evSectors = getEventSectors(n.events?.secteur);
      if (evSectors.length === 0) continue;
      // On rattache la nouveauté à son secteur principal canonique uniquement
      for (const label of evSectors) {
        const matched = CANONICAL_SECTORS.find(
          (s) => s.label.toLowerCase() === label.toLowerCase()
        );
        if (!matched) continue;
        const list = map.get(matched.label) ?? [];
        list.push(n);
        map.set(matched.label, list);
        break; // évite de dupliquer la même nouveauté dans plusieurs secteurs
      }
    }
    const arr = Array.from(map.entries()).map(([sector, items]) => ({
      sector,
      items,
      eventCount: uniqueCount(items.map((n) => n.event_id)),
      nextEventDate: items
        .map((n) => n.events?.date_debut)
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime())
        .sort((a, b) => a - b)[0] ?? Infinity,
    }));
    arr.sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.nextEventDate - b.nextEventDate;
    });
    return arr;
  }, [novelties]);

  return (
    <>
      <Helmet>
        <title>Veille B2B — Ce que les exposants préparent | Lotexpo</title>
        <meta
          name="description"
          content="Repérez les lancements, démonstrations et innovations annoncés par les exposants avant les prochains salons professionnels."
        />
        <link rel="canonical" href="https://lotexpo.com/nouveautes" />
      </Helmet>

      <Header />

      <main className="min-h-screen bg-background">
        {/* BLOC 1 — Hero éditorial */}
        <section className="border-b bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 py-10 md:py-14 max-w-5xl">
            <div className="flex items-center gap-2 text-sm text-primary mb-3">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium uppercase tracking-wide text-xs">
                Veille pré-événementielle
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              Ce que les exposants préparent avant les prochains salons
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-3xl">
              Repérez les lancements, démonstrations et innovations annoncés avant votre visite.
            </p>

            {/* Compteurs */}
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-2xl">
              <HeroStat
                value={heroStats.totalNovelties}
                label="Nouveautés publiées"
                loading={isLoading && allRows.length === 0}
              />
              <HeroStat
                value={heroStats.totalEvents}
                label="Salons concernés"
                loading={isLoading && allRows.length === 0}
              />
              <HeroStat
                value={heroStats.totalSectors}
                label="Secteurs représentés"
                loading={isLoading && allRows.length === 0}
              />
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-8 md:py-10 max-w-6xl space-y-12">
          {/* BLOC 2 — À surveiller maintenant (masqué si filtres actifs) */}
          {!hasActiveFilters && (
            <section>
              <div className="flex items-end justify-between mb-4 gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold">À surveiller maintenant</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Les nouveautés des salons les plus proches.
                  </p>
                </div>
              </div>
              {isLoading ? (
                <SkeletonGrid count={3} />
              ) : watchNow.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune nouveauté à surveiller pour le moment.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {watchNow.map((n) => (
                    <NoveltyWatchCard key={n.id} novelty={n} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* BLOC 3 — Filtres */}
          <section>
            <div className="rounded-xl border bg-card p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-3">
                <FilterField label="Secteur">
                  <SafeSelect
                    ariaLabel="Filtrer par secteur"
                    className="w-full md:w-56"
                    placeholder="Tous les secteurs"
                    value={sectorSlug}
                    onChange={(v) => updateParam("sectors", v)}
                    options={CANONICAL_SECTORS.map((s) => ({ value: s.value, label: s.label }))}
                    allLabel="Tous les secteurs"
                  />
                </FilterField>
                <FilterField label="Horizon">
                  <SafeSelect
                    ariaLabel="Filtrer par horizon temporel"
                    className="w-full md:w-48"
                    placeholder="Toutes dates"
                    value={horizonFilter ? String(horizonFilter) : null}
                    onChange={(v) => updateParam("horizon", v)}
                    options={HORIZON_OPTIONS}
                    allLabel="Toutes dates"
                  />
                </FilterField>
                <FilterField label="Type de nouveauté">
                  <SafeSelect
                    ariaLabel="Filtrer par type de nouveauté"
                    className="w-full md:w-48"
                    placeholder="Tous les types"
                    value={typeFilter}
                    onChange={(v) => updateParam("novelty_type", v)}
                    options={NOVELTY_TYPES_OPTIONS}
                    allLabel="Tous les types"
                  />
                </FilterField>
                <FilterField label="Région">
                  <SafeSelect
                    ariaLabel="Filtrer par région"
                    className="w-full md:w-48"
                    placeholder="Toutes régions"
                    value={regionFilter}
                    onChange={(v) => updateParam("region", v)}
                    options={regions}
                    allLabel="Toutes régions"
                  />
                </FilterField>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="md:ml-auto gap-1"
                  >
                    <X className="h-4 w-4" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* BLOC 4 — Veille par secteur */}
          <section className="space-y-10">
            {isLoading && bySector.length === 0 ? (
              <SkeletonGrid count={4} />
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive">Erreur lors du chargement des nouveautés.</p>
              </div>
            ) : bySector.length === 0 ? (
              <EmptyState onReset={hasActiveFilters ? clearAll : undefined} />
            ) : (
              bySector.map((group) => (
                <SectorGroup key={group.sector} group={group} />
              ))
            )}
          </section>

          {/* BLOC 6 — CTA exposants */}
          <section className="rounded-2xl border bg-muted/30 p-6 md:p-8 text-center">
            <h3 className="text-lg md:text-xl font-semibold">
              Vous exposez prochainement ?
            </h3>
            <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-2xl mx-auto">
              Publiez votre nouveauté pour apparaître ici avant le salon et capter l'attention
              des visiteurs en amont.
            </p>
            <div className="mt-5">
              <Button asChild>
                <Link to="/events">Trouver mon salon et publier</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}

/* ---------- Sous-composants ---------- */

function HeroStat({
  value,
  label,
  loading,
}: {
  value: number;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 md:p-5">
      {loading ? (
        <Skeleton className="h-8 w-16 mb-2" />
      ) : (
        <div className="text-2xl md:text-3xl font-bold tabular-nums">{value}</div>
      )}
      <div className="text-xs md:text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
      <label className="text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </label>
      {children}
    </div>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed py-12 px-4 text-center">
      <h3 className="text-lg font-semibold mb-2">Aucune nouveauté ne correspond</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {onReset
          ? "Essayez de modifier ou de réinitialiser vos filtres."
          : "Aucune nouveauté n'est encore publiée pour les salons à venir."}
      </p>
      {onReset && (
        <Button variant="outline" onClick={onReset}>
          Réinitialiser les filtres
        </Button>
      )}
    </div>
  );
}

const INITIAL_VISIBLE = 4;

function SectorGroup({
  group,
}: {
  group: { sector: string; items: NoveltyWatchRow[]; eventCount: number };
}) {
  const visible = group.items.slice(0, INITIAL_VISIBLE);
  const hasMore = group.items.length > INITIAL_VISIBLE;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">{group.sector}</h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {group.items.length} nouveauté{group.items.length > 1 ? "s" : ""} ·{" "}
            {group.eventCount} salon{group.eventCount > 1 ? "s" : ""} concerné
            {group.eventCount > 1 ? "s" : ""}
          </p>
        </div>
        {hasMore && (
          <Badge variant="secondary" className="font-normal">
            {group.items.length} au total
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((n) => (
          <NoveltyWatchCard key={n.id} novelty={n} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/nouveautes?sectors=${slugifyForLink(group.sector)}`}>
              Voir toutes les nouveautés du secteur
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function slugifyForLink(label: string): string {
  const found = CANONICAL_SECTORS.find((s) => s.label === label);
  return found?.value ?? "all";
}
