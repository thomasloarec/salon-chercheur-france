-- BLOC 1 — Champ de déclaration de gouvernance
ALTER TABLE public.exhibitors
  ADD COLUMN IF NOT EXISTS governance_state text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exhibitors_governance_state_check') THEN
    ALTER TABLE public.exhibitors
      ADD CONSTRAINT exhibitors_governance_state_check
      CHECK (governance_state IS NULL OR governance_state IN ('solo','team'));
  END IF;
END $$;

-- BLOC 3 — Vue exhibitor_completion
CREATE OR REPLACE VIEW public.exhibitor_completion AS
WITH flags AS (
  SELECT
    ex.id AS exhibitor_id,
    (length(coalesce(trim(ex.description), '')) >= 120) AS has_description,
    (coalesce(trim(ex.logo_url), '')  <> '')            AS has_logo,
    (coalesce(trim(ex.website), '')   <> '')            AS has_website,
    (coalesce(trim(ex.linkedin_url), '') <> '')         AS has_linkedin,
    (
      ex.governance_state IS NOT NULL
      OR (
        SELECT count(*) FROM exhibitor_team_members tm
        WHERE tm.exhibitor_id = ex.id
          AND tm.status = 'active'
          AND tm.role IN ('owner','admin')
      ) >= 2
    ) AS governance_confirmed,
    (
      ex.owner_user_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM exhibitor_team_members tm
        WHERE tm.exhibitor_id = ex.id
          AND tm.status = 'active'
          AND tm.role IN ('owner','admin')
      )
    ) AS is_claimed,
    EXISTS (
      SELECT 1 FROM novelties n
      JOIN events e ON e.id = n.event_id
      WHERE n.exhibitor_id = ex.id
        AND n.status = 'published'
        AND n.is_test = false
        AND e.date_debut::date >= CURRENT_DATE
    ) AS has_upcoming_novelty,
    ex.governance_state
  FROM exhibitors ex
),
scored AS (
  SELECT f.*,
    (
      (CASE WHEN f.has_description      THEN 25 ELSE 0 END) +
      (CASE WHEN f.has_logo             THEN 20 ELSE 0 END) +
      (CASE WHEN f.has_website          THEN 15 ELSE 0 END) +
      (CASE WHEN f.has_linkedin         THEN 15 ELSE 0 END) +
      (CASE WHEN f.governance_confirmed THEN 25 ELSE 0 END)
    ) AS profile_score
  FROM flags f
)
SELECT s.*,
  CASE
    WHEN s.profile_score >= 100 AND s.has_upcoming_novelty THEN 'or'
    WHEN s.profile_score >= 75                              THEN 'argent'
    WHEN s.is_claimed                                       THEN 'bronze'
    ELSE NULL
  END AS tier
FROM scored s;

ALTER VIEW public.exhibitor_completion SET (security_invoker = true);

-- Index de support
CREATE INDEX IF NOT EXISTS idx_team_members_exhibitor_active
  ON public.exhibitor_team_members(exhibitor_id, status, role);
CREATE INDEX IF NOT EXISTS idx_novelties_exhibitor_status
  ON public.novelties(exhibitor_id, status);