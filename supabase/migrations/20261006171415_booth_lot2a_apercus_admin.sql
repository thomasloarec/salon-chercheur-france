-- Lotexpo Leads, Lot 2a : déclarer les tables booth_ dans les aperçus admin (retrait, dépendances, fusion).
-- Changements purement additifs dans 3 fonctions existantes (sauvegarde : booth_lot2_sauvegarde_fonctions_avant.sql).
-- La fonction de suppression définitive est traitée séparément (lot 2b).
-- Correctif inclus : preview_exhibitor_identity_merge échouait (malformed array literal) dès qu'une raison de
-- recommandation s'appliquait ; les ajouts au tableau rec_reasons sont désormais typés ::text.

CREATE OR REPLACE FUNCTION public._booth_dep_total(p_exhibitor_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_exhibitor_id IS NULL THEN 0::bigint ELSE
      (SELECT count(*) FROM public.booth_access        WHERE exhibitor_id = p_exhibitor_id)
    + (SELECT count(*) FROM public.booth_team_members  WHERE exhibitor_id = p_exhibitor_id)
    + (SELECT count(*) FROM public.booth_workspaces    WHERE exhibitor_id = p_exhibitor_id)
    + (SELECT count(*) FROM public.booth_contacts      WHERE exhibitor_id = p_exhibitor_id)
    + (SELECT count(*) FROM public.booth_interactions  WHERE exhibitor_id = p_exhibitor_id)
    + (SELECT count(*) FROM public.booth_opportunities WHERE exhibitor_id = p_exhibitor_id)
  END
$$;

COMMENT ON FUNCTION public._booth_dep_total(uuid) IS
  'Lotexpo Leads : nombre total de lignes booth_ rattachées à un exposant. Utilisé par les outils admin de suppression et de fusion.';

REVOKE ALL ON FUNCTION public._booth_dep_total(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._booth_dep_total(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._exhibitor_identity_dep_profile(p_identity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  epi          public.exhibitor_public_identities%ROWTYPE;
  v_ex_name    text;
  v_ex_site    text;
  v_owner      boolean := false;
  v_leg_name   text;
  v_leg_site   text;
  v_leg_domain text;
  v_norm_dom   text;
  v_part       bigint := 0;
  v_nov        bigint := 0;
  v_leads      bigint := 0;
  v_team       bigint := 0;
  v_crm        bigint := 0;
  v_booth      bigint := 0;
  v_airtable   text;
  v_mirror     text;
  v_hard       boolean;
  v_dep_score  numeric;
BEGIN
  -- Garde-fou : admin ou service_role uniquement (défense en profondeur)
  IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO epi FROM public.exhibitor_public_identities WHERE id = p_identity_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF epi.exhibitor_id IS NOT NULL THEN
    SELECT name, website, (owner_user_id IS NOT NULL)
      INTO v_ex_name, v_ex_site, v_owner
      FROM public.exhibitors WHERE id = epi.exhibitor_id;
    SELECT count(*) INTO v_team
      FROM public.exhibitor_team_members
      WHERE exhibitor_id = epi.exhibitor_id AND status = 'active';
    SELECT count(*) INTO v_nov
      FROM public.novelties
      WHERE exhibitor_id = epi.exhibitor_id AND status = 'published'
        AND COALESCE(is_test, false) = false;
    SELECT count(*) INTO v_leads
      FROM public.leads WHERE exhibitor_id = epi.exhibitor_id;
    v_booth := public._booth_dep_total(epi.exhibitor_id);
  END IF;

  IF epi.legacy_exposant_id IS NOT NULL THEN
    SELECT nom_exposant, website_exposant, normalized_domain
      INTO v_leg_name, v_leg_site, v_leg_domain
      FROM public.exposants WHERE id_exposant = epi.legacy_exposant_id ORDER BY id LIMIT 1;
    SELECT count(*) INTO v_crm
      FROM public.crm_company_event_matches WHERE id_exposant = epi.legacy_exposant_id;
  END IF;

  SELECT count(DISTINCT p.id_participation) INTO v_part
  FROM public.participation p
  WHERE (epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = epi.legacy_exposant_id)
     OR (epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = epi.exhibitor_id);

  v_airtable := CASE WHEN epi.legacy_exposant_id IS NOT NULL
                      AND NOT public._is_uuid_text(epi.legacy_exposant_id)
                     THEN epi.legacy_exposant_id END;
  v_mirror   := CASE
                  WHEN epi.legacy_exposant_id IS NOT NULL AND public._is_uuid_text(epi.legacy_exposant_id)
                    THEN epi.legacy_exposant_id
                  WHEN epi.exhibitor_id IS NOT NULL THEN epi.exhibitor_id::text
                END;

  v_norm_dom := COALESCE(
                  public._recon_norm_domain(v_leg_domain),
                  public._recon_norm_domain(v_leg_site),
                  public._recon_norm_domain(v_ex_site)
                );

  v_hard := v_owner OR v_nov > 0 OR v_leads > 0 OR v_team > 0 OR v_crm > 0 OR v_booth > 0;
  v_dep_score := v_part + v_nov * 10 + v_leads * 5 + v_team * 5 + v_crm * 3 + v_booth * 5
                 + CASE WHEN v_owner THEN 20 ELSE 0 END;

  RETURN jsonb_build_object(
    'identity_id', epi.id,
    'public_slug', epi.public_slug,
    'canonical_name', epi.canonical_name,
    'source_type', epi.source_type,
    'is_active', epi.is_active,
    'exhibitor_id', epi.exhibitor_id,
    'exhibitor_name', v_ex_name,
    'exhibitor_website', v_ex_site,
    'owner_present', v_owner,
    'legacy_exposant_id', epi.legacy_exposant_id,
    'legacy_name', v_leg_name,
    'legacy_website', v_leg_site,
    'normalized_domain', v_norm_dom,
    'airtable_real_id', v_airtable,
    'uuid_mirror_id', v_mirror,
    'participations_count', v_part,
    'published_novelties_count', v_nov,
    'leads_count', v_leads,
    'active_team_count', v_team,
    'crm_matches_count', v_crm,
    'booth_records_count', v_booth,
    'has_hard_deps', v_hard,
    'dep_score', v_dep_score
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_removal(p_source text DEFAULT NULL::text, p_exhibitor_id uuid DEFAULT NULL::uuid, p_id_exposant text DEFAULT NULL::text, p_public_identity_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_epi exhibitor_public_identities;
  v_name text;
  v_part_count int := 0;
  v_events jsonb := '[]'::jsonb;
  v_events_count int := 0;
  v_novelties int := 0;
  v_leads int := 0;
  v_claims int := 0;
  v_crm int := 0;
  v_booth int := 0;
  v_has_owner boolean := false;
  v_warnings jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_epi := public.admin_resolve_identity(p_public_identity_id, p_exhibitor_id, p_id_exposant);
  IF v_epi.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT coalesce(
           (SELECT name FROM exhibitors WHERE id = v_epi.exhibitor_id),
           (SELECT nom_exposant FROM exposants WHERE id_exposant = v_epi.legacy_exposant_id),
           v_epi.canonical_name)
    INTO v_name;

  SELECT count(*),
         coalesce(jsonb_agg(DISTINCT jsonb_build_object(
           'id', e.id, 'nom_event', e.nom_event, 'date_debut', e.date_debut, 'slug', e.slug
         )) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb)
    INTO v_part_count, v_events
  FROM participation p
  LEFT JOIN events e ON e.id = p.id_event
  WHERE (v_epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = v_epi.legacy_exposant_id)
     OR (v_epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = v_epi.exhibitor_id);

  SELECT count(*) INTO v_events_count FROM jsonb_array_elements(v_events);

  IF v_epi.exhibitor_id IS NOT NULL THEN
    SELECT count(*) INTO v_novelties FROM novelties
      WHERE (exhibitor_id = v_epi.exhibitor_id OR pending_exhibitor_id = v_epi.exhibitor_id);
    SELECT count(*) INTO v_leads FROM leads WHERE exhibitor_id = v_epi.exhibitor_id;
    v_booth := public._booth_dep_total(v_epi.exhibitor_id);
    SELECT count(*) INTO v_claims FROM (
      SELECT 1 FROM exhibitor_claim_requests WHERE exhibitor_id = v_epi.exhibitor_id
      UNION ALL
      SELECT 1 FROM exhibitor_admin_claims WHERE exhibitor_id = v_epi.exhibitor_id
    ) c;
    SELECT (owner_user_id IS NOT NULL) INTO v_has_owner FROM exhibitors WHERE id = v_epi.exhibitor_id;
    IF NOT v_has_owner THEN
      SELECT EXISTS(SELECT 1 FROM exhibitor_team_members WHERE exhibitor_id = v_epi.exhibitor_id AND status = 'active'::exhibitor_team_status)
        INTO v_has_owner;
    END IF;
  END IF;

  IF v_epi.legacy_exposant_id IS NOT NULL THEN
    SELECT
      (SELECT count(*) FROM crm_company_event_matches WHERE id_exposant = v_epi.legacy_exposant_id)
      + (SELECT count(*) FROM crm_event_alerts WHERE id_exposant = v_epi.legacy_exposant_id)
    INTO v_crm;
  END IF;

  IF v_novelties > 0 THEN v_warnings := v_warnings || jsonb_build_array(v_novelties || ' nouveauté(s) liée(s)'); END IF;
  IF v_leads > 0 THEN v_warnings := v_warnings || jsonb_build_array(v_leads || ' lead(s) lié(s)'); END IF;
  IF v_claims > 0 THEN v_warnings := v_warnings || jsonb_build_array(v_claims || ' demande(s) de gestion'); END IF;
  IF v_has_owner THEN v_warnings := v_warnings || jsonb_build_array('Possède un propriétaire / une équipe active'); END IF;
  IF v_crm > 0 THEN v_warnings := v_warnings || jsonb_build_array(v_crm || ' correspondance(s) CRM liée(s) (legacy)'); END IF;
  IF v_booth > 0 THEN v_warnings := v_warnings || jsonb_build_array(v_booth || ' donnée(s) Lotexpo Leads (accès, équipe, salons, contacts, rencontres) : suppression définitive impossible'); END IF;
  IF v_part_count >= 5 THEN v_warnings := v_warnings || jsonb_build_array('Plus de 5 participations : confirmation texte requise'); END IF;

  RETURN jsonb_build_object(
    'found', true,
    'name', v_name,
    'slug', v_epi.public_slug,
    'source', v_epi.source_type,
    'public_identity_id', v_epi.id,
    'participations_count', v_part_count,
    'events_count', v_events_count,
    'events', v_events,
    'novelties_count', v_novelties,
    'leads_count', v_leads,
    'claims_count', v_claims,
    'crm_links_count', v_crm,
    'booth_records_count', v_booth,
    'has_owner', v_has_owner,
    'requires_confirmation', (v_part_count >= 5),
    'can_remove_from_site', true,
    'can_hard_delete', (v_novelties = 0 AND v_leads = 0 AND v_claims = 0 AND NOT v_has_owner AND v_crm = 0 AND v_booth = 0),
    'warnings', v_warnings
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_exhibitor_identity_merge(p_winner_identity_id uuid, p_loser_identity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
  w_booth bigint := 0;
  l_booth bigint := 0;
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

  -- Lotexpo Leads (jamais déplacé automatiquement par une fusion)
  IF w.exhibitor_id IS NOT NULL THEN w_booth := public._booth_dep_total(w.exhibitor_id); END IF;
  IF l.exhibitor_id IS NOT NULL THEN l_booth := public._booth_dep_total(l.exhibitor_id); END IF;

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

  IF rec_target.is_claimed THEN rec_reasons := rec_reasons || 'claimed'::text; END IF;
  IF rec_target.is_verified THEN rec_reasons := rec_reasons || 'verified'::text; END IF;
  IF rec_target.source_type IN ('modern','linked') THEN rec_reasons := rec_reasons || 'source_modern_or_linked'::text; END IF;
  IF rec_target.future_participations_count > rec_other.future_participations_count THEN rec_reasons := rec_reasons || 'more_future_participations'::text; END IF;
  IF rec_target.seo_indexable THEN rec_reasons := rec_reasons || 'seo_indexable'::text; END IF;
  IF rec_target.public_slug !~ '-[0-9]+$' AND rec_other.public_slug ~ '-[0-9]+$' THEN rec_reasons := rec_reasons || 'cleaner_slug'::text; END IF;

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
    'lotexpo_leads', jsonb_build_object(
      'winner_records', w_booth,
      'loser_records', l_booth,
      'blocking', (l_booth > 0),
      'note', 'Les données Lotexpo Leads ne sont jamais déplacées automatiquement par une fusion : à traiter avant toute fusion réelle.'
    ),
    'recommendation', jsonb_build_object(
      'recommended_winner_identity_id', rec_winner,
      'recommended_matches_proposed', (rec_winner = w.public_identity_id),
      'reasons', to_jsonb(rec_reasons)
    )
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
