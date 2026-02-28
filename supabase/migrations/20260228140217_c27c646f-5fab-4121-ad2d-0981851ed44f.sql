
-- Create blog_articles table
CREATE TABLE public.blog_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  h1_title text,
  slug text UNIQUE NOT NULL,
  meta_title text,
  meta_description text,
  intro_text text,
  body_text text,
  header_image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published')),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  event_ids uuid[] DEFAULT '{}',
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;

-- Public can read published articles
CREATE POLICY "Public read published articles" ON public.blog_articles
  FOR SELECT USING (status = 'published' OR is_admin());

-- Admins can manage all articles
CREATE POLICY "Admins can manage blog articles" ON public.blog_articles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Service role can manage articles
CREATE POLICY "Service role manages blog articles" ON public.blog_articles
  FOR ALL USING (auth.role() = 'service_role'::text);

-- Index on slug for fast lookups
CREATE INDEX idx_blog_articles_slug ON public.blog_articles(slug);

-- Index on status for filtering
CREATE INDEX idx_blog_articles_status ON public.blog_articles(status);

-- Trigger for updated_at
CREATE TRIGGER update_blog_articles_updated_at
  BEFORE UPDATE ON public.blog_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
