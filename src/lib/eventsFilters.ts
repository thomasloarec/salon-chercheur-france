// src/lib/eventsFilters.ts
import { supabase } from "@/integrations/supabase/client";

/**
 * Retourne les event_id qui appartiennent au sector_slug donné.
 * Essaie d'abord la table "event_sectors".
 * Si tout échoue, renvoie null (ce qui signifie "pas de filtrage serveur sur le secteur").
 * Si renvoie un [] vide, cela signifie "aucun résultat pour ce secteur".
 */
export async function getEventIdsForSector(sectorSlug: string): Promise<string[] | null> {
  // 1) Tentative via "event_sectors"
  try {
    const { data, error } = await supabase
      .from("event_sectors")
      .select("event_id, sectors!inner(name)")
      .ilike("sectors.name", `%${sectorSlug.replace('-', ' ')}%`);

    if (!error && Array.isArray(data)) {
      const ids = data.map((r: any) => r.event_id).filter(Boolean);
      return ids;
    }
  } catch (e) {
    console.warn("[filters] event_sectors not available:", (e as Error)?.message);
  }

  // 2) Impossible de filtrer côté serveur (schéma inconnu) → null (on n'applique pas de filtre secteur côté SQL)
  return null;
}