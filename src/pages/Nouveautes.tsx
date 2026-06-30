import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, X, CalendarClock, ArrowRight, Layers, SlidersHorizontal } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SafeSelect } from "@/components/ui/SafeSelect";
import NoveltyFeatured from "@/components/novelty/NoveltyFeatured";
import NoveltyMiniCard from "@/components/novelty/NoveltyMiniCard";
import { useNoveltiesWatch, type NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";
import { CANONICAL_SECTORS, NOVELTY_TYPES_OPTIONS } from "@/lib/noveltiesWatchOptions";
import { isImportantNoveltyType } from "@/lib/noveltyTypeMeta";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";

const TEMPORALITE_OPTIONS = [
  { value: "soon", label: "Bientôt (≤ 30 j)" },
  { value: "month", label: "Ce mois-ci" },
  { value: "later", label: "Plus tard" },
];

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
  if (typeof secteur === "object") {
    return Object.values(secteur as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    );
  }
  return [];
}

/** Secteur canonique principal d'une nouveauté (label), ou null. */
function primarySector(n: NoveltyWatchRow): string | null {
  for (const label of getEventSectors(n.events?.secteur)) {
    const matched = CANONICAL_SECTORS.find(
      (s) => s.label.toLowerCase() === label.toLowerCase(),
    );
    if (matched) return matched.label;
  }
  return null;
}

/**
 * Score éditorial (sans statistiques de clic) pour le bloc "À la une".
 * Favorise : image disponible, type fort, salon proche, publication récente,
 * exposant avec fiche publique.
 */
function featuredScore(n: NoveltyWatchRow): number {
  let score = 0;
  if (n.media_urls?.[0]) score += 3;
  if (isImportantNoveltyType(n.type)) score += 2;

  const days = n.events?.date_debut
    ? differenceInDays(new Date(n.events.date_debut), new Date())
    : null;
  if (days !== null) {
    if (days <= 30) score += 3;
    else if (days <= 60) score += 2;
    else if (days <= 90) score += 1;
  }

  const pubDays = differenceInDays(new Date(), new Date(n.created_at));
  if (pubDays <= 14) score += 2;
  else if (pubDays <= 30) score += 1;

  if (n.exhibitors?.slug) score += 1;
  return score;
}

