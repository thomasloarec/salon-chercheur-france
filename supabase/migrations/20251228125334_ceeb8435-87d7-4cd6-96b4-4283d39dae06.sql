-- Ajouter le champ is_test sur les tables principales
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.novelties ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.exhibitors ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Index pour optimiser les requêtes de filtrage
CREATE INDEX IF NOT EXISTS idx_events_is_test ON public.events(is_test) WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_novelties_is_test ON public.novelties(is_test) WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_exhibitors_is_test ON public.exhibitors(is_test) WHERE is_test = false;

-- Mettre à jour la policy RLS pour events : les visiteurs ne voient que les contenus non-test
DROP POLICY IF EXISTS "Events are publicly readable" ON public.events;
CREATE POLICY "Events are publicly readable" ON public.events
FOR SELECT USING (
  (visible = true AND is_test = false) OR is_admin()
);

-- Mettre à jour la policy RLS pour novelties
DROP POLICY IF EXISTS "Public read access to published novelties" ON public.novelties;
CREATE POLICY "Public read access to published novelties" ON public.novelties
FOR SELECT USING (
  (status = 'published' AND is_test = false) 
  OR is_admin() 
  OR (EXISTS (SELECT 1 FROM exhibitors e WHERE e.id = novelties.exhibitor_id AND e.owner_user_id = auth.uid()))
);

-- Mettre à jour la policy RLS pour exhibitors
DROP POLICY IF EXISTS "Public read access to exhibitors" ON public.exhibitors;
CREATE POLICY "Public read access to exhibitors" ON public.exhibitors
FOR SELECT USING (
  (is_test = false AND (approved = true OR approved IS NULL)) OR is_admin()
);