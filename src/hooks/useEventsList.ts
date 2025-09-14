import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UrlFilters } from "@/lib/useUrlFilters";
import { useAuth } from '@/contexts/AuthContext';
import { normalizeEventRow, matchesMonth, matchesRegion, matchesType, matchesSectorLabels, CanonicalEvent } from "@/lib/normalizeEvent";
import { sectorSlugToDbLabels } from "@/lib/taxonomy";

/**
 * On tente:
 *  - Filtrage serveur pour type/region/mois si colonnes existent (best effort).
 *  - Filtrage serveur pour secteur via jsonb.contains("secteur", ["Label"]) si la colonne existe.
 * En cas d'erreur (colonne manquante) -> fallback: on refait un fetch sans filtres SQL et on filtre en mémoire.
 */

async function fetchEventsServer(filters: UrlFilters, tryServerFilters: boolean, isAdmin: boolean): Promise<CanonicalEvent[]> {
  const { sector, type, month, region } = filters;

  let q = supabase.from("events").select("*"); // ← pas de colonnes nommées pour éviter 42703

  // Filtre visibilité pour les non-admins
  if (!isAdmin && tryServerFilters) {
    q = q.eq('visible', true);
  }

  // B2B uniquement
  if (tryServerFilters) {
    q = q.eq('is_b2b', true);
  }

  // Événements à partir d'aujourd'hui (sauf si mois spécifié)
  if (!month && tryServerFilters) {
    q = q.gte('date_debut', new Date().toISOString().slice(0, 10));
  }

  // Tentative de filtres serveur si demandé
  if (tryServerFilters) {
    // type
    if (type) q = q.eq("type_event", type);
    // region (via départements)
    if (region) {
      const { data: departments } = await supabase
        .from('departements')
        .select('code')
        .eq('region_code', region);
      
      if (departments && departments.length > 0) {
        const deptCodes = departments.map(d => d.code);
        const orConditions = deptCodes
          .map(code => `code_postal.like.${code}*`)
          .join(',');
        q = q.or(orConditions);
      }
    }
    // mois
    if (month) {
      const year = new Date().getFullYear();
      const monthNum = parseInt(month);
      const startDate = new Date(year, monthNum - 1, 1).toISOString().slice(0, 10);
      const endDate = new Date(year, monthNum, 0).toISOString().slice(0, 10);
      
      q = q
        .gte('date_debut', startDate)
        .lte('date_debut', endDate);
    }
    // secteur (jsonb)
    if (sector) {
      const labels = sectorSlugToDbLabels(sector);
      if (labels.length === 1) {
        q = q.contains("secteur", [labels[0]]);
      } else if (labels.length > 1) {
        const parts = labels.map(l => `secteur.cs.${JSON.stringify([l])}`);
        q = q.or(parts.join(","));
      }
    }
  }

  q = q.order("date_debut", { ascending: true });

  const { data, error } = await q;
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return rows.map(normalizeEventRow);
}

async function fetchEvents(filters: UrlFilters, isAdmin: boolean): Promise<CanonicalEvent[]> {
  // 1) Essai avec filtres serveur
  try {
    const server = await fetchEventsServer(filters, true, isAdmin);
    // si on a des résultats, parfait
    // si on a 0 résultat alors que c'est cohérent -> on renvoie 0 (pas besoin de fallback)
    return server;
  } catch (err) {
    console.warn("[events] server filters failed, falling back to client filter:", (err as any)?.message ?? err);
    // 2) Fallback: refetch sans aucun filtre SQL
    const all = await fetchEventsServer({ sector: null, type: null, month: null, region: null }, false, isAdmin);

    // Appliquer filtres en mémoire
    const wantedSectorLabels = filters.sector ? sectorSlugToDbLabels(filters.sector) : null;
    let result = all
      .filter(ev => matchesType(ev, filters.type))
      .filter(ev => matchesRegion(ev, filters.region))
      .filter(ev => matchesMonth(ev, filters.month))
      .filter(ev => matchesSectorLabels(ev, wantedSectorLabels));

    // Filtre admin côté client si pas appliqué côté serveur
    if (!isAdmin) {
      result = result.filter((ev: any) => {
        const row = ev as any;
        return row.visible === true;
      });
    }

    // Filtre B2B côté client
    result = result.filter((ev: any) => {
      const row = ev as any;
      return row.is_b2b === true;
    });

    // Événements futurs si pas de mois spécifié
    if (!filters.month) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter(ev => (ev.start_date ?? "") >= today);
    }

    // Tri par date
    return result.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
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