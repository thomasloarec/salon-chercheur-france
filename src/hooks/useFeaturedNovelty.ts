import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NoveltyWatchRow } from "@/hooks/useNoveltiesWatch";

/**
 * Refonte de la page Nouveautés, run F1.4 : choix de la nouveauté « À la une ».
 *
 * Règles (plan technique, section 4) :
 * 1. Mise en avant active aujourd'hui (table novelty_spotlights, choisie dans l'admin),
 *    dont la nouveauté est publiée et le salon pas terminé (= présente dans les lignes
 *    de la page). S'il y en a plusieurs : celle dont le salon correspond au secteur
 *    choisi par le visiteur, sinon la plus récemment programmée.
 * 2. Sinon, repli automatique : nouveautés avec une image et sans « composition texte »
 *    imposée, salon le plus proche d'abord, et à date égale une nouveauté publiée par
 *    l'exposant avant une nouveauté préparée par Lotexpo.
 * 3. Le statut premium n'intervient jamais (règle F2).
 */

export interface ActiveSpotlight {
  novelty_id: string;
  starts_on: string;
  ends_on: string;
  created_at: string;
}

/** Date locale AAAA-MM-JJ (jamais toISOString, qui passe en UTC). */
function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Mises en avant actives aujourd'hui. Clé ['novelty-spotlight', …] : invalidée par l'admin. */
export function useActiveSpotlights(enabled = true) {
  const today = localDay(new Date());
  return useQuery({
    queryKey: ["novelty-spotlight", today],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("novelty_spotlights")
        .select("novelty_id, starts_on, ends_on, created_at")
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActiveSpotlight[];
    },
  });
}

function eventSectorLabels(secteur: unknown): string[] {
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

function hasPhoto(n: NoveltyWatchRow): boolean {
  return !!(n.media_urls?.[0] ?? "").trim() && n.display_mode !== "typographic";
}

export interface FeaturedPick {
  novelty: NoveltyWatchRow;
  source: "spotlight" | "auto";
}

export function pickFeaturedNovelty(
  rows: NoveltyWatchRow[],
  spotlights: ActiveSpotlight[],
  sectorLabel: string | null,
): FeaturedPick | null {
  const byId = new Map(rows.filter((r) => r.timing !== "past").map((r) => [r.id, r]));

  // 1. Choix de l'admin (spotlights déjà triés du plus récent au plus ancien)
  const active = spotlights
    .map((s) => byId.get(s.novelty_id))
    .filter((n): n is NoveltyWatchRow => !!n);
  if (active.length > 0) {
    if (sectorLabel) {
      const target = sectorLabel.toLowerCase();
      const inSector = active.find((n) =>
        eventSectorLabels(n.events?.secteur).some((l) => l.toLowerCase() === target),
      );
      if (inSector) return { novelty: inSector, source: "spotlight" };
    }
    return { novelty: active[0], source: "spotlight" };
  }

  // 2. Repli automatique
  const candidates = Array.from(byId.values()).filter(hasPhoto);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const da = a.events?.date_debut ?? "9999-12-31";
    const db = b.events?.date_debut ?? "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    const oa = a.origin === "exhibitor" ? 0 : 1;
    const ob = b.origin === "exhibitor" ? 0 : 1;
    return oa - ob;
  });
  return { novelty: candidates[0], source: "auto" };
}
