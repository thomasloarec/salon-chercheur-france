-- Phase 2B (V2): Unified public read view for exhibitor profiles.
-- Source of truth = exhibitor_public_identities (active rows only).
--
-- SECURITY MODEL (V2 decision):
--   We DO NOT use security_invoker = true.
--   Reason: public.exhibitors is NOT directly readable by `anon` or `authenticated`
--   (only service_role holds SELECT). With security_invoker = true a public
--   SELECT on this view would raise "permission denied for table exhibitors".
--   Granting anon SELECT on exhibitors is unacceptable (it would expose
--   contact_email, campaign/outreach columns, etc.).
--   Therefore this view runs with definer semantics (the default), exposing ONLY
--   curated, non-sensitive columns. This also guarantees IDENTICAL results for
--   anon / authenticated / admin / service_role (stable public data layer).
--   The Supabase linter "Security Definer View" notice is intentional here.
--
-- No route, sitemap, novelties, claim, imports or event pages are touched.

DROP VIEW IF EXISTS public.public_exhibitor_profiles;

CREATE VIEW public.public_exhibitor_profiles AS
WITH base AS (
  SELECT
    -- Public identity
    epi.id            AS public_identity_id,
    epi.public_slug,
    epi.source_type,
    epi.is_active,
    epi.legacy_exposant_id,
    epi.exhibitor_id,
    epi.canonical_name,
    epi.created_at,
    epi.updated_at,

    -- Displayable data (modern first, then legacy, then identity, then terminal fallback)
    COALESCE(
      NULLIF(BTRIM(ex.name), ''),
      NULLIF(BTRIM(le.nom_exposant), ''),
      NULLIF(BTRIM(epi.canonical_name), ''),
      'Exposant #' || epi.public_slug
    ) AS display_name,
    COALESCE(NULLIF(BTRIM(ex.website), ''), NULLIF(BTRIM(le.website_exposant), '')) AS website,
    NULLIF(BTRIM(ex.logo_url), '') AS logo_url,
    COALESCE(
      NULLIF(BTRIM(ex.description), ''),
      NULLIF(BTRIM(le.exposant_description), ''),
      NULLIF(BTRIM(ai.resume_court), '')
    ) AS description,
    NULLIF(BTRIM(ai.resume_court), '') AS ai_summary,
    NULL::text AS linkedin_url,  -- exhibitors.linkedin_url does not exist yet (see Phase 2C)

    -- Flags (is_claimed exposed ONLY as boolean; owner_user_id / team members never exposed)
    (ex.owner_user_id IS NOT NULL OR COALESCE(tm.active_team_count, 0) > 0) AS is_claimed,
    (COALESCE(ex.approved, false) = true OR ex.verified_at IS NOT NULL) AS is_verified,
    (
      COALESCE(ex.is_test, false)
      OR COALESCE(epi.canonical_name, '') ILIKE '\_\_%'
      OR COALESCE(ex.name, '') ILIKE '\_\_%'
      OR COALESCE(le.nom_exposant, '') ILIKE '\_\_%'
      OR epi.public_slug LIKE 't2abis-%'
    ) AS is_test,

    -- Participation counters (deduplicated via COUNT(DISTINCT id_participation))
    COALESCE(part.total_participations, 0)        AS total_participations,
    COALESCE(part.future_participations_count, 0) AS future_participations_count,
    COALESCE(part.past_participations_count, 0)   AS past_participations_count,
    part.next_event_at,
    part.last_past_event_at,

    -- Novelties (modern world only)
    COALESCE(nov.published_novelties_count, 0) AS published_novelties_count,
    nov.last_novelty_at,

    -- Activity helper (raw; clamped to non-future in outer query)
    ex.updated_at AS exhibitor_updated_at
  FROM public.exhibitor_public_identities epi
  LEFT JOIN public.exhibitors ex ON ex.id = epi.exhibitor_id
  LEFT JOIN public.exposants le ON le.id_exposant = epi.legacy_exposant_id
  LEFT JOIN LATERAL (
    SELECT ai0.resume_court
    FROM public.exhibitor_ai ai0
    WHERE (epi.exhibitor_id IS NOT NULL AND ai0.exhibitor_id = epi.exhibitor_id::text)
       OR (epi.legacy_exposant_id IS NOT NULL AND ai0.exhibitor_id = epi.legacy_exposant_id)
    LIMIT 1
  ) ai ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS active_team_count
    FROM public.exhibitor_team_members t
    WHERE epi.exhibitor_id IS NOT NULL
      AND t.exhibitor_id = epi.exhibitor_id
      AND t.status = 'active'
  ) tm ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT p.id_participation) AS total_participations,
      COUNT(DISTINCT p.id_participation) FILTER (
        WHERE COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE
      ) AS future_participations_count,
      COUNT(DISTINCT p.id_participation) FILTER (
        WHERE COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE
      ) AS past_participations_count,
      MIN(e.date_debut) FILTER (
        WHERE COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE
      ) AS next_event_at,
      MAX(COALESCE(e.date_fin, e.date_debut)) FILTER (
        WHERE COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE
      ) AS last_past_event_at
    FROM public.participation p
    JOIN public.events e ON e.id = p.id_event
    WHERE e.visible = true
      AND e.is_test = false
      AND (
        (epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = epi.legacy_exposant_id)
        OR (epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = epi.exhibitor_id)
      )
  ) part ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS published_novelties_count,
      MAX(n.updated_at) AS last_novelty_at
    FROM public.novelties n
    WHERE epi.exhibitor_id IS NOT NULL
      AND n.exhibitor_id = epi.exhibitor_id
      AND n.status = 'published'
      AND COALESCE(n.is_test, false) = false
  ) nov ON true
  WHERE epi.is_active = true
)
SELECT
  public_identity_id,
  public_slug,
  source_type,
  is_active,
  legacy_exposant_id,
  exhibitor_id,
  display_name,
  canonical_name,
  website,
  logo_url,
  description,
  ai_summary,
  linkedin_url,
  is_claimed,
  is_verified,
  is_test,
  total_participations,
  future_participations_count,
  past_participations_count,
  published_novelties_count,
  (future_participations_count > 0) AS has_future_events,
  (published_novelties_count > 0)   AS has_published_novelties,
  (website IS NOT NULL)             AS has_website,
  (description IS NOT NULL)         AS has_description,
  (logo_url IS NOT NULL)            AS has_logo,
  -- SEO indexability (preparatory only; sitemap NOT touched in 2B)
  CASE
    WHEN is_claimed THEN true
    WHEN published_novelties_count >= 1 THEN true
    WHEN future_participations_count >= 2 THEN true
    WHEN future_participations_count >= 1 AND description IS NOT NULL AND website IS NOT NULL THEN true
    WHEN exhibitor_id IS NOT NULL AND length(COALESCE(description, '')) >= 120 THEN true
    ELSE false
  END AS seo_indexable,
  CASE
    WHEN is_claimed THEN 'claimed'
    WHEN published_novelties_count >= 1 THEN 'published_novelty'
    WHEN future_participations_count >= 2 THEN 'multiple_future_events'
    WHEN future_participations_count >= 1 AND description IS NOT NULL AND website IS NOT NULL THEN 'future_event_with_content'
    WHEN exhibitor_id IS NOT NULL AND length(COALESCE(description, '')) >= 120 THEN 'enriched_profile'
    ELSE 'thin_content'
  END AS seo_reason,
  -- last_activity_at: only past/current dates (clamped to now())
  LEAST(
    COALESCE(
      last_novelty_at,
      last_past_event_at::timestamptz,
      exhibitor_updated_at,
      updated_at,
      created_at
    ),
    now()
  ) AS last_activity_at,
  -- next_event_at: earliest start date among upcoming/ongoing visible non-test events.
  -- SEMANTICS: an ongoing event (date_fin >= today but date_debut already passed) is
  -- still considered "current/next", so next_event_at MAY hold a past date_debut.
  next_event_at,
  created_at,
  updated_at
FROM base;

COMMENT ON VIEW public.public_exhibitor_profiles IS
'Phase 2B public read layer for exhibitor profiles. Definer view (NOT security_invoker): exhibitors is not anon-readable, so definer semantics give stable, identical results for all roles and expose only curated non-sensitive columns. is_claimed is a boolean only (owner_user_id / team members never exposed). next_event_at includes ongoing events (may be a past date_debut). last_activity_at is never in the future. linkedin_url is NULL::text (exhibitors.linkedin_url to be added in Phase 2C).';

GRANT SELECT ON public.public_exhibitor_profiles TO anon;
GRANT SELECT ON public.public_exhibitor_profiles TO authenticated;
GRANT SELECT ON public.public_exhibitor_profiles TO service_role;