import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UrlFilters } from "@/lib/useUrlFilters";
import {
  CanonicalEvent,
  normalizeEventRow,
  matchesMonth,
  matchesSectorLabels,
  matchesType,
  isOngoingOrUpcoming,
} from "@/lib/normalizeEvent";
import { sectorSlugToDbLabels, typeSlugToDbValue } from "@/lib/taxonomy";
import { regionSlugFromPostal } from "@/lib/postalToRegion";

/**
 * On tente:
 *  - Filtrage serveur pour type/secteur si colonnes existent (best effort).
 *  - Filtrage serveur pour secteur via jsonb.contains("secteur", ["Label"]) si la colonne existe.
 * En cas d'erreur (colonne manquante) -> fallback: on refait un fetch sans filtres SQL et on filtre en mémoire.
 */

async function fetchEventsServer(filters: UrlFilters, tryServerFilters: boolean): Promise<CanonicalEvent[]> {
  const { sector, type /* month, region */ } = filters;

  let q = supabase
    .from("events")
    .select("*")
    .eq("visible", true) // respecte RLS et évite les surprises
    .order("date_debut", { ascending: true });

  if (tryServerFilters) {
    // TYPE via type_event
    const dbType = typeSlugToDbValue(type);
    if (dbType) q = q.eq("type_event", dbType);

    // SECTEUR via jsonb contains
    if (sector) {
      const labels = sectorSlugToDbLabels(sector);
      if (labels.length === 1) {
        q = q.contains("secteur", [labels[0]]);
      } else if (labels.length > 1) {
        const parts = labels.map(l => `secteur.cs.${JSON.stringify([l])}`);
        q = q.or(parts.join(","));
      }
    }

    // MOIS -> filtré côté client (pas de LIKE sur date)
    // REGION → pas de colonne en base pour le moment → pas de filtre serveur
  }

  const { data, error } = await q;
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeEventRow);
}

function matchesRegion(ev: CanonicalEvent, wantedSlug: string | null): boolean {
  if (!wantedSlug) return true;
  const slug = regionSlugFromPostal(ev.postal_code);
  return slug === wantedSlug;
}

async function fetchEvents(filters: UrlFilters): Promise<CanonicalEvent[]> {
  try {
    // Tentative serveur (Secteur + Type seulement)
    const rows = await fetchEventsServer(filters, true);
    // Appliquer filtres côté client
    const byMonth = rows.filter(ev => matchesMonth(ev, filters.month));
    const byDate = byMonth.filter(ev => isOngoingOrUpcoming(ev));
    const byRegion = byDate.filter(ev => matchesRegion(ev, filters.region));
    console.log("[events] rows:", byRegion.length, "filters:", filters);
    return byRegion;
  } catch (e) {
    console.warn("[events] server filters failed, fallback client:", (e as any)?.message ?? e);
    // Fallback: récupérer tout (visible) puis filtrer en mémoire
    const all = await fetchEventsServer({ sector: null, type: null, month: null, region: null }, false);

    const byType = all.filter(ev => matchesType(ev, typeSlugToDbValue(filters.type)));
    const wantedLabels = filters.sector ? sectorSlugToDbLabels(filters.sector) : null;
    const bySector = byType.filter(ev => matchesSectorLabels(ev, wantedLabels));
    const byMonth = bySector.filter(ev => matchesMonth(ev, filters.month));
    const byDate = byMonth.filter(ev => isOngoingOrUpcoming(ev));
    const byRegion = byDate.filter(ev => matchesRegion(ev, filters.region));
    return byRegion;
  }
}

export function useEventsList(filters: UrlFilters) {
  return useQuery({
    queryKey: ["events:list", filters],
    queryFn: () => fetchEvents(filters),
    staleTime: 60_000,
  });
}