import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectorSlugToDbLabels, typeSlugToDbValue } from "@/lib/taxonomy";
import { regionSlugFromPostal } from "@/lib/postalToRegion";

/**
 * Hook de veille pré-événementielle pour la page /nouveautes.
 *
 * Différences clés vs useNoveltiesList :
 * - Ne dédoublonne PAS par événement (toutes les nouveautés publiées sont retournées).
 * - Par défaut : salons en cours ou à venir (date_fin >= aujourd'hui, repli sur date_debut).
 *   Avec `includePast: true`, les salons terminés sont aussi renvoyés (archives).
 * - Supporte un horizon temporel 30 / 60 / 90 jours (calculé sur date_debut).
 * - Trie par date d'événement la plus proche, puis date de publication.
 * - Exclut explicitement les contenus de test, y compris pour un administrateur
 *   (l'admin voit ainsi exactement ce que voit le public).
 * - Résout le stand depuis `participation` (source unique), en UNE requête groupée.
 *
 * Réutilise la même structure de données que useNoveltiesList pour rester compatible.
 */

export type NoveltyTiming = "upcoming" | "running" | "past";

export interface NoveltyWatchRow {
  id: string;
  title: string;
  type: string;
  slug: string | null;
  reason_1: string | null;
  media_urls: string[];
  doc_url: string | null;
  created_at: string;
  exhibitor_id: string;
  event_id: string;
  exhibitors: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    website?: string | null;
  } | null;
  events: {
    id: string;
    nom_event: string;
    slug: string;
    ville: string | null;
    /** Lieu du salon (ex. « Paris Expo Porte de Versailles »), si connu. */
    nom_lieu?: string | null;
    date_debut: string | null;
    date_fin: string | null;
    type_event: string | null;
    code_postal: string | null;
    secteur: any;
  } | null;
  /** Phrase d'intérêt concrète (champ `summary`). */
  summary?: string | null;
  /** Publics visés, tels que saisis. */
  audience_tags?: string[] | null;
  /** Provenance fixée à la création : exhibitor | lotexpo | unknown. */
  origin?: "exhibitor" | "lotexpo" | "unknown" | null;
  /** Mode d'affichage du média : photo | typographic | null (automatique). */
  display_mode?: "photo" | "typographic" | null;
  /** Stand(s) connus pour ce couple exposant + salon, depuis `participation`. Vide = à confirmer. */
  stands?: string[];
  /** Position du salon par rapport à aujourd'hui. */
  timing?: NoveltyTiming;
}

export type WatchHorizon = 30 | 60 | 90 | null;

export interface NoveltyWatchFilters {
  sectors: string[];
  type: string | null;
  horizon: WatchHorizon;
  region: string | null;
  /** true = inclure aussi les salons terminés (archives). Défaut : false. */
  includePast?: boolean;
}

interface FetchOpts {
  filters: NoveltyWatchFilters;
}

function parseEventSectors(secteur: unknown): string[] {
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
      (v): v is string => typeof v === "string"
    );
  }
  return [];
}

/**
 * Une date de salon « AAAA-MM-JJ » est une date CIVILE : on la lit en heure
 * locale (minuit local). `new Date("2026-09-28")` la lirait en UTC, soit 02:00
 * à Paris, et un salon ouvert aujourd'hui passerait pour « à venir ».
 */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Stands par couple (salon, exposant), en une seule requête.
 * Une erreur ici ne doit jamais faire échouer la page : on renvoie une map vide.
 */
