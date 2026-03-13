
DROP POLICY IF EXISTS "Public read published articles" ON blog_articles;
CREATE POLICY "Public read published articles"
  ON blog_articles FOR SELECT
  TO public
  USING ((status IN ('published', 'ready', 'scheduled')) OR is_admin());
