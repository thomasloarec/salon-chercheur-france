-- Refonte page Nouveautés, lot B2b (28/09/2026)
-- Nouveauté mise en avant en tête de /nouveautes, choisie par l'admin sur une période.
-- Table dédiée : aucune écriture dans novelties (updated_at intact), historique conservé.

CREATE TABLE IF NOT EXISTS public.novelty_spotlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novelty_id uuid NOT NULL REFERENCES public.novelties(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT novelty_spotlights_dates_check CHECK (ends_on >= starts_on)
);

COMMENT ON TABLE public.novelty_spotlights IS
  'Mise en avant d''une nouveauté en tête de /nouveautes du starts_on au ends_on inclus. Choix éditorial admin, jamais lié au premium (règle F2).';

CREATE INDEX IF NOT EXISTS novelty_spotlights_period_idx
  ON public.novelty_spotlights (ends_on, starts_on);
CREATE INDEX IF NOT EXISTS novelty_spotlights_novelty_idx
  ON public.novelty_spotlights (novelty_id);

ALTER TABLE public.novelty_spotlights ENABLE ROW LEVEL SECURITY;

-- Lecture publique, uniquement pour une nouveauté publiée hors test
DROP POLICY IF EXISTS "Public read spotlights of published novelties" ON public.novelty_spotlights;
CREATE POLICY "Public read spotlights of published novelties"
  ON public.novelty_spotlights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.novelties n
      WHERE n.id = novelty_spotlights.novelty_id
        AND n.status = 'published'
        AND COALESCE(n.is_test, false) = false
    )
    OR public.is_admin()
  );

-- Écriture réservée aux administrateurs
DROP POLICY IF EXISTS "Admins manage spotlights" ON public.novelty_spotlights;
CREATE POLICY "Admins manage spotlights"
  ON public.novelty_spotlights FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.novelty_spotlights TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.novelty_spotlights TO authenticated;

NOTIFY pgrst, 'reload schema';

-- RETOUR ARRIÈRE : DROP TABLE IF EXISTS public.novelty_spotlights;
