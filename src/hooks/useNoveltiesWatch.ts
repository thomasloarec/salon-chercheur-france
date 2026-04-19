import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectorSlugToDbLabels, typeSlugToDbValue } from "@/lib/taxonomy";
import { regionSlugFromPostal } from "@/lib/postalToRegion";

/**
 * Hook de veille pré-événementielle pour la page /nouveautes.
 *
 * Différences clés vs useNoveltiesList :
 * - Ne dédoublonne PAS par événement (toutes les nouveautés publiées sont retournées).
 * - Filtre uniquement sur les salons à venir (date_debut >= aujourd'hui).
 * - Supporte un horizon temporel 30 / 60 / 90 jours.
 * - Trie par date d'événement la plus proche, puis date de publication.
 *
 * Réutilise la même structure de données que useNoveltiesList pour rester compatible.
 */

export interface NoveltyWatchRow {
  id: string;
  title: string;
  type: string;
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
    date_debut: string | null;
    date_fin: string | null;
    type_event: string | null;
    code_postal: string | null;
    secteur: any;
  } | null;
}

export type WatchHorizon = 30 | 60 | 90 | null;

export interface NoveltyWatchFilters {
  sectors: string[];
  type: string | null;
  horizon: WatchHorizon;
  region: string | null;
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

async function fetchNoveltiesWatch({ filters }: FetchOpts): Promise<NoveltyWatchRow[]> {
  const { sectors, type, horizon, region } = filters;

  let q = supabase
    .from("novelties")
    .select(`
      id, title, type, reason_1, media_urls, doc_url, created_at, event_id, exhibitor_id,
      events!inner (
        id, slug, nom_event, date_debut, date_fin, type_event, secteur, visible, ville, code_postal
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

  const rows = (data ?? []).filter((row: any) => {
    if (!row.exhibitors || !row.events) return false;

    // Salons à venir uniquement (date_debut >= today)
    const dateDebut = row.events.date_debut ? new Date(row.events.date_debut) : null;
    if (!dateDebut || isNaN(dateDebut.getTime())) return false;
    if (dateDebut < today) return false;

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
  }) as NoveltyWatchRow[];

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
    ],
    queryFn: () => fetchNoveltiesWatch({ filters }),
    staleTime: 60_000,
  });
}
