import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UrlFilters } from "@/lib/useUrlFilters";
import { useAuth } from '@/contexts/AuthContext';
import {
  CanonicalEvent,
  normalizeEventRow,
  matchesMonth,
  matchesSectorLabels,
  matchesType,
} from "@/lib/normalizeEvent";
import { sectorSlugToDbLabels, typeSlugToDbValue } from "@/lib/taxonomy";

/**
 * On tente:
 *  - Filtrage serveur pour type/region/mois si colonnes existent (best effort).
 *  - Filtrage serveur pour secteur via jsonb.contains("secteur", ["Label"]) si la colonne existe.
 * En cas d'erreur (colonne manquante) -> fallback: on refait un fetch sans filtres SQL et on filtre en mémoire.
 */

async function fetchEventsServer(filters: UrlFilters, tryServerFilters: boolean, isAdmin: boolean): Promise<CanonicalEvent[]> {
  const { sector, type, month /* region */ } = filters;

  let q = supabase
    .from("events")
    .select("*")
    .eq("visible", true) // respecte RLS et évite les surprises
    .order("date_debut", { ascending: true });

  if (tryServerFilters) {
    // TYPE via type_event
    const dbType = typeSlugToDbValue(type);
    if (dbType) q = q.eq("type_event", dbType);

    // MOIS via date_debut (text cast pour LIKE)
    if (month) q = q.like("date_debut", `%-${month}-%`);

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

    // REGION → pas de colonne en base pour le moment → pas de filtre serveur
  }

  const { data, error } = await q;
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeEventRow);
}

async function fetchEvents(filters: UrlFilters, isAdmin: boolean): Promise<CanonicalEvent[]> {
  try {
    // Tentative full serveur
    const rows = await fetchEventsServer(filters, true, isAdmin);
    console.log("[events] rows:", rows.length, "filters:", filters);
    return rows;
  } catch (e) {
    console.warn("[events] server filters failed, fallback client:", (e as any)?.message ?? e);
    // Fallback: récupérer tout (visible) puis filtrer en mémoire
    const all = await fetchEventsServer({ sector: null, type: null, month: null, region: null }, false, isAdmin);

    const byType = all.filter(ev => matchesType(ev, typeSlugToDbValue(filters.type)));
    const byMonth = byType.filter(ev => matchesMonth(ev, filters.month));
    const wantedLabels = filters.sector ? sectorSlugToDbLabels(filters.sector) : null;
    const bySector = byMonth.filter(ev => matchesSectorLabels(ev, wantedLabels));
    // Région : noop pour le moment (pas de champ)
    return bySector;
  }
}

export function useEventsList(filters: UrlFilters) {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@lotexpo.com';

  return useQuery({
    queryKey: ["events:list", filters, isAdmin],
    queryFn: () => fetchEvents(filters, isAdmin),
    staleTime: 60_000,
  });
}