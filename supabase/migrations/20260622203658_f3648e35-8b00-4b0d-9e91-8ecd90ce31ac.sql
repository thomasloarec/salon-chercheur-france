ALTER TABLE public.blog_articles
ADD COLUMN IF NOT EXISTS article_type text NOT NULL DEFAULT 'salon';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_articles_article_type_check'
  ) THEN
    ALTER TABLE public.blog_articles
    ADD CONSTRAINT blog_articles_article_type_check
    CHECK (article_type IN ('salon', 'generic'));
  END IF;
END $$;