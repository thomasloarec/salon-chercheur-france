import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Public, read-only novelty shape — mirrors EXACTLY the safe columns of the
 * `public_novelties` view (status='published' AND is_test=false filtered at the
 * DB level). No internal column (status, created_by, pending_exhibitor_id,
 * demo_slots, is_test) is ever exposed here.
 */
export interface PublicNovelty {
  id: string;
  slug: string;
  event_id: string;
  exhibitor_id: string;
  title: string;
  type: string;
  reason_1: string | null;
  reason_2: string | null;
  reason_3: string | null;
  audience_tags: string[] | null;
  media_urls: string[] | null;
  doc_url: string | null;
  resource_url: string | null;
  availability: string | null;
  stand_info: string | null;
  summary: string | null;
  details: string | null;
  images_count: number | null;
  is_premium: boolean | null;
  created_at: string;
  updated_at: string;
  // exhibitor public identity (maillage)
  exhibitor_public_slug: string | null;
  exhibitor_display_name: string | null;
  exhibitor_logo_url: string | null;
  // event (maillage)
  event_slug: string | null;
  event_name: string | null;
  event_date_debut: string | null;
  event_date_fin: string | null;
  event_ville: string | null;
  // indexability flag (READ from the view, never recomputed client-side)
  seo_indexable: boolean;
}

const SELECT =
  'id,slug,event_id,exhibitor_id,title,type,reason_1,reason_2,reason_3,audience_tags,media_urls,doc_url,resource_url,availability,stand_info,summary,details,images_count,is_premium,created_at,updated_at,exhibitor_public_slug,exhibitor_display_name,exhibitor_logo_url,event_slug,event_name,event_date_debut,event_date_fin,event_ville,seo_indexable';

/** Single public novelty by stable slug. Returns null when not found. */
export function useNoveltyPublic(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-novelty', slug],
    enabled: !!slug,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicNovelty | null> => {
      const { data, error } = await supabase
        .from('public_novelties')
        .select(SELECT)
        .eq('slug', slug as string)
        .maybeSingle();
      if (error) {
        console.error('useNoveltyPublic error:', error);
        throw error;
      }
      return (data as unknown as PublicNovelty) ?? null;
    },
  });
}

export interface NoveltyAround {
  sameEvent: PublicNovelty[];
  sameExhibitor: PublicNovelty[];
}

/**
 * "Autour" — other public novelties from the same event and from the same
 * exhibitor (current one excluded). Used to build the crawlable internal graph.
 */
export function useNoveltyAround(novelty: PublicNovelty | null | undefined) {
  const eventId = novelty?.event_id;
  const exhibitorId = novelty?.exhibitor_id;
  const currentId = novelty?.id;
  return useQuery({
    queryKey: ['public-novelty-around', currentId],
    enabled: !!novelty,
    staleTime: 60_000,
    queryFn: async (): Promise<NoveltyAround> => {
      const [sameEventRes, sameExhibitorRes] = await Promise.all([
        supabase
          .from('public_novelties')
          .select(SELECT)
          .eq('event_id', eventId as string)
          .neq('id', currentId as string)
          .limit(12),
        supabase
          .from('public_novelties')
          .select(SELECT)
          .eq('exhibitor_id', exhibitorId as string)
          .neq('id', currentId as string)
          .limit(12),
      ]);
      const sameEvent = ((sameEventRes.data as unknown as PublicNovelty[]) ?? []);
      const eventIds = new Set(sameEvent.map((n) => n.id));
      // De-dup: an exhibitor novelty already shown under "same event" is dropped.
      const sameExhibitor = ((sameExhibitorRes.data as unknown as PublicNovelty[]) ?? []).filter(
        (n) => !eventIds.has(n.id),
      );
      return { sameEvent, sameExhibitor };
    },
  });
}

export const NOVELTY_TYPE_LABELS: Record<string, string> = {
  Launch: 'Lancement produit',
  Update: 'Mise à jour',
  Demo: 'Démonstration',
  Special_Offer: 'Offre spéciale',
  Partnership: 'Partenariat',
  Innovation: 'Innovation',
};