
-- SEO Audit Dashboard Tables

CREATE TABLE IF NOT EXISTS seo_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  phase text DEFAULT 'starting',
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
);

ALTER TABLE seo_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seo_scans" ON seo_scans
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS seo_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text UNIQUE NOT NULL,
  label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  checked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seo_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seo_checklist" ON seo_checklist
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS seo_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  target_url text,
  current_position integer,
  previous_position integer,
  serp_features text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seo_keywords" ON seo_keywords
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS seo_quick_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'technical',
  impact text NOT NULL DEFAULT 'medium',
  effort text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seo_quick_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seo_quick_wins" ON seo_quick_wins
  FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

-- Pre-populate manual checklist
INSERT INTO seo_checklist (item_key, label) VALUES
  ('gsc_no_crawl_errors', 'Google Search Console : 0 erreurs d''exploration'),
  ('gsc_sitemap_submitted', 'Google Search Console : sitemap soumis et traité'),
  ('gsc_cwv_reviewed', 'Core Web Vitals examinés (28 derniers jours)'),
  ('gsc_no_manual_actions', 'Aucune action manuelle détectée dans GSC'),
  ('backlink_profile_reviewed', 'Profil de backlinks examiné (Ahrefs/Semrush)'),
  ('top5_ranking_pages', 'Top 5 pages classées pour mots-clés cibles identifiées'),
  ('top10_salon_query', 'Lotexpo en top 10 pour "salon [secteur] 2026"'),
  ('organizer_backlinks', '≥3 sites organisateurs avec lien retour vers Lotexpo'),
  ('google_business_profile', 'Google Business Profile créé et vérifié'),
  ('no_toxic_backlinks', 'Aucun backlink toxique dans l''outil Désaveu GSC');

-- Pre-populate starter keywords
INSERT INTO seo_keywords (keyword, target_url) VALUES
  ('salons professionnels 2026 France', '/'),
  ('liste salons professionnels', '/'),
  ('salon agroalimentaire 2026', '/'),
  ('salon industrie France 2026', '/'),
  ('salon professionnel Paris 2026', '/'),
  ('salon professionnel Lyon 2026', '/'),
  ('nouveautés salon professionnel', '/nouveautes'),
  ('prochains salons professionnels', '/');
