import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowDown, ArrowUpRight, CalendarCheck, Search, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import NoveltyCardV2 from "@/components/novelty/NoveltyCardV2";
import { useNoveltiesWatch, type NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";
import { CANONICAL_SECTORS } from "@/lib/noveltiesWatchOptions";
import { useSavedNovelties } from "@/hooks/useSavedNovelties";
import { trackEvent } from "@/lib/consent/gtag";
import { useToast } from "@/hooks/use-toast";

/**
 * Refonte de la page Nouveautés, run F1.1 : structure, recherche, filtres et groupes par salon.
 * Accessible pour recette sur /nouveautes-apercu (noindex). La page publique /nouveautes
 * reste l'ancienne tant que la bascule (F1.4) n'est pas faite.
 * Run F1.2 : cartes NoveltyCardV2 (4:5, repli composition texte) ; défilement horizontal sur téléphone.
 * Run F1.3 : « Enregistrer » (like existant) avec reprise après connexion via ?enregistrer=<id>,
 * lien « Mon agenda » avec compteur, « Nouveau depuis votre dernière visite », événements Google Analytics
 * (trackEvent : envoyés seulement si le visiteur a accepté les cookies de mesure).
 */

type Period = "all" | "week" | "month" | "later";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "all", label: "Tous les salons à venir" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois-ci" },
  { value: "later", label: "Plus tard" },
];

const GROUP_VISIBLE = 3;

/** Date de la dernière visite : localStorage entre deux visites, sessionStorage pendant la visite. */
const LAST_VISIT_KEY = "lotexpo:nouveautes:last-visit";
const VISIT_BASELINE_KEY = "lotexpo:nouveautes:visit-baseline";

/**
 * Renvoie la date de la visite précédente (ou null à la toute première visite).
 * La référence est figée pour toute la session de navigation : les badges « Nouveau »
 * ne disparaissent pas quand on ouvre une fiche puis revient sur la page.
 */
function readVisitBaseline(): number | null {
  try {
    const inSession = sessionStorage.getItem(VISIT_BASELINE_KEY);
    if (inSession !== null) return inSession ? Number(inSession) || null : null;
    const previous = localStorage.getItem(LAST_VISIT_KEY);
    const prevMs = previous ? Date.parse(previous) : NaN;
    sessionStorage.setItem(VISIT_BASELINE_KEY, isNaN(prevMs) ? "" : String(prevMs));
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    return isNaN(prevMs) ? null : prevMs;
  } catch {
    return null;
  }
}

