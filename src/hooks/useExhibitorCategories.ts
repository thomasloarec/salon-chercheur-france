import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Catégories d'activité d'un exposant — référentiel canonique
 * sectors (15) -> sub_sectors (73) -> exhibitor_sub_sectors.
 *
 * L'écriture passe EXCLUSIVEMENT par la RPC set_exhibitor_categories
 * (exhibitor_sub_sectors est en écriture admin only).
 */

export interface ExhibitorCategory {
  sub_sector_id: string;
  sub_sector_name: string;
  sub_sector_slug: string | null;
  sector_id: string | null;
  sector_name: string | null;
  is_primary: boolean;
  source: string | null;
  position: number | null;
}

export interface ExhibitorCategories {
  exhibitor_id: string;
  taxonomy_key: string | null;
  max_categories: number;
  locked_by_human: boolean;
  categories: ExhibitorCategory[];
}

function sortCategories(list: ExhibitorCategory[]): ExhibitorCategory[] {
  return [...list].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.position ?? 99) - (b.position ?? 99);
  });
}

/** Lecture des catégories d'un exposant (gestionnaire ou admin). */
export function useExhibitorCategories(exhibitorId: string | null | undefined) {
  return useQuery({
    queryKey: ['exhibitor-categories', exhibitorId],
    queryFn: async (): Promise<ExhibitorCategories> => {
      const { data, error } = await supabase.rpc('get_exhibitor_categories', {
        p_exhibitor_id: exhibitorId as string,
      });
      if (error) throw error;
      const raw = (data ?? {}) as unknown as ExhibitorCategories;
      return {
        ...raw,
        max_categories: raw.max_categories ?? 3,
        categories: sortCategories(raw.categories ?? []),
      };
    },
    enabled: !!exhibitorId,
    staleTime: 30_000,
  });
}

/** Message utilisateur en français à partir d'une erreur Postgres brute. */
export function translateCategoriesError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const msg = raw.toLowerCase();
  if (msg.includes('insufficient_privilege') || msg.includes('not authorized') || msg.includes('permission')) {
    return "Vous n'êtes pas autorisé à modifier les catégories de cette fiche.";
  }
  if (msg.includes('max') || msg.includes('maximum') || msg.includes('3')) {
    return 'Vous pouvez sélectionner 3 catégories au maximum.';
  }
  if (msg.includes('min') || msg.includes('empty') || msg.includes('at least')) {
    return 'Sélectionnez au moins une catégorie.';
  }
  if (msg.includes('unknown') || msg.includes('not found') || msg.includes('invalid')) {
    return "Une des catégories sélectionnées n'existe plus. Rechargez la page et réessayez.";
  }
  return "L'enregistrement a échoué. Veuillez réessayer.";
}

/** Remplacement atomique : le premier identifiant devient le principal. */
export function useSetExhibitorCategories(
  exhibitorId: string | null | undefined,
  publicSlug?: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subSectorIds: string[]): Promise<ExhibitorCategories> => {
      const { data, error } = await supabase.rpc('set_exhibitor_categories', {
        p_exhibitor_id: exhibitorId as string,
        p_sub_sector_ids: subSectorIds,
      });
      if (error) throw error;
      const raw = (data ?? {}) as unknown as ExhibitorCategories;
      return { ...raw, categories: sortCategories(raw.categories ?? []) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exhibitor-categories', exhibitorId] });
      queryClient.invalidateQueries({ queryKey: ['exhibitor-public-categories'] });
      if (publicSlug) {
        queryClient.invalidateQueries({ queryKey: ['public-exhibitor-profile', publicSlug] });
      }
    },
  });
}

export interface TaxonomySector {
  id: string;
  name: string;
  subSectors: { id: string; name: string; slug: string | null }[];
}

/** Référentiel complet (lecture publique) : 15 secteurs, 73 sous-secteurs. */
export function useTaxonomyTree() {
  return useQuery({
    queryKey: ['taxonomy-tree'],
    queryFn: async (): Promise<TaxonomySector[]> => {
      const [sectorsRes, subRes] = await Promise.all([
        supabase.from('sectors').select('id, name').order('name'),
        supabase.from('sub_sectors').select('id, name, slug, sector_id').order('name'),
      ]);
      if (sectorsRes.error) throw sectorsRes.error;
      if (subRes.error) throw subRes.error;

      const bySector = new Map<string, { id: string; name: string; slug: string | null }[]>();
      for (const s of subRes.data ?? []) {
        const key = (s as any).sector_id as string | null;
        if (!key) continue;
        const list = bySector.get(key) ?? [];
        list.push({ id: s.id as string, name: s.name as string, slug: (s as any).slug ?? null });
        bySector.set(key, list);
      }

      return (sectorsRes.data ?? []).map((sec) => ({
        id: sec.id as string,
        name: sec.name as string,
        subSectors: bySector.get(sec.id as string) ?? [],
      }));
    },
    staleTime: 600_000,
  });
}

export interface PublicExhibitorCategory {
  sub_sector_id: string;
  name: string;
  sector_name: string | null;
  is_primary: boolean;
  position: number | null;
}

/**
 * Catégories canoniques affichées sur la fiche publique.
 * Pont de clés : exhibitor_sub_sectors.exhibitor_id est une clé TEXTE legacy.
 * On la résout via la fonction SQL resolve_taxonomy_key, avec repli sur
 * l'identifiant legacy connu puis sur l'uuid converti en texte.
 */
export function usePublicExhibitorCategories(
  exhibitorId: string | null | undefined,
  legacyExposantId?: string | null,
) {
  return useQuery({
    queryKey: ['exhibitor-public-categories', exhibitorId, legacyExposantId],
    queryFn: async (): Promise<PublicExhibitorCategory[]> => {
      const keys = new Set<string>();
      if (legacyExposantId) keys.add(legacyExposantId);
      if (exhibitorId) {
        keys.add(exhibitorId);
        const { data: resolved } = await supabase.rpc('resolve_taxonomy_key', {
          p_exhibitor_id: exhibitorId,
        });
        if (typeof resolved === 'string' && resolved) keys.add(resolved);
      }
      if (keys.size === 0) return [];

      const { data, error } = await supabase
        .from('exhibitor_sub_sectors')
        .select('sub_sector_id, is_primary, position, sub_sectors(id, name, sector_id, sectors(name))')
        .in('exhibitor_id', Array.from(keys));
      if (error) throw error;

      const seen = new Set<string>();
      const rows: PublicExhibitorCategory[] = [];
      for (const r of (data ?? []) as any[]) {
        const sub = r.sub_sectors;
        if (!sub || seen.has(sub.id)) continue;
        seen.add(sub.id);
        rows.push({
          sub_sector_id: sub.id as string,
          name: sub.name as string,
          sector_name: sub.sectors?.name ?? null,
          is_primary: !!r.is_primary,
          position: r.position ?? null,
        });
      }
      rows.sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return (a.position ?? 99) - (b.position ?? 99);
      });
      return rows;
    },
    enabled: !!(exhibitorId || legacyExposantId),
    staleTime: 60_000,
  });
}