async function fetchStands(rows: any[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (rows.length === 0) return map;

  const eventIds = Array.from(new Set(rows.map((r) => r.event_id).filter(Boolean)));
  const exhibitorIds = Array.from(new Set(rows.map((r) => r.exhibitor_id).filter(Boolean)));
  if (eventIds.length === 0 || exhibitorIds.length === 0) return map;

  // Découpage par paquets pour garder des URL courtes quand le catalogue grandit.
  const CHUNK = 100;
  const results: any[] = [];
  for (let e = 0; e < eventIds.length; e += CHUNK) {
    for (let x = 0; x < exhibitorIds.length; x += CHUNK) {
      const { data, error } = await supabase
        .from("participation")
        .select("id_event, exhibitor_id, stand_exposant")
        .in("id_event", eventIds.slice(e, e + CHUNK))
        .in("exhibitor_id", exhibitorIds.slice(x, x + CHUNK));
      if (error) {
        console.error("⚠️ useNoveltiesWatch stands error (non bloquant):", error);
        return map;
      }
      results.push(...(data ?? []));
    }
  }

  for (const p of results) {
    const stand = typeof p.stand_exposant === "string" ? p.stand_exposant.trim() : "";
    if (!stand) continue;
    const key = `${p.id_event}|${p.exhibitor_id}`;
    const list = map.get(key) ?? [];
    if (!list.some((s) => s.toLowerCase() === stand.toLowerCase())) list.push(stand);
    map.set(key, list);
  }
  return map;
}

async function fetchNoveltiesWatch({ filters }: FetchOpts): Promise<NoveltyWatchRow[]> {
  const { sectors, type, horizon, region } = filters;
  const includePast = filters.includePast === true;

  let q = supabase
    .from("novelties")
    .select(`
      id, title, type, slug, reason_1, summary, audience_tags, origin, display_mode, is_test,
      media_urls, doc_url, created_at, event_id, exhibitor_id,
      events!inner (
        id, slug, nom_event, date_debut, date_fin, type_event, secteur, visible, is_test, ville, code_postal, nom_lieu
      ),
      exhibitors!novelties_exhibitor_id_fkey ( id, name, slug, logo_url, website )
    `)
    .eq("status", "published")
    .eq("events.visible", true);

  // Filtre type d'événement (réutilise taxonomie existante)
  const dbType = typeSlugToDbValue(type);
  if (dbType) q = q.eq("events.type_event", dbType);

  const { data, error } = await q;
  if (error) {
    console.error("❌ useNoveltiesWatch error:", error);
    throw error;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sectorLabels = sectors.length > 0 ? sectors.flatMap((s) => sectorSlugToDbLabels(s)) : [];

  const kept = (data ?? []).filter((row: any) => {
    if (!row.exhibitors || !row.events) return false;

    // Contenus de test exclus pour tout le monde, admin compris
    if (row.is_test === true || row.events.is_test === true) return false;

    // Salons en cours ou à venir : on garde la nouveauté tant que le salon
    // n'est pas terminé (date_fin >= today). Repli sur date_debut si date_fin manque.
    const dateDebut = toDate(row.events.date_debut);
    if (!dateDebut) return false;
    const dateFin = toDate(row.events.date_fin) ?? dateDebut;
    if (!includePast && dateFin < today) return false;

    // Horizon temporel
    if (horizon) {
      const horizonDate = new Date(today);
      horizonDate.setDate(horizonDate.getDate() + horizon);
      if (dateDebut > horizonDate) return false;
    }

    // Filtre secteur (sur secteur JSONB de events)
    if (sectorLabels.length > 0) {
      const evSectors = parseEventSectors(row.events.secteur);
      const match = sectorLabels.some((label) =>
        evSectors.some((s) => s.toLowerCase() === label.toLowerCase())
      );
      if (!match) return false;
    }

    // Filtre région (basé sur code_postal, comme useNoveltiesList)
    if (region) {
      const eventRegion = regionSlugFromPostal(row.events.code_postal);
      if (eventRegion !== region) return false;
    }

    return true;
  }) as any[];

  const stands = await fetchStands(kept);

  const rows: NoveltyWatchRow[] = kept.map((row: any) => {
    const dateDebut = toDate(row.events.date_debut) as Date;
    const dateFin = toDate(row.events.date_fin) ?? dateDebut;
    const timing: NoveltyTiming =
      dateFin < today ? "past" : dateDebut <= today ? "running" : "upcoming";
    return {
      ...row,
      stands: stands.get(`${row.event_id}|${row.exhibitor_id}`) ?? [],
      timing,
    } as NoveltyWatchRow;
  });

  // Tri : date d'événement la plus proche, puis date de publication décroissante
  rows.sort((a, b) => {
    const da = a.events?.date_debut ? new Date(a.events.date_debut).getTime() : Infinity;
    const db = b.events?.date_debut ? new Date(b.events.date_debut).getTime() : Infinity;
    if (da !== db) return da - db;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return rows;
}

export function useNoveltiesWatch(filters: NoveltyWatchFilters) {
  return useQuery({
    queryKey: [
      "novelties:watch",
      filters.sectors.join(",") || "all",
      filters.type ?? "all",
      filters.horizon ?? "all",
      filters.region ?? "all",
      filters.includePast ? "with-past" : "current",
    ],
    queryFn: () => fetchNoveltiesWatch({ filters }),
    staleTime: 60_000,
  });
}