/** Date civile « AAAA-MM-JJ » lue en heure locale. */
function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function normalize(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function eventSectors(secteur: unknown): string[] {
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

/** « du 6 au 8 octobre 2026 », « du 28 septembre au 1er octobre 2026 », « le 6 octobre 2026 ». */
function formatRange(start: Date | null, end: Date | null): string {
  if (!start) return "";
  const dayLabel = (d: Date) => (d.getDate() === 1 ? "1er" : String(d.getDate()));
  const month = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long" });
  if (!end || end.getTime() === start.getTime()) {
    return `le ${dayLabel(start)} ${month(start)} ${start.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `du ${dayLabel(start)} au ${dayLabel(end)} ${month(end)} ${end.getFullYear()}`;
  }
  return `du ${dayLabel(start)} ${month(start)} au ${dayLabel(end)} ${month(end)} ${end.getFullYear()}`;
}

/** Paramètres Google Analytics d'une nouveauté (valeurs limitées à 100 caractères par GA4). */
function gaNoveltyParams(n: NoveltyWatchRow): Record<string, string> {
  return {
    novelty_id: n.id,
    novelty_title: (n.title ?? "").slice(0, 100),
    salon_name: (n.events?.nom_event ?? "").slice(0, 100),
  };
}

interface CardActions {
  savedIds: Set<string>;
  savePending: boolean;
  onToggleSave: (n: NoveltyWatchRow) => void;
  isNew: (n: NoveltyWatchRow) => boolean;
  onOpen: (n: NoveltyWatchRow) => void;
  onPublishClick: (source: string) => void;
}

interface SalonGroup {
  eventId: string;
  event: NonNullable<NoveltyWatchRow["events"]>;
  start: Date | null;
  end: Date | null;
  running: boolean;
  items: NoveltyWatchRow[];
}

export default function NouveautesV2({ preview = false }: { preview?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const sectorParam = searchParams.get("secteur");
  const periodParam = (searchParams.get("periode") as Period | null) ?? "all";
  const period: Period = PERIOD_OPTIONS.some((p) => p.value === periodParam) ? periodParam : "all";

  const { data: rows = [], isLoading, error, refetch, isFetching } = useNoveltiesWatch({
    sectors: [],
    type: null,
    horizon: null,
    region: null,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, authLoading, savedIds, savedLoaded, toggle, isPending } = useSavedNovelties();
  const [visitBaseline] = useState<number | null>(() => readVisitBaseline());

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    if (key === "secteur" || key === "periode") {
      trackEvent("novelties_filter", { filter_type: key, filter_value: value || "tous" });
    }
  };

  const isNew = useCallback(
    (n: NoveltyWatchRow) => {
      if (!visitBaseline) return false;
      const created = Date.parse(n.created_at);
      return !isNaN(created) && created > visitBaseline;
    },
    [visitBaseline],
  );

  const onOpen = useCallback((n: NoveltyWatchRow) => {
    trackEvent("novelty_open", gaNoveltyParams(n));
  }, []);

  const onPublishClick = useCallback((source: string) => {
    trackEvent("publish_click", { source });
  }, []);

  /** Enregistre ou retire. Sans compte : connexion, puis retour ici avec ?enregistrer=<id>. */
  const saveNovelty = useCallback(
    async (n: NoveltyWatchRow, resumed: boolean) => {
      try {
        const { liked } = await toggle(n.id);
        trackEvent(liked ? "novelty_save" : "novelty_unsave", {
          ...gaNoveltyParams(n),
          resumed_after_login: resumed ? "yes" : "no",
        });
        toast(
          liked
            ? {
                title: "Nouveauté enregistrée",
                description: "Retrouvez-la dans Mon agenda. Le salon est ajouté à vos favoris.",
              }
            : { title: "Retirée de Mon agenda" },
        );
      } catch (e: any) {
        toast({
          title: "Erreur",
          description: e?.message || "Impossible d'enregistrer cette nouveauté.",
          variant: "destructive",
        });
      }
    },
    [toggle, toast],
  );

  const onToggleSave = useCallback(
    (n: NoveltyWatchRow) => {
      if (!user) {
        trackEvent("novelty_save_login_required", gaNoveltyParams(n));
        const next = new URLSearchParams(searchParams);
        next.set("enregistrer", n.id);
        const back = `${location.pathname}?${next.toString()}`;
        navigate(`/auth?redirect=${encodeURIComponent(back)}`);
        return;
      }
      void saveNovelty(n, false);
    },
    [user, searchParams, location.pathname, navigate, saveNovelty],
  );

  // Reprise après connexion : on AJOUTE seulement si ce n'est pas déjà enregistré
  // (le like est un interrupteur : sans ce contrôle, un double retour le retirerait).
  const pendingSaveId = searchParams.get("enregistrer");
  const resumeHandled = useRef(false);
  useEffect(() => {
    if (!pendingSaveId || resumeHandled.current || authLoading) return;
    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("enregistrer");
      setSearchParams(next, { replace: true });
    };
    if (!user) {
      // Connexion abandonnée : on nettoie l'adresse, sans rien enregistrer.
      resumeHandled.current = true;
      clearParam();
      return;
    }
    if (!savedLoaded || isLoading) return;
    resumeHandled.current = true;
    clearParam();
    const row = rows.find((r) => r.id === pendingSaveId);
    if (!row) return;
    window.setTimeout(() => {
      document.getElementById(`nouveaute-${row.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    if (savedIds.has(row.id)) {
      toast({ title: "Déjà dans Mon agenda" });
      return;
    }
    void saveNovelty(row, true);
  }, [pendingSaveId, authLoading, user, savedLoaded, isLoading, rows, savedIds, searchParams, setSearchParams, saveNovelty, toast]);

  const cardActions: CardActions = {
    savedIds,
    savePending: isPending,
    onToggleSave,
    isNew,
    onOpen,
    onPublishClick,
  };

  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    ["q", "secteur", "periode"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const sectorLabel = CANONICAL_SECTORS.find((s) => s.value === sectorParam)?.label ?? null;
  const hasFilters = !!(query.trim() || sectorLabel || period !== "all");

  // Filtres recherche + période (le secteur est appliqué ensuite, pour compter les pastilles)
  const beforeSector = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    const dow = weekEnd.getDay();
    weekEnd.setDate(weekEnd.getDate() + (dow === 0 ? 0 : 7 - dow));
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const words = normalize(query).split(/\s+/).filter(Boolean);

    return rows.filter((n) => {
      const start = parseDay(n.events?.date_debut);
      if (!start) return false;
      if (period === "week" && start > weekEnd) return false;
      if (period === "month" && start > monthEnd) return false;
      if (period === "later" && start <= monthEnd) return false;
      if (words.length > 0) {
        const haystack = normalize(
          [n.title, n.summary, n.exhibitors?.name, n.events?.nom_event, n.events?.ville].join(" "),
        );
        if (!words.every((w) => haystack.includes(w))) return false;
      }
      return true;
    });
  }, [rows, query, period]);

  // Pastilles de secteurs : uniquement celles qui ont au moins un résultat
  const sectorChips = useMemo(() => {
    return CANONICAL_SECTORS.map((s) => ({
      value: s.value,
      label: s.label,
      count: beforeSector.filter((n) =>
        eventSectors(n.events?.secteur).some((l) => l.toLowerCase() === s.label.toLowerCase()),
      ).length,
    }))
      .filter((s) => s.count > 0 || s.value === sectorParam)
      .sort((a, b) => b.count - a.count);
  }, [beforeSector, sectorParam]);

  const filtered = useMemo(() => {
    if (!sectorLabel) return beforeSector;
    return beforeSector.filter((n) =>
      eventSectors(n.events?.secteur).some((l) => l.toLowerCase() === sectorLabel.toLowerCase()),
    );
  }, [beforeSector, sectorLabel]);

  const groups = useMemo(() => {
    const map = new Map<string, SalonGroup>();
    for (const n of filtered) {
      if (!n.events) continue;
      const g = map.get(n.event_id);
      if (g) {
        g.items.push(n);
        continue;
      }
      const start = parseDay(n.events.date_debut);
      map.set(n.event_id, {
        eventId: n.event_id,
        event: n.events,
        start,
        end: parseDay(n.events.date_fin) ?? start,
        running: n.timing === "running",
        items: [n],
      });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity) ||
        a.event.nom_event.localeCompare(b.event.nom_event, "fr"),
    );
  }, [filtered]);

  const newCount = useMemo(() => filtered.filter(isNew).length, [filtered, isNew]);

  return (
    <>
      <Helmet>
        <title>L'avant-première des salons : les nouveautés des exposants | Lotexpo</title>
        <meta
          name="description"
          content="Découvrez les nouveautés, lancements et démonstrations que les exposants préparent pour les prochains salons professionnels, et rencontrez-les sur leur stand."
        />
        <link rel="canonical" href="https://lotexpo.com/nouveautes" />
        {preview && <meta name="robots" content="noindex, nofollow" />}
      </Helmet>

      <Header />

      <main className="min-h-screen overflow-x-hidden bg-background">
        {/* ============================= EN-TÊTE ============================= */}
        <section className="relative overflow-hidden bg-surface-inverse text-inverse">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "url(/home-texture-plexus.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.28,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 70% at 30% 40%, transparent, hsl(var(--surface-inverse) / 0.9))",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <div className="max-w-2xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-inverse-primary">
                L’avant-première des salons
              </p>
              <h1 className="heading-display text-[clamp(2.1rem,4.6vw,3.6rem)] leading-[1.08]">
                Ce que vous verrez sur les prochains salons,{" "}
                <em className="italic text-inverse-primary">dès aujourd’hui.</em>
              </h1>
              <p className="mt-5 max-w-[56ch] text-base text-inverse-muted md:text-lg">
                Découvrez ce que les exposants préparent. Repérez ce qui vous intéresse.
                Rencontrez-les sur leur stand.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <a href="#decouvrir">
                    Explorer les nouveautés
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-inverse/40 bg-transparent text-inverse hover:bg-inverse/10 hover:text-inverse"
                >
                  <Link to="/publier-nouveaute" onClick={() => onPublishClick("en-tete")}>
                    Publier gratuitement ma nouveauté
                  </Link>
                </Button>
              </div>
              <ol className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-inverse/15 pt-5 text-sm text-inverse-muted">
                {["Découvrez", "Enregistrez", "Rencontrez"].map((step, i) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="font-semibold text-inverse-primary tabular-nums">0{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ============================= DÉCOUVERTE ============================= */}
        <section id="decouvrir" className="scroll-mt-20 bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
              À découvrir sur les prochains salons
            </p>
            <h2 className="heading-display mt-2 text-3xl text-foreground md:text-4xl">
              Qu’est-ce qui vous intéresse ?
            </h2>

            {/* Recherche et période */}
            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Rechercher un produit, une entreprise ou un salon</span>
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setParam("q", e.target.value || null)}
                  placeholder="Produit, entreprise ou salon…"
                  className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="md:w-64">
                <span className="sr-only">Période</span>
                <select
                  value={period}
                  onChange={(e) => setParam("periode", e.target.value)}
                  className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Secteurs */}
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Secteurs">
              <button
                type="button"
                aria-pressed={!sectorLabel}
                onClick={() => setParam("secteur", null)}
                className={`h-10 rounded-full border px-4 text-sm transition-colors ${
                  !sectorLabel
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:border-foreground/40"
                }`}
              >
                Tous les secteurs
              </button>
              {sectorChips.map((s) => {
                const active = s.value === sectorParam;
                return (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setParam("secteur", active ? null : s.value)}
                    className={`h-10 rounded-full border px-4 text-sm transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {s.label} <span className="tabular-nums opacity-70">{s.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Résumé */}
            {!isLoading && !error && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
                <p className="text-foreground" aria-live="polite">
                  {filtered.length} nouveauté{filtered.length > 1 ? "s" : ""} · {groups.length} salon
                  {groups.length > 1 ? "s" : ""}
                  {newCount > 0 && (
                    <span className="ml-2 font-medium text-primary">
                      · {newCount} nouvelle{newCount > 1 ? "s" : ""} depuis votre dernière visite
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Réinitialiser les filtres
                    </button>
                  )}
                  {user && (
                    <Link
                      to="/agenda"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:border-primary/40"
                    >
                      <CalendarCheck className="h-4 w-4 text-primary" aria-hidden />
                      Mon agenda
                      <span className="tabular-nums text-muted-foreground">
                        {savedLoaded ? savedIds.size : "…"}
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Contenu */}
            <div className="mt-8 space-y-14">
              {isLoading ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-xl border border-destructive/30 bg-background p-8 text-center">
                  <p className="font-medium text-foreground">Impossible de charger les nouveautés.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Le problème vient du chargement, pas de l’absence de nouveautés.
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                    Réessayer
                  </Button>
                </div>
              ) : groups.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-background p-8 text-center">
                  <p className="font-medium text-foreground">
                    {hasFilters
                      ? "Aucune nouveauté ne correspond à votre recherche."
                      : "Aucune nouveauté n’est encore publiée pour les salons à venir."}
                  </p>
                  {hasFilters && (
                    <Button className="mt-4" variant="outline" onClick={resetFilters}>
                      Voir toutes les nouveautés
                    </Button>
                  )}
                </div>
              ) : (
                groups.map((g) => <SalonGroupBlock key={g.eventId} group={g} actions={cardActions} />)
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function SalonGroupBlock({ group, actions }: { group: SalonGroup; actions: CardActions }) {
  const { event, start, end, running, items } = group;
  const visible = items.slice(0, GROUP_VISIBLE);
  const hasMore = items.length > GROUP_VISIBLE;
  const headingId = `salon-${group.eventId}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {start && (
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border bg-background">
              <span className="heading-display text-2xl leading-none text-foreground">
                {String(start.getDate()).padStart(2, "0")}
              </span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {start.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={headingId} className="heading-display text-2xl text-foreground md:text-[1.7rem]">
                {event.slug ? (
                  <Link to={`/events/${event.slug}`} className="hover:text-primary">
                    {event.nom_event}
                  </Link>
                ) : (
                  event.nom_event
                )}
              </h3>
              {running && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  En cours
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatRange(start, end)}
              {event.ville ? ` · ${event.ville}` : ""}
            </p>
          </div>
        </div>
        <Link
          to={`/publier-nouveaute/exposant?event=${event.id}`}
          onClick={() => actions.onPublishClick("salon")}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Vous exposez ici ? Publiez votre nouveauté
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {visible.map((n) => (
          <div key={n.id} id={`nouveaute-${n.id}`} className="w-[80%] shrink-0 scroll-mt-24 snap-start sm:w-auto">
            <NoveltyCardV2
              novelty={n}
              saved={actions.savedIds.has(n.id)}
              savePending={actions.savePending}
              onToggleSave={actions.onToggleSave}
              isNew={actions.isNew(n)}
              onOpen={actions.onOpen}
            />
          </div>
        ))}
      </div>

      {hasMore && event.slug && (
        <div className="mt-4">
          <Link to={`/events/${event.slug}#nouveautes`} className="text-sm font-medium text-primary hover:underline">
            Voir les {items.length} nouveautés de {event.nom_event}
          </Link>
        </div>
      )}
    </section>
  );
}
