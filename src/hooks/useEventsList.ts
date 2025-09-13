import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UrlFilters } from "@/lib/useUrlFilters";
import { useAuth } from '@/contexts/AuthContext';
import { getEventIdsForSector } from "@/lib/eventsFilters";

export type EventRow = {
  id: string;
  id_event: string;
  nom_event: string;
  slug: string | null;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  secteur: any;
  url_image: string | null;
  nom_lieu: string | null;
  rue: string | null;
  code_postal: string | null;
  url_site_officiel: string | null;
  type_event: string | null;
  is_b2b: boolean;
  visible: boolean;
};

async function fetchEvents(filters: UrlFilters, isAdmin: boolean): Promise<EventRow[]> {
  const { sector, type, month, region } = filters;

  // 0) Résolution des IDs par secteur si demandé
  let sectorEventIds: string[] | null = null;
  if (sector) {
    sectorEventIds = await getEventIdsForSector(sector);
    if (Array.isArray(sectorEventIds) && sectorEventIds.length === 0) {
      return []; // secteur connu mais pas d'event -> aucun résultat
    }
  }

  // 1) Requête de base (sélection minimale, colonnes garanties)
  let query = supabase
    .from("events")
    .select(`
      id, id_event, nom_event, slug, date_debut, date_fin, ville, secteur,
      url_image, nom_lieu, rue, code_postal, url_site_officiel,
      type_event, is_b2b, visible
    `);

  // Filtre visibilité pour les non-admins
  if (!isAdmin) {
    query = query.eq('visible', true);
  }

  // B2B uniquement
  query = query.eq('is_b2b', true);

  // Événements à partir d'aujourd'hui (sauf si mois spécifié)
  if (!month) {
    query = query.gte('date_debut', new Date().toISOString().slice(0, 10));
  }

  // 2) Appliquer les filtres simples
  if (type) {
    query = query.eq("type_event", type);
  }

  // Mois "01".."12" : filtre sur le mois de date_debut
  if (month) {
    const year = new Date().getFullYear();
    const monthNum = parseInt(month);
    const startDate = new Date(year, monthNum - 1, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, monthNum, 0).toISOString().slice(0, 10);
    
    query = query
      .gte('date_debut', startDate)
      .lte('date_debut', endDate);
  }

  // Région via code_postal (2 premiers chiffres = département)
  if (region) {
    // Récupérer les départements de cette région
    const { data: departments } = await supabase
      .from('departements')
      .select('code')
      .eq('region_code', region);
    
    if (departments && departments.length > 0) {
      const deptCodes = departments.map(d => d.code);
      const orConditions = deptCodes
        .map(code => `code_postal.like.${code}*`)
        .join(',');
      query = query.or(orConditions);
    }
  }

  // 3) Appliquer le filtre secteur si on a des IDs résolus
  if (Array.isArray(sectorEventIds)) {
    // On a une liste (pot. grande) d'IDs pour ce secteur
    if (sectorEventIds.length > 0) {
      query = query.in("id", sectorEventIds);
    } else {
      return [];
    }
  } // sinon (null) => impossible de filtrer côté SQL, on ne filtre pas (fallback)

  query = query.order("date_debut", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.warn("[events] query error:", error.message);
    return [];
  }

  return (data ?? []) as EventRow[];
}

export function useEventsList(filters: UrlFilters) {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@lotexpo.com';

  return useQuery({
    queryKey: ["events:list", filters, isAdmin], // ← clé sensible aux filtres
    queryFn: () => fetchEvents(filters, isAdmin),
    staleTime: 60_000,
  });
}