import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches up to 3 published blog articles matching a sector slug.
 */
export function useSectorArticles(sectors: string[] | null) {
  // Normalize sector names to potential slugs for matching
  const normalizeToSlug = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const sectorSlugs = sectors?.map(normalizeToSlug).filter(Boolean) ?? [];

  return useQuery({
    queryKey: ['sector-articles', sectorSlugs],
    enabled: sectorSlugs.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (sectorSlugs.length === 0) return [];

      // Try matching by sector_slug field
      const { data, error } = await supabase
        .from('blog_articles')
        .select('id, title, h1_title, slug, published_at, header_image_url, intro_text, sector_slug')
        .eq('status', 'published')
        .in('sector_slug', sectorSlugs)
        .order('published_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('[useSectorArticles] error:', error);
        return [];
      }

      return (data || []) as Array<{
        id: string;
        title: string;
        h1_title: string | null;
        slug: string;
        published_at: string | null;
        header_image_url: string | null;
        intro_text: string | null;
        sector_slug: string | null;
      }>;
    },
  });
}
