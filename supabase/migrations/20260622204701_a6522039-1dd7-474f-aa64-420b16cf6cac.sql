ALTER TABLE public.blog_articles
  DROP CONSTRAINT IF EXISTS blog_articles_status_check;

ALTER TABLE public.blog_articles
  ADD CONSTRAINT blog_articles_status_check
  CHECK (status IN ('draft', 'ready', 'scheduled', 'published'));