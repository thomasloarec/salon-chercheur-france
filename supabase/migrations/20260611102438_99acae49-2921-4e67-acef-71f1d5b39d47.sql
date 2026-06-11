CREATE OR REPLACE VIEW public.exhibitor_completion AS
WITH flags AS (
  SELECT ex.id AS exhibitor_id,
    (length(COALESCE(TRIM(BOTH FROM ex.description), ''::text)) >= 120) AS has_description,
    (COALESCE(TRIM(BOTH FROM ex.logo_url), ''::text) <> ''::text) AS has_logo,
    (COALESCE(TRIM(BOTH FROM ex.website), ''::text) <> ''::text) AS has_website,
    (COALESCE(TRIM(BOTH FROM ex.linkedin_url), ''::text) <> ''::text) AS has_linkedin,
    ((ex.governance_state IS NOT NULL) OR ((SELECT count(*) AS count
       FROM exhibitor_team_members tm
      WHERE ((tm.exhibitor_id = ex.id) AND (tm.status = 'active'::exhibitor_team_status) AND (tm.role = ANY (ARRAY['owner'::exhibitor_team_role, 'admin'::exhibitor_team_role])))) >= 2)) AS governance_confirmed,
    ((ex.owner_user_id IS NOT NULL) OR (EXISTS ( SELECT 1
       FROM exhibitor_team_members tm
      WHERE ((tm.exhibitor_id = ex.id) AND (tm.status = 'active'::exhibitor_team_status) AND (tm.role = ANY (ARRAY['owner'::exhibitor_team_role, 'admin'::exhibitor_team_role])))))) AS is_claimed,
    (EXISTS ( SELECT 1
       FROM (novelties n
         JOIN events e ON ((e.id = n.event_id)))
      WHERE ((n.exhibitor_id = ex.id) AND (n.status = 'published'::text) AND (n.is_test = false) AND (e.date_debut >= CURRENT_DATE)))) AS has_upcoming_novelty,
    ex.governance_state,
    (EXISTS ( SELECT 1
       FROM participation p
         JOIN events e ON ((e.id = p.id_event))
      WHERE ((p.exhibitor_id = ex.id) AND (COALESCE(e.date_fin, e.date_debut)::date >= CURRENT_DATE) AND (COALESCE(e.is_test, false) = false)))) AS has_upcoming_participation
   FROM exhibitors ex
), scored AS (
  SELECT f.exhibitor_id,
    f.has_description,
    f.has_logo,
    f.has_website,
    f.has_linkedin,
    f.governance_confirmed,
    f.is_claimed,
    f.has_upcoming_novelty,
    f.governance_state,
    f.has_upcoming_participation,
    ((((
        CASE WHEN f.has_description THEN 25 ELSE 0 END +
        CASE WHEN f.has_logo THEN 20 ELSE 0 END) +
        CASE WHEN f.has_website THEN 15 ELSE 0 END) +
        CASE WHEN f.has_linkedin THEN 15 ELSE 0 END) +
        CASE WHEN f.governance_confirmed THEN 25 ELSE 0 END) AS profile_score
   FROM flags f
)
SELECT exhibitor_id,
  has_description,
  has_logo,
  has_website,
  has_linkedin,
  governance_confirmed,
  is_claimed,
  has_upcoming_novelty,
  governance_state,
  profile_score,
  CASE
    WHEN ((profile_score >= 100) AND has_upcoming_novelty) THEN 'or'::text
    WHEN (profile_score >= 75) THEN 'argent'::text
    WHEN is_claimed THEN 'bronze'::text
    ELSE NULL::text
  END AS tier,
  has_upcoming_participation
 FROM scored s;

ALTER VIEW public.exhibitor_completion SET (security_invoker = true);