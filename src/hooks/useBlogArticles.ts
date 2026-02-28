
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BlogArticle {
  id: string;
  title: string;
  h1_title: string | null;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  intro_text: string | null;
  body_text: string | null;
  header_image_url: string | null;
  status: 'draft' | 'ready' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  event_ids: string[];
  created_by: string | null;
}

export function useBlogArticles(statusFilter?: string) {
  return useQuery({
    queryKey: ['blog-articles', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('blog_articles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BlogArticle[];
    },
  });
}

export function useBlogArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['blog-article', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as BlogArticle;
    },
  });
}

export function useBlogArticleBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['blog-article-slug', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*')
        .eq('slug', slug!)
        .single();
      if (error) throw error;
      return data as BlogArticle;
    },
  });
}

export function usePublishedArticles() {
  return useQuery({
    queryKey: ['blog-articles-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data as BlogArticle[];
    },
  });
}

export function useSaveBlogArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (article: Partial<BlogArticle> & { id?: string }) => {
      if (article.id) {
        const { id, created_at, ...updates } = article;
        const { data, error } = await supabase
          .from('blog_articles')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as BlogArticle;
      } else {
        const { id, ...insert } = article;
        const { data, error } = await supabase
          .from('blog_articles')
          .insert(insert)
          .select()
          .single();
        if (error) throw error;
        return data as BlogArticle;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-articles'] });
      queryClient.invalidateQueries({ queryKey: ['blog-article'] });
    },
  });
}

export function useDeleteBlogArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_articles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-articles'] });
    },
  });
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