export default function Nouveautes() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sectorParam = searchParams.get("sectors");
  const sectorSlug = sectorParam && sectorParam !== "all" ? sectorParam : null;
  const typeFilter = searchParams.get("novelty_type");
  const eventFilter = searchParams.get("event");
  const temporalite = searchParams.get("when");

  // Une seule source de données : toutes les nouveautés à venir (non filtrées).
  const { data: allRows = [], isLoading, error } = useNoveltiesWatch({
    sectors: [],
    type: null,
    horizon: null,
    region: null,
  });

  const hasActiveFilters = !!(sectorSlug || typeFilter || eventFilter || temporalite);

  // Filtrage client-side de l'ensemble selon les filtres simples.
  const filtered = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return allRows.filter((n) => {
      if (typeFilter && n.type !== typeFilter) return false;
      if (eventFilter && n.event_id !== eventFilter) return false;

      if (sectorSlug) {
        const slug = CANONICAL_SECTORS.find((s) => s.value === sectorSlug)?.label;
        const evSectors = getEventSectors(n.events?.secteur).map((s) => s.toLowerCase());
        if (!slug || !evSectors.includes(slug.toLowerCase())) return false;
      }

      if (temporalite) {
        const d = n.events?.date_debut ? new Date(n.events.date_debut) : null;
        if (!d) return false;
        const days = differenceInDays(d, now);
        const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (temporalite === "soon" && days > 30) return false;
        if (temporalite === "month" && dKey !== monthKey) return false;
        if (temporalite === "later" && d <= endOfMonth) return false;
      }

      return true;
    });
  }, [allRows, typeFilter, eventFilter, sectorSlug, temporalite]);

  // Compteurs hero (sur l'ensemble non filtré, donc stables).
  const heroStats = useMemo(() => {
    const totalNovelties = allRows.length;
    const totalEvents = uniqueCount(allRows.map((n) => n.event_id));
    const sectorsSet = new Set<string>();
    for (const n of allRows) {
      for (const s of getEventSectors(n.events?.secteur)) sectorsSet.add(s);
    }
    return { totalNovelties, totalEvents, totalSectors: sectorsSet.size };
  }, [allRows]);

  // Bloc "À la une" — 1 principale + 3 à 4 secondaires, diversité de secteurs.
  const featured = useMemo(() => {
    if (allRows.length < 3) return null;
    const scored = [...allRows].sort((a, b) => {
      const s = featuredScore(b) - featuredScore(a);
      if (s !== 0) return s;
      const da = a.events?.date_debut ? new Date(a.events.date_debut).getTime() : Infinity;
      const db = b.events?.date_debut ? new Date(b.events.date_debut).getTime() : Infinity;
      return da - db;
    });
    const main = scored[0];
    const usedSectors = new Set<string>();
    const mainSector = primarySector(main);
    if (mainSector) usedSectors.add(mainSector);

    const secondary: NoveltyWatchRow[] = [];
    // 1er passage : diversité de secteurs.
    for (const n of scored.slice(1)) {
      if (secondary.length >= 4) break;
      const sec = primarySector(n);
      if (sec && usedSectors.has(sec)) continue;
      secondary.push(n);
      if (sec) usedSectors.add(sec);
    }
    // 2e passage : compléter si pas assez de diversité.
    if (secondary.length < 4) {
      for (const n of scored.slice(1)) {
        if (secondary.length >= 4) break;
        if (n.id === main.id || secondary.some((s) => s.id === n.id)) continue;
        secondary.push(n);
      }
    }
    if (secondary.length < 2) return null;
    return { main, secondary, ids: new Set([main.id, ...secondary.map((s) => s.id)]) };
  }, [allRows]);

  // Reste (hors "À la une") pour les sections salon & secteur.
  const rest = useMemo(() => {
    if (!featured) return allRows;
    return allRows.filter((n) => !featured.ids.has(n.id));
  }, [allRows, featured]);

  // "À voir avant les prochains salons" — groupé par salon.
  // IMPORTANT : on regroupe sur l'ensemble des nouveautés (allRows), pas sur `rest`.
  // Sinon une nouveauté promue dans le bloc "À la une" serait retirée de son
  // salon, qui afficherait alors un nombre incohérent avec la page détail du
  // salon (ex. PRÉVENTICA GRAND OUEST : 3 nouveautés réelles mais 2 affichées).
  //
  // Règles éditoriales :
  //  - on n'affiche que les salons avec >= 2 nouveautés (un salon avec 1 seule
  //    nouveauté paraît pauvre dans une section de veille) ;
  //  - tri par richesse de contenu d'abord (3+ avant 2), puis par date la plus
  //    proche, afin de mettre en avant les salons riches en nouveautés ;
  //  - on limite à 4 salons.
  const bySalon = useMemo(() => {
    const map = new Map<string, { event: NonNullable<NoveltyWatchRow["events"]>; items: NoveltyWatchRow[] }>();
    for (const n of allRows) {
      if (!n.events) continue;
      const entry = map.get(n.event_id);
      if (entry) entry.items.push(n);
      else map.set(n.event_id, { event: n.events, items: [n] });
    }
    return Array.from(map.values())
      .filter((g) => g.items.length >= 2)
      .sort((a, b) => {
        // Niveau de richesse : 3 nouveautés ou plus prioritaire sur 2.
        const tierA = a.items.length >= 3 ? 0 : 1;
        const tierB = b.items.length >= 3 ? 0 : 1;
        if (tierA !== tierB) return tierA - tierB;
        // À richesse comparable : salon le plus proche d'abord.
        const da = a.event.date_debut ? new Date(a.event.date_debut).getTime() : Infinity;
        const db = b.event.date_debut ? new Date(b.event.date_debut).getTime() : Infinity;
        return da - db;
      })
      .slice(0, 4);
  }, [allRows]);

  // Sections par secteur (uniquement secteurs avec nouveautés).
  const bySector = useMemo(() => {
    const map = new Map<string, NoveltyWatchRow[]>();
    for (const n of rest) {
      const sector = primarySector(n);
      if (!sector) continue;
      const list = map.get(sector) ?? [];
      list.push(n);
      map.set(sector, list);
    }
    return Array.from(map.entries())
      .map(([sector, items]) => ({
        sector,
        items,
        eventCount: uniqueCount(items.map((n) => n.event_id)),
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [rest]);

  // Liste des salons pour le filtre (sur l'ensemble).
  const salonOptions = useMemo(() => {
    const map = new Map<string, { label: string; date: number }>();
    for (const n of allRows) {
      if (!n.events) continue;
      if (!map.has(n.event_id)) {
        map.set(n.event_id, {
          label: n.events.nom_event,
          date: n.events.date_debut ? new Date(n.events.date_debut).getTime() : Infinity,
        });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].date - b[1].date)
      .map(([value, { label }]) => ({ value, label }));
  }, [allRows]);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams(searchParams);
    ["sectors", "novelty_type", "event", "when"].forEach((k) => next.delete(k));
    setSearchParams(next);
  };

  return (
    <>
      <Helmet>
        <title>Nouveautés des exposants — Veille avant salon | Lotexpo</title>
        <meta
          name="description"
          content="Découvrez les lancements, démonstrations et innovations que les exposants présenteront sur les prochains salons professionnels."
        />
        <link rel="canonical" href="https://lotexpo.com/nouveautes" />
      </Helmet>

      <Header />

      <main className="min-h-screen overflow-x-hidden bg-background">
        {/* HERO compact */}
        <section className="border-b bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto max-w-5xl px-4 py-7 md:py-9">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Veille pré-événementielle
            </div>
            <h1 className="heading-display text-2xl leading-tight text-foreground md:text-3xl">
              Nouveautés des exposants
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Découvrez les lancements, démonstrations et innovations qui seront
              présentés sur les prochains salons professionnels.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <HeroStat
                value={heroStats.totalNovelties}
                label="nouveautés"
                loading={isLoading}
              />
              <HeroStat
                value={heroStats.totalEvents}
                label="salons concernés"
                loading={isLoading}
              />
              <HeroStat
                value={heroStats.totalSectors}
                label="secteurs représentés"
                loading={isLoading}
              />
            </div>
          </div>
        </section>

        {/* FILTRES (sticky) */}
        <section className="sticky top-16 z-20 border-b-2 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="container mx-auto max-w-6xl px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold tracking-tight">
                Filtrer les nouveautés
              </span>
              {hasActiveFilters && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  Filtres actifs
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
              <SafeSelect
                ariaLabel="Filtrer par secteur"
                className="w-full md:w-52"
                placeholder="Tous les secteurs"
                value={sectorSlug}
                onChange={(v) => updateParam("sectors", v)}
                options={CANONICAL_SECTORS.map((s) => ({ value: s.value, label: s.label }))}
                allLabel="Tous les secteurs"
              />
              <SafeSelect
                ariaLabel="Filtrer par type de nouveauté"
                className="w-full md:w-48"
                placeholder="Tous les types"
                value={typeFilter}
                onChange={(v) => updateParam("novelty_type", v)}
                options={NOVELTY_TYPES_OPTIONS}
                allLabel="Tous les types"
              />
              <SafeSelect
                ariaLabel="Filtrer par salon"
                className="w-full md:w-56"
                placeholder="Tous les salons"
                value={eventFilter}
                onChange={(v) => updateParam("event", v)}
                options={salonOptions}
                allLabel="Tous les salons"
              />
              <SafeSelect
                ariaLabel="Filtrer par temporalité"
                className="w-full md:w-44"
                placeholder="Quand ?"
                value={temporalite}
                onChange={(v) => updateParam("when", v)}
                options={TEMPORALITE_OPTIONS}
                allLabel="Toutes dates"
              />
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  className="gap-1 self-start font-medium md:ml-auto md:self-center"
                >
                  <X className="h-4 w-4" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="container mx-auto max-w-6xl space-y-12 px-4 py-8 md:py-10">
          {isLoading ? (
            <SkeletonGrid count={4} />
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-destructive">Erreur lors du chargement des nouveautés.</p>
            </div>
          ) : allRows.length === 0 ? (
            <EmptyState />
          ) : hasActiveFilters ? (
            /* RÉSULTATS FILTRÉS — grille simple, pas de redirection */
            <section>
              <div className="mb-5 flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">
                  {filtered.length} nouveauté{filtered.length > 1 ? "s" : ""}
                </h2>
              </div>
              {filtered.length === 0 ? (
                <EmptyState onReset={clearAll} />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {filtered.map((n) => (
                    <NoveltyMiniCard key={n.id} novelty={n} className="h-full" />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* À LA UNE */}
              {featured && (
                <NoveltyFeatured main={featured.main} secondary={featured.secondary} />
              )}

              {/* À VOIR AVANT LES PROCHAINS SALONS */}
              {bySalon.length > 0 && (
              <section aria-labelledby="salons-heading">
                  <div className="section-rule" />
                  <div className="mb-1 flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    <h2 id="salons-heading" className="heading-display text-2xl text-foreground md:text-3xl">
                      À voir avant les prochains salons
                    </h2>
                  </div>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Ce que vous devez regarder si vous vous y rendez.
                  </p>
                  <div className="space-y-6">
                    {bySalon.map((group) => (
                      <SalonGroup key={group.event.id} group={group} />
                    ))}
                  </div>
                </section>
              )}

              {/* SECTIONS PAR SECTEUR */}
              {bySector.length > 0 && (
                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Explorer par secteur
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {bySector.map((group, idx) => (
                    <SectorGroup key={group.sector} group={group} index={idx} />
                  ))}
                </section>
              )}
            </>
          )}

          {/* CTA exposant */}
          <section className="rounded-2xl border border-border/60 bg-muted/30 p-8 text-center md:p-10">
            <h3 className="text-lg font-semibold text-foreground md:text-xl">
              Exposant ? Publiez votre nouveauté avant le salon.
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Apparaissez ici en amont du salon et captez l'attention des visiteurs
              qui préparent leur visite.
            </p>
            <div className="mt-5">
              <Button asChild>
                <Link to="/publier-nouveaute">Trouver mon salon et publier</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}

/* ---------------------------- Sous-composants ---------------------------- */

function HeroStat({ value, label, loading }: { value: number; label: string; loading?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-3 py-4 text-center shadow-sm sm:items-start sm:text-left">
      {loading ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <span className="text-2xl font-bold tabular-nums text-primary md:text-3xl">
          {value}
        </span>
      )}
      <span className="mt-0.5 text-xs font-medium text-muted-foreground md:text-sm">
        {label}
      </span>
    </div>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-12 text-center">
      <h3 className="mb-2 text-lg font-semibold">Aucune nouveauté ne correspond</h3>
      <p className="mb-4 text-sm text-muted-foreground">
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

const SALON_VISIBLE = 3;

function SalonGroup({
  group,
}: {
  group: { event: NonNullable<NoveltyWatchRow["events"]>; items: NoveltyWatchRow[] };
}) {
  const { event, items } = group;
  const visible = items.slice(0, SALON_VISIBLE);
  const hasMore = items.length > SALON_VISIBLE;
  // Layout adapté au nombre de cartes pour éviter tout emplacement vide.
  const gridCols = visible.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";
  const days = event.date_debut ? differenceInDays(new Date(event.date_debut), new Date()) : null;
  const proximity =
    days === null
      ? null
      : days <= 0
      ? "En cours"
      : days === 1
      ? "Demain"
      : days <= 60
      ? `Dans ${days} jours`
      : null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold leading-tight tracking-tight md:text-xl">
              {event.nom_event}
            </h3>
            {proximity && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                <CalendarClock className="h-3 w-3" />
                {proximity}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {event.date_debut && format(new Date(event.date_debut), "dd MMM yyyy", { locale: fr })}
            {event.ville && ` · ${event.ville}`}
          </p>
        </div>
        {event.slug && (
          <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Link to={`/events/${event.slug}`}>
              {hasMore ? `Voir les ${items.length} nouveautés` : "Voir le salon"}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>
      <div className={`grid gap-4 ${gridCols}`}>
        {visible.map((n) => (
          <NoveltyMiniCard key={n.id} novelty={n} hideEvent className="h-full" />
        ))}
      </div>
      {hasMore && (
        <p className="mt-3 text-xs text-muted-foreground">
          {SALON_VISIBLE} nouveautés affichées sur {items.length}
        </p>
      )}
    </div>
  );
}

const SECTOR_VISIBLE = 4;

function SectorGroup({
  group,
  index = 0,
}: {
  group: { sector: string; items: NoveltyWatchRow[]; eventCount: number };
  index?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? group.items : group.items.slice(0, SECTOR_VISIBLE);
  const hasMore = group.items.length > SECTOR_VISIBLE;

  return (
    <div className="scroll-mt-32">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-1 rounded-full bg-primary/70" aria-hidden />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Secteur {String(index + 1).padStart(2, "0")}
            </div>
            <h3 className="text-base font-bold leading-tight md:text-lg">{group.sector}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {group.items.length} nouveauté{group.items.length > 1 ? "s" : ""} ·{" "}
              {group.eventCount} salon{group.eventCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((n) => (
          <NoveltyMiniCard key={n.id} novelty={n} className="h-full" />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Réduire" : `Afficher plus (${group.items.length - SECTOR_VISIBLE})`}
          </Button>
        </div>
      )}
    </div>
  );
}