CREATE OR REPLACE FUNCTION public.preview_exhibitor_identity_merge(
  p_winner_identity_id uuid,
  p_loser_identity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  w public_exhibitor_profiles%ROWTYPE;
  l public_exhibitor_profiles%ROWTYPE;
  w_part_total integer := 0;
  l_part_total integer := 0;
  common_events integer := 0;
  potential_dup_parts integer := 0;
  w_nov_total integer := 0;
  l_nov_total integer := 0;
  w_nov_pub integer := 0;
  l_nov_pub integer := 0;
  w_owners uuid[] := '{}';
  l_owners uuid[] := '{}';
  w_has_owner boolean := false;
  l_has_owner boolean := false;
  claim_signal text;
  w_analytics integer := 0;
  l_analytics integer := 0;
  dup_risk text;
  w_score numeric := 0;
  l_score numeric := 0;
  rec_winner uuid;
  rec_reasons text[] := '{}';
  rec_target public_exhibitor_profiles%ROWTYPE;
  rec_other public_exhibitor_profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_winner_identity_id = p_loser_identity_id THEN
    RAISE EXCEPTION 'Winner and loser must be different identities';
  END IF;

  SELECT * INTO w FROM public_exhibitor_profiles WHERE public_identity_id = p_winner_identity_id;
  SELECT * INTO l FROM public_exhibitor_profiles WHERE public_identity_id = p_loser_identity_id;

  IF w.public_identity_id IS NULL THEN
    RAISE EXCEPTION 'Winner identity not found or inactive';
  END IF;
  IF l.public_identity_id IS NULL THEN
    RAISE EXCEPTION 'Loser identity not found or inactive';
  END IF;

  -- Participation impact (all linked rows, regardless of event visibility,
  -- because a real merge would repoint every participation row).
  WITH wp AS (
    SELECT DISTINCT p.id_participation, p.id_event
    FROM participation p
    WHERE (w.legacy_exposant_id IS NOT NULL AND p.id_exposant = w.legacy_exposant_id)
       OR (w.exhibitor_id IS NOT NULL AND p.exhibitor_id = w.exhibitor_id)
  ),
  lp AS (
    SELECT DISTINCT p.id_participation, p.id_event
    FROM participation p
    WHERE (l.legacy_exposant_id IS NOT NULL AND p.id_exposant = l.legacy_exposant_id)
       OR (l.exhibitor_id IS NOT NULL AND p.exhibitor_id = l.exhibitor_id)
  )
  SELECT
    (SELECT count(*) FROM wp),
    (SELECT count(*) FROM lp),
    (SELECT count(*) FROM (SELECT DISTINCT id_event FROM wp INTERSECT SELECT DISTINCT id_event FROM lp) x),
    (SELECT count(*) FROM lp WHERE lp.id_event IN (SELECT id_event FROM wp))
  INTO w_part_total, l_part_total, common_events, potential_dup_parts;

  -- Novelties impact (linked through modern exhibitor_id only)
  IF w.exhibitor_id IS NOT NULL THEN
    SELECT count(*), count(*) FILTER (WHERE status = 'published')
    INTO w_nov_total, w_nov_pub
    FROM novelties WHERE exhibitor_id = w.exhibitor_id AND COALESCE(is_test, false) = false;
  END IF;
  IF l.exhibitor_id IS NOT NULL THEN
    SELECT count(*), count(*) FILTER (WHERE status = 'published')
    INTO l_nov_total, l_nov_pub
    FROM novelties WHERE exhibitor_id = l.exhibitor_id AND COALESCE(is_test, false) = false;
  END IF;

  -- Owner sets (owner_user_id + active team members) — never exposed, only compared
  IF w.exhibitor_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT uid) INTO w_owners FROM (
      SELECT owner_user_id AS uid FROM exhibitors WHERE id = w.exhibitor_id AND owner_user_id IS NOT NULL
      UNION
      SELECT user_id FROM exhibitor_team_members WHERE exhibitor_id = w.exhibitor_id AND status = 'active'
    ) s WHERE uid IS NOT NULL;
  END IF;
  IF l.exhibitor_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT uid) INTO l_owners FROM (
      SELECT owner_user_id AS uid FROM exhibitors WHERE id = l.exhibitor_id AND owner_user_id IS NOT NULL
      UNION
      SELECT user_id FROM exhibitor_team_members WHERE exhibitor_id = l.exhibitor_id AND status = 'active'
    ) s WHERE uid IS NOT NULL;
  END IF;
  w_owners := COALESCE(w_owners, '{}');
  l_owners := COALESCE(l_owners, '{}');
  w_has_owner := array_length(w_owners, 1) IS NOT NULL;
  l_has_owner := array_length(l_owners, 1) IS NOT NULL;

  IF NOT w_has_owner AND NOT l_has_owner THEN
    claim_signal := 'no_owner_conflict';
  ELSIF w_has_owner AND NOT l_has_owner THEN
    claim_signal := 'winner_claimed_only';
  ELSIF NOT w_has_owner AND l_has_owner THEN
    claim_signal := 'loser_claimed_only';
  ELSIF (w_owners <@ l_owners) AND (l_owners <@ w_owners) THEN
    -- identical owner sets
    claim_signal := 'both_claimed_same_owner';
  ELSIF w_owners && l_owners THEN
    -- share at least one owner but not the same set
    claim_signal := 'both_claimed_overlapping_owners';
  ELSE
    -- claimed by completely different owners
    claim_signal := 'both_claimed_different_owner';
  END IF;

  -- Analytics impact (exhibitor_events keeps history by identity/slug)
  SELECT count(*) INTO w_analytics FROM exhibitor_events
    WHERE public_identity_id = w.public_identity_id OR public_slug = w.public_slug;
  SELECT count(*) INTO l_analytics FROM exhibitor_events
    WHERE public_identity_id = l.public_identity_id OR public_slug = l.public_slug;

  -- Duplicate content risk
  IF w.seo_indexable AND l.seo_indexable THEN
    dup_risk := 'high';
  ELSIF w.seo_indexable OR l.seo_indexable THEN
    dup_risk := 'medium';
  ELSE
    dup_risk := 'low';
  END IF;

  -- Non-binding recommendation scoring
  w_score :=
      (CASE WHEN w.is_claimed THEN 40 ELSE 0 END)
    + (CASE WHEN w.is_verified THEN 25 ELSE 0 END)
    + (CASE WHEN w.seo_indexable THEN 20 ELSE 0 END)
    + (CASE WHEN w.source_type IN ('modern','linked') THEN 15 ELSE 0 END)
    + (CASE WHEN w.public_slug !~ '-[0-9]+$' THEN 10 ELSE 0 END)
    + (w.future_participations_count * 2)
    + (w.total_participations * 0.1);
  l_score :=
      (CASE WHEN l.is_claimed THEN 40 ELSE 0 END)
    + (CASE WHEN l.is_verified THEN 25 ELSE 0 END)
    + (CASE WHEN l.seo_indexable THEN 20 ELSE 0 END)
    + (CASE WHEN l.source_type IN ('modern','linked') THEN 15 ELSE 0 END)
    + (CASE WHEN l.public_slug !~ '-[0-9]+$' THEN 10 ELSE 0 END)
    + (l.future_participations_count * 2)
    + (l.total_participations * 0.1);

  IF l_score > w_score THEN
    rec_winner := l.public_identity_id;
    rec_target := l; rec_other := w;
  ELSE
    rec_winner := w.public_identity_id;
    rec_target := w; rec_other := l;
  END IF;

  IF rec_target.is_claimed THEN rec_reasons := rec_reasons || 'claimed'; END IF;
  IF rec_target.is_verified THEN rec_reasons := rec_reasons || 'verified'; END IF;
  IF rec_target.source_type IN ('modern','linked') THEN rec_reasons := rec_reasons || 'source_modern_or_linked'; END IF;
  IF rec_target.future_participations_count > rec_other.future_participations_count THEN rec_reasons := rec_reasons || 'more_future_participations'; END IF;
  IF rec_target.seo_indexable THEN rec_reasons := rec_reasons || 'seo_indexable'; END IF;
  IF rec_target.public_slug !~ '-[0-9]+$' AND rec_other.public_slug ~ '-[0-9]+$' THEN rec_reasons := rec_reasons || 'cleaner_slug'; END IF;

  RETURN jsonb_build_object(
    'preview_only', true,
    'message', 'Prévisualisation uniquement — aucune donnée ne sera modifiée.',
    'winner', jsonb_build_object(
      'public_identity_id', w.public_identity_id,
      'public_slug', w.public_slug,
      'display_name', w.display_name,
      'source_type', w.source_type,
      'exhibitor_id', w.exhibitor_id,
      'legacy_exposant_id', w.legacy_exposant_id,
      'website', w.website,
      'linkedin_url', w.linkedin_url,
      'is_claimed', w.is_claimed,
      'is_verified', w.is_verified,
      'seo_indexable', w.seo_indexable
    ),
    'loser', jsonb_build_object(
      'public_identity_id', l.public_identity_id,
      'public_slug', l.public_slug,
      'display_name', l.display_name,
      'source_type', l.source_type,
      'exhibitor_id', l.exhibitor_id,
      'legacy_exposant_id', l.legacy_exposant_id,
      'website', l.website,
      'linkedin_url', l.linkedin_url,
      'is_claimed', l.is_claimed,
      'is_verified', l.is_verified,
      'seo_indexable', l.seo_indexable
    ),
    'participations', jsonb_build_object(
      'winner_participations', w_part_total,
      'loser_participations', l_part_total,
      'participations_to_repoint', l_part_total,
      'potential_duplicate_participations', potential_dup_parts,
      'common_events', common_events
    ),
    'seo', jsonb_build_object(
      'winner_slug_kept', w.public_slug,
      'loser_slug_to_redirect', l.public_slug,
      'winner_website', w.website,
      'loser_website', l.website,
      'loser_in_sitemap', l.seo_indexable,
      'winner_in_sitemap', w.seo_indexable,
      'duplicate_content_risk', dup_risk,
      'proposed_future_canonical', '/exposants/' || w.public_slug,
      'recommended_future_canonical', '/exposants/' || rec_target.public_slug
    ),
    'novelties', jsonb_build_object(
      'winner_novelties', w_nov_total,
      'loser_novelties', l_nov_total,
      'winner_published_novelties', w_nov_pub,
      'loser_published_novelties', l_nov_pub,
      'conflict', (w_nov_total > 0 AND l_nov_total > 0),
      'note', 'Une nouveauté reste liée à un événement.'
    ),
    'claim', jsonb_build_object(
      'winner_claimed', w.is_claimed,
      'loser_claimed', l.is_claimed,
      'conflict_signal', claim_signal,
      'has_conflict', (claim_signal IN ('both_claimed_different_owner', 'both_claimed_overlapping_owners'))
    ),
    'analytics', jsonb_build_object(
      'winner_analytics_events', w_analytics,
      'loser_analytics_events', l_analytics,
      'note', 'exhibitor_events.public_slug conserve l''historique.'
    ),
    'recommendation', jsonb_build_object(
      'recommended_winner_identity_id', rec_winner,
      'recommended_matches_proposed', (rec_winner = w.public_identity_id),
      'reasons', to_jsonb(rec_reasons)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_exhibitor_identity_merge(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_exhibitor_identity_merge(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.preview_exhibitor_identity_merge(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_exhibitor_identity_merge(uuid, uuid) TO authenticated, service_role;