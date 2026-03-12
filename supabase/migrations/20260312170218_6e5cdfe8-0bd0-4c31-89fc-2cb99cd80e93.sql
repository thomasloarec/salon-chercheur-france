ALTER TABLE blog_articles 
ADD COLUMN IF NOT EXISTS sector_slug text,
ADD COLUMN IF NOT EXISTS target_month text,
ADD COLUMN IF NOT EXISTS is_auto_generated boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS 
blog_articles_sector_month_unique 
ON blog_articles (sector_slug, target_month) 
WHERE sector_slug IS NOT NULL;