-- Taxonomie exposants à 2 niveaux (non destructif)

CREATE TABLE IF NOT EXISTS public.sub_sectors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  sector_id   uuid NOT NULL REFERENCES public.sectors(id),
  slug        text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sub_sectors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_sectors TO authenticated;
GRANT ALL ON public.sub_sectors TO service_role;

CREATE INDEX IF NOT EXISTS idx_sub_sectors_sector ON public.sub_sectors(sector_id);

CREATE TABLE IF NOT EXISTS public.exhibitor_sub_sectors (
  exhibitor_id   text NOT NULL,
  sub_sector_id  uuid NOT NULL REFERENCES public.sub_sectors(id) ON DELETE CASCADE,
  confidence     numeric,
  is_primary     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exhibitor_id, sub_sector_id)
);

GRANT SELECT ON public.exhibitor_sub_sectors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exhibitor_sub_sectors TO authenticated;
GRANT ALL ON public.exhibitor_sub_sectors TO service_role;

CREATE INDEX IF NOT EXISTS idx_ess_sub_sector ON public.exhibitor_sub_sectors(sub_sector_id);
CREATE INDEX IF NOT EXISTS idx_ess_exhibitor  ON public.exhibitor_sub_sectors(exhibitor_id);

ALTER TABLE public.exhibitor_ai
  ADD COLUMN IF NOT EXISTS secteur_id uuid REFERENCES public.sectors(id);

CREATE INDEX IF NOT EXISTS idx_exhibitor_ai_secteur ON public.exhibitor_ai(secteur_id);

ALTER TABLE public.sub_sectors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitor_sub_sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read sub_sectors" ON public.sub_sectors;
CREATE POLICY "Public read sub_sectors" ON public.sub_sectors FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins manage sub_sectors" ON public.sub_sectors;
CREATE POLICY "Admins manage sub_sectors" ON public.sub_sectors FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Public read exhibitor_sub_sectors" ON public.exhibitor_sub_sectors;
CREATE POLICY "Public read exhibitor_sub_sectors" ON public.exhibitor_sub_sectors FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins manage exhibitor_sub_sectors" ON public.exhibitor_sub_sectors;
CREATE POLICY "Admins manage exhibitor_sub_sectors" ON public.exhibitor_sub_sectors FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());