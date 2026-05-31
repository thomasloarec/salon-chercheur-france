import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 4B — Batch resolution of public exhibitor slugs.
 *
 * Goal: attach the public `/exposants/:slug` identity to a list of exhibitors
 * WITHOUT introducing an N+1 pattern. We never query per-exhibitor; instead we
 * issue at most ONE batched query against `public_exhibitor_profiles`
 * (which already exposes both the modern `exhibitor_id` and the
 * `legacy_exposant_id`, plus `public_slug`, `seo_indexable` and `is_test`).
 */

export interface PublicSlugInfo {
  public_slug: string;
  seo_indexable: boolean;
  is_test: boolean;
}

export interface PublicSlugMaps {
  byExhibitorId: Map<string, PublicSlugInfo>;
  byLegacyId: Map<string, PublicSlugInfo>;
}

const emptyMaps = (): PublicSlugMaps => ({
  byExhibitorId: new Map(),
  byLegacyId: new Map(),
});

/**
 * Fetch public slugs in a single batched query.
 * @param exhibitorIds modern exhibitor UUIDs
 * @param legacyIds legacy id_exposant values (e.g. "Exposant_123")
 */
export async function fetchExhibitorPublicSlugs(
  exhibitorIds: (string | null | undefined)[],
  legacyIds: (string | null | undefined)[],
): Promise<PublicSlugMaps> {
  const uuids = Array.from(
    new Set((exhibitorIds || []).filter((v): v is string => !!v)),
  );
  const legacy = Array.from(
    new Set((legacyIds || []).filter((v): v is string => !!v)),
  );

  if (uuids.length === 0 && legacy.length === 0) {
    return emptyMaps();
  }

  // Build a single OR filter so the whole page is covered in ONE request.
  const orParts: string[] = [];
  if (uuids.length > 0) {
    orParts.push(`exhibitor_id.in.(${uuids.join(',')})`);
  }
  if (legacy.length > 0) {
    // legacy_exposant_id is text — quote each value for the in() filter.
    const quoted = legacy.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
    orParts.push(`legacy_exposant_id.in.(${quoted})`);
  }

  const maps = emptyMaps();

  try {
    const { data, error } = await supabase
      .from('public_exhibitor_profiles')
      .select('public_slug, seo_indexable, is_test, exhibitor_id, legacy_exposant_id')
      .or(orParts.join(','));

    if (error || !data) return maps;

    for (const row of data) {
      const info: PublicSlugInfo = {
        public_slug: row.public_slug as string,
        seo_indexable: !!row.seo_indexable,
        is_test: !!row.is_test,
      };
      if (row.exhibitor_id) maps.byExhibitorId.set(row.exhibitor_id as string, info);
      if (row.legacy_exposant_id) maps.byLegacyId.set(row.legacy_exposant_id as string, info);
    }
  } catch {
    /* never break the UI for a slug lookup */
  }

  return maps;
}

/**
 * Resolve a single exhibitor's public slug info from prefetched maps.
 * Modern exhibitor_id takes priority, then legacy id_exposant.
 */
export function resolvePublicSlug(
  maps: PublicSlugMaps | null | undefined,
  keys: { exhibitorId?: string | null; legacyId?: string | null },
): PublicSlugInfo | undefined {
  if (!maps) return undefined;
  if (keys.exhibitorId) {
    const hit = maps.byExhibitorId.get(keys.exhibitorId);
    if (hit) return hit;
  }
  if (keys.legacyId) {
    const hit = maps.byLegacyId.get(keys.legacyId);
    if (hit) return hit;
  }
  return undefined;
}