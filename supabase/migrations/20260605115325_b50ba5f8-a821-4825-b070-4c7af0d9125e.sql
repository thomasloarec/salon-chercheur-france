
-- =========================================================================
-- 1. AUDIT LOG TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.admin_data_cleaning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'exhibitor',
  entity_source text,
  entity_id text,
  entity_name text,
  old_values jsonb,
  new_values jsonb,
  impact jsonb,
  reason text,
  airtable_sync_required boolean NOT NULL DEFAULT true
);

GRANT SELECT ON public.admin_data_cleaning_logs TO authenticated;
GRANT ALL ON public.admin_data_cleaning_logs TO service_role;

ALTER TABLE public.admin_data_cleaning_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read data cleaning logs" ON public.admin_data_cleaning_logs;
CREATE POLICY "Admins can read data cleaning logs"
  ON public.admin_data_cleaning_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_admin_data_cleaning_logs_created_at
  ON public.admin_data_cleaning_logs (created_at DESC);

-- =========================================================================
-- 2. DOMAIN NORMALIZATION HELPERS (pure, non-sensitive)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.web_domain(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text;
  v_host text;
  v_domain text;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  v := p_raw;
  v := replace(v, '%20', ' ');
  v := replace(v, '%09', ' ');
  v := replace(v, '%0a', ' ');
  v := replace(v, '%0A', ' ');
  v := regexp_replace(v, '\s+', '', 'g');
  IF v = '' THEN RETURN NULL; END IF;
  IF v ILIKE '%@%' THEN RETURN NULL; END IF;
  v := regexp_replace(v, '^[a-z]+://', '', 'i');
  v := regexp_replace(v, '^[a-z]+:', '', 'i');
  v := regexp_replace(v, '^/+', '');
  v_host := split_part(v, '/', 1);
  v_host := split_part(split_part(v_host, '?', 1), '#', 1);
  v_domain := regexp_replace(lower(v_host), '^www\.', '');
  v_domain := regexp_replace(v_domain, '\.$', '');
  IF v_domain ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$'
     AND v_domain !~ '\.\.'
     AND length(v_domain) <= 253 THEN
    RETURN v_domain;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_normalize_website(p_raw text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_domain text;
  v text;
  v_path text := '';
  v_reason text;
BEGIN
  v_domain := public.web_domain(p_raw);

  IF v_domain IS NULL THEN
    IF coalesce(btrim(p_raw), '') = '' THEN
      v_reason := 'Valeur vide';
    ELSIF p_raw ILIKE '%@%' THEN
      v_reason := 'Ressemble à une adresse e-mail';
    ELSIF lower(regexp_replace(coalesce(p_raw,''), '\s+', '', 'g')) IN ('www','http','https','https:','http:') THEN
      v_reason := 'Protocole ou domaine incomplet';
    ELSIF p_raw ~ '\s' THEN
      v_reason := 'Contient des espaces / texte libre';
    ELSE
      v_reason := 'Format de domaine invalide';
    END IF;
    RETURN jsonb_build_object(
      'input', p_raw,
      'normalized_url', NULL,
      'normalized_domain', NULL,
      'valid', false,
      'reason', v_reason
    );
  END IF;

  v := regexp_replace(replace(coalesce(p_raw,''), '%20', ''), '\s+', '', 'g');
  v := regexp_replace(v, '^[a-z]+://', '', 'i');
  v := regexp_replace(v, '^[a-z]+:', '', 'i');
  v := regexp_replace(v, '^/+', '');
  IF position('/' IN v) > 0 THEN
    v_path := substring(v FROM position('/' IN v));
  END IF;
  v_path := split_part(v_path, '#', 1);

  RETURN jsonb_build_object(
    'input', p_raw,
    'normalized_url', 'https://' || v_domain || v_path,
    'normalized_domain', v_domain,
    'valid', true,
    'reason', NULL
  );
END;
$$;

-- =========================================================================
-- 3. INTERNAL ADMIN-ONLY HELPERS (locked down)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_find_website_duplicate(
  p_domain text,
  p_exclude_exhibitor uuid DEFAULT NULL,
  p_exclude_legacy text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_domain IS NULL OR btrim(p_domain) = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'source', 'modern',
           'id', ex.id::text,
           'name', ex.name,
           'website', ex.website,
           'slug', epi.public_slug,
           'admin_link', '/admin/exhibitors'
         )
    INTO v_result
  FROM exhibitors ex
  LEFT JOIN exhibitor_public_identities epi
         ON epi.exhibitor_id = ex.id AND epi.is_active = true
  WHERE public.web_domain(ex.website) = p_domain
    AND (p_exclude_exhibitor IS NULL OR ex.id <> p_exclude_exhibitor)
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  SELECT jsonb_build_object(
           'source', 'legacy',
           'id', le.id_exposant,
           'name', le.nom_exposant,
           'website', le.website_exposant,
           'slug', epi.public_slug,
           'admin_link', CASE WHEN epi.public_slug IS NOT NULL THEN '/exposants/' || epi.public_slug ELSE NULL END
         )
    INTO v_result
  FROM exposants le
  LEFT JOIN exhibitor_public_identities epi
         ON epi.legacy_exposant_id = le.id_exposant AND epi.is_active = true
  WHERE coalesce(nullif(le.normalized_domain, ''), public.web_domain(le.website_exposant)) = p_domain
    AND (p_exclude_legacy IS NULL OR le.id_exposant <> p_exclude_legacy)
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_identity(
  p_public_identity_id uuid,
  p_exhibitor_id uuid,
  p_id_exposant text
)
RETURNS exhibitor_public_identities
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row exhibitor_public_identities;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_public_identity_id IS NOT NULL THEN
    SELECT * INTO v_row FROM exhibitor_public_identities WHERE id = p_public_identity_id;
  ELSIF p_exhibitor_id IS NOT NULL THEN
    SELECT * INTO v_row FROM exhibitor_public_identities WHERE exhibitor_id = p_exhibitor_id ORDER BY is_active DESC LIMIT 1;
  ELSIF p_id_exposant IS NOT NULL THEN
    SELECT * INTO v_row FROM exhibitor_public_identities WHERE legacy_exposant_id = p_id_exposant ORDER BY is_active DESC LIMIT 1;
  END IF;
  RETURN v_row;
END;
$$;

-- =========================================================================
-- 4. PREVIEW WEBSITE UPDATE
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_website_update(
  p_source text DEFAULT NULL,
  p_exhibitor_id uuid DEFAULT NULL,
  p_id_exposant text DEFAULT NULL,
  p_new_website text DEFAULT NULL,
  p_public_identity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_epi exhibitor_public_identities;
  v_norm jsonb;
  v_domain text;
  v_dup jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_valid boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_epi := public.admin_resolve_identity(p_public_identity_id, p_exhibitor_id, p_id_exposant);
  v_norm := public.admin_normalize_website(p_new_website);
  v_valid := (v_norm->>'valid')::boolean;
  v_domain := v_norm->>'normalized_domain';

  IF NOT v_valid THEN
    v_warnings := v_warnings || jsonb_build_array('URL invalide : ' || coalesce(v_norm->>'reason','format inconnu'));
  END IF;

  IF v_valid THEN
    v_dup := public.admin_find_website_duplicate(v_domain, v_epi.exhibitor_id, v_epi.legacy_exposant_id);
    IF v_dup IS NOT NULL THEN
      v_warnings := v_warnings || jsonb_build_array(
        'Domaine déjà utilisé par : ' || coalesce(v_dup->>'name','(entreprise inconnue)')
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'input', p_new_website,
    'normalized_url', v_norm->>'normalized_url',
    'normalized_domain', v_domain,
    'valid_url', v_valid,
    'duplicate_found', (v_dup IS NOT NULL),
    'duplicate_company', v_dup,
    'can_update', (v_valid AND v_dup IS NULL AND v_epi.id IS NOT NULL),
    'warnings', v_warnings
  );
END;
$$;

-- =========================================================================
-- 5. UPDATE WEBSITE (deterministic target via identity)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_update_exhibitor_website(
  p_source text DEFAULT NULL,
  p_exhibitor_id uuid DEFAULT NULL,
  p_id_exposant text DEFAULT NULL,
  p_new_website text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_public_identity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_epi exhibitor_public_identities;
  v_norm jsonb;
  v_domain text;
  v_new_url text;
  v_dup jsonb;
  v_old_modern text;
  v_old_legacy text;
  v_target text;
  v_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_epi := public.admin_resolve_identity(p_public_identity_id, p_exhibitor_id, p_id_exposant);
  IF v_epi.id IS NULL THEN
    RAISE EXCEPTION 'Exposant introuvable';
  END IF;

  v_norm := public.admin_normalize_website(p_new_website);
  IF NOT (v_norm->>'valid')::boolean THEN
    RAISE EXCEPTION 'URL invalide : %', coalesce(v_norm->>'reason','format inconnu');
  END IF;
  v_domain := v_norm->>'normalized_domain';
  v_new_url := v_norm->>'normalized_url';

  v_dup := public.admin_find_website_duplicate(v_domain, v_epi.exhibitor_id, v_epi.legacy_exposant_id);
  IF v_dup IS NOT NULL THEN
    INSERT INTO admin_data_cleaning_logs
      (admin_user_id, action, entity_source, entity_id, entity_name, old_values, new_values, impact, reason)
    VALUES (
      auth.uid(),
      'update_exhibitor_website_blocked_duplicate',
      v_epi.source_type,
      coalesce(v_epi.exhibitor_id::text, v_epi.legacy_exposant_id),
      v_epi.canonical_name,
      NULL,
      jsonb_build_object('attempted_website', p_new_website, 'normalized_domain', v_domain),
      jsonb_build_object('conflict', v_dup),
      p_reason
    );
    RETURN jsonb_build_object(
      'status', 'blocked_duplicate',
      'normalized_domain', v_domain,
      'duplicate_company', v_dup,
      'message', 'Ce site web est déjà associé à une autre entreprise : ' ||
                 coalesce(v_dup->>'name','(entreprise inconnue)') ||
                 '. Pour éviter un doublon, la mise à jour est bloquée.'
    );
  END IF;

  SELECT website INTO v_old_modern FROM exhibitors WHERE id = v_epi.exhibitor_id;
  SELECT website_exposant INTO v_old_legacy FROM exposants WHERE id_exposant = v_epi.legacy_exposant_id;

  IF v_epi.source_type = 'modern' AND v_epi.exhibitor_id IS NOT NULL THEN
    v_target := 'modern';
  ELSIF v_epi.source_type = 'legacy' AND v_epi.legacy_exposant_id IS NOT NULL THEN
    v_target := 'legacy';
  ELSIF v_epi.exhibitor_id IS NOT NULL AND coalesce(btrim(v_old_modern), '') <> '' THEN
    v_target := 'modern';
  ELSIF v_epi.legacy_exposant_id IS NOT NULL AND coalesce(btrim(v_old_legacy), '') <> '' THEN
    v_target := 'legacy';
  ELSIF v_epi.exhibitor_id IS NOT NULL THEN
    v_target := 'modern';
  ELSIF v_epi.legacy_exposant_id IS NOT NULL THEN
    v_target := 'legacy';
  ELSE
    RAISE EXCEPTION 'Identité publique sans source exploitable';
  END IF;

  IF v_target = 'modern' THEN
    UPDATE exhibitors SET website = v_new_url, updated_at = now() WHERE id = v_epi.exhibitor_id;
    SELECT name INTO v_name FROM exhibitors WHERE id = v_epi.exhibitor_id;
  ELSE
    UPDATE exposants
       SET website_exposant = v_new_url,
           normalized_domain = v_domain
     WHERE id_exposant = v_epi.legacy_exposant_id;
    SELECT nom_exposant INTO v_name FROM exposants WHERE id_exposant = v_epi.legacy_exposant_id;
  END IF;

  INSERT INTO admin_data_cleaning_logs
    (admin_user_id, action, entity_source, entity_id, entity_name, old_values, new_values, reason)
  VALUES (
    auth.uid(),
    'update_exhibitor_website',
    v_target,
    coalesce(v_epi.exhibitor_id::text, v_epi.legacy_exposant_id),
    coalesce(v_name, v_epi.canonical_name),
    jsonb_build_object('website_modern', v_old_modern, 'website_legacy', v_old_legacy),
    jsonb_build_object('website', v_new_url, 'normalized_domain', v_domain, 'target_table', v_target),
    p_reason
  );

  RETURN jsonb_build_object(
    'status', 'updated',
    'old_website', CASE WHEN v_target = 'modern' THEN v_old_modern ELSE v_old_legacy END,
    'new_website', v_new_url,
    'normalized_domain', v_domain,
    'target_table', v_target
  );
END;
$$;

-- =========================================================================
-- 6. PREVIEW REMOVAL
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_preview_exhibitor_removal(
  p_source text DEFAULT NULL,
  p_exhibitor_id uuid DEFAULT NULL,
  p_id_exposant text DEFAULT NULL,
  p_public_identity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'has_owner', v_has_owner,
    'requires_confirmation', (v_part_count >= 5),
    'can_remove_from_site', true,
    'can_hard_delete', (v_novelties = 0 AND v_leads = 0 AND v_claims = 0 AND NOT v_has_owner AND v_crm = 0),
    'warnings', v_warnings
  );
END;
$$;

-- =========================================================================
-- 7. REMOVE FROM SITE (mandatory reason; confirm if >= 5 participations)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_remove_exhibitor_from_site(
  p_source text DEFAULT NULL,
  p_exhibitor_id uuid DEFAULT NULL,
  p_id_exposant text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_public_identity_id uuid DEFAULT NULL,
  p_confirm text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_epi exhibitor_public_identities;
  v_name text;
  v_deleted_part jsonb := '[]'::jsonb;
  v_part_count int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Un motif est obligatoire';
  END IF;

  v_epi := public.admin_resolve_identity(p_public_identity_id, p_exhibitor_id, p_id_exposant);
  IF v_epi.id IS NULL THEN
    RAISE EXCEPTION 'Exposant introuvable';
  END IF;

  SELECT coalesce(
           (SELECT name FROM exhibitors WHERE id = v_epi.exhibitor_id),
           (SELECT nom_exposant FROM exposants WHERE id_exposant = v_epi.legacy_exposant_id),
           v_epi.canonical_name)
    INTO v_name;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id_participation', p.id_participation, 'id_event', p.id_event, 'id_exposant', p.id_exposant, 'exhibitor_id', p.exhibitor_id
         )), '[]'::jsonb), count(*)
    INTO v_deleted_part, v_part_count
  FROM participation p
  WHERE (v_epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = v_epi.legacy_exposant_id)
     OR (v_epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = v_epi.exhibitor_id);

  IF v_part_count >= 5 AND p_confirm IS DISTINCT FROM 'RETIRER' THEN
    RAISE EXCEPTION 'Cet exposant a % participations. Confirmation requise (tapez RETIRER).', v_part_count;
  END IF;

  DELETE FROM participation p
  WHERE (v_epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = v_epi.legacy_exposant_id)
     OR (v_epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = v_epi.exhibitor_id);

  UPDATE exhibitor_public_identities SET is_active = false, updated_at = now() WHERE id = v_epi.id;

  INSERT INTO admin_data_cleaning_logs
    (admin_user_id, action, entity_source, entity_id, entity_name, old_values, impact, reason)
  VALUES (
    auth.uid(),
    'remove_exhibitor_from_site',
    v_epi.source_type,
    coalesce(v_epi.exhibitor_id::text, v_epi.legacy_exposant_id),
    v_name,
    jsonb_build_object('public_identity_id', v_epi.id, 'was_active', true),
    jsonb_build_object('deleted_participations_count', v_part_count, 'deleted_participations', v_deleted_part),
    p_reason
  );

  RETURN jsonb_build_object(
    'status', 'removed',
    'name', v_name,
    'deleted_participations_count', v_part_count
  );
END;
$$;

-- =========================================================================
-- 8. HARD DELETE (created but NOT wired in UI; gated on all dependencies)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_hard_delete_exhibitor(
  p_source text DEFAULT NULL,
  p_exhibitor_id uuid DEFAULT NULL,
  p_id_exposant text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_confirm text DEFAULT NULL,
  p_public_identity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_epi exhibitor_public_identities;
  v_name text;
  v_novelties int := 0;
  v_leads int := 0;
  v_claims int := 0;
  v_crm int := 0;
  v_has_owner boolean := false;
  v_part_count int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Un motif est obligatoire';
  END IF;
  IF p_confirm IS DISTINCT FROM 'SUPPRIMER' THEN
    RAISE EXCEPTION 'Confirmation invalide (tapez SUPPRIMER)';
  END IF;

  v_epi := public.admin_resolve_identity(p_public_identity_id, p_exhibitor_id, p_id_exposant);
  IF v_epi.id IS NULL THEN
    RAISE EXCEPTION 'Exposant introuvable';
  END IF;

  SELECT coalesce(
           (SELECT name FROM exhibitors WHERE id = v_epi.exhibitor_id),
           (SELECT nom_exposant FROM exposants WHERE id_exposant = v_epi.legacy_exposant_id),
           v_epi.canonical_name)
    INTO v_name;

  IF v_epi.exhibitor_id IS NOT NULL THEN
    SELECT count(*) INTO v_novelties FROM novelties
      WHERE (exhibitor_id = v_epi.exhibitor_id OR pending_exhibitor_id = v_epi.exhibitor_id);
    SELECT count(*) INTO v_leads FROM leads WHERE exhibitor_id = v_epi.exhibitor_id;
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

  IF v_novelties > 0 OR v_leads > 0 OR v_claims > 0 OR v_has_owner OR v_crm > 0 THEN
    RAISE EXCEPTION 'Suppression définitive impossible : % nouveauté(s) / % lead(s) / % demande(s) / % lien(s) CRM%',
      v_novelties, v_leads, v_claims, v_crm, CASE WHEN v_has_owner THEN ' et un propriétaire' ELSE '' END;
  END IF;

  SELECT count(*) INTO v_part_count FROM participation p
  WHERE (v_epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = v_epi.legacy_exposant_id)
     OR (v_epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = v_epi.exhibitor_id);

  DELETE FROM participation p
  WHERE (v_epi.legacy_exposant_id IS NOT NULL AND p.id_exposant = v_epi.legacy_exposant_id)
     OR (v_epi.exhibitor_id IS NOT NULL AND p.exhibitor_id = v_epi.exhibitor_id);

  IF v_epi.exhibitor_id IS NOT NULL THEN
    DELETE FROM exhibitor_ai WHERE exhibitor_id = v_epi.exhibitor_id::text;
  END IF;
  IF v_epi.legacy_exposant_id IS NOT NULL THEN
    DELETE FROM exhibitor_ai WHERE exhibitor_id = v_epi.legacy_exposant_id;
  END IF;

  DELETE FROM exhibitor_public_identities WHERE id = v_epi.id;

  IF v_epi.exhibitor_id IS NOT NULL THEN
    DELETE FROM exhibitors WHERE id = v_epi.exhibitor_id;
  END IF;
  IF v_epi.legacy_exposant_id IS NOT NULL THEN
    DELETE FROM exposants WHERE id_exposant = v_epi.legacy_exposant_id;
  END IF;

  INSERT INTO admin_data_cleaning_logs
    (admin_user_id, action, entity_source, entity_id, entity_name, old_values, impact, reason)
  VALUES (
    auth.uid(),
    'hard_delete_exhibitor',
    v_epi.source_type,
    coalesce(v_epi.exhibitor_id::text, v_epi.legacy_exposant_id),
    v_name,
    jsonb_build_object('exhibitor_id', v_epi.exhibitor_id, 'legacy_exposant_id', v_epi.legacy_exposant_id, 'public_slug', v_epi.public_slug),
    jsonb_build_object('deleted_participations_count', v_part_count),
    p_reason
  );

  RETURN jsonb_build_object('status', 'deleted', 'name', v_name, 'deleted_participations_count', v_part_count);
END;
$$;

-- =========================================================================
-- 9. INVALID WEBSITES LIST (expose legacy id) — drop then recreate
-- =========================================================================
DROP FUNCTION IF EXISTS public.list_invalid_exhibitor_websites();

CREATE OR REPLACE FUNCTION public.list_invalid_exhibitor_websites()
RETURNS TABLE(public_identity_id uuid, public_slug text, display_name text, source_type text, website text, exhibitor_id uuid, legacy_exposant_id text, reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.public_identity_id,
    p.public_slug,
    p.display_name,
    p.source_type,
    p.website,
    p.exhibitor_id,
    p.legacy_exposant_id,
    CASE
      WHEN p.website ~ '\s' THEN 'Contient des espaces / texte libre'
      WHEN p.website LIKE '/%' THEN 'Chemin relatif'
      WHEN p.website ILIKE '%@%' THEN 'Ressemble à une adresse e-mail'
      ELSE 'Format de domaine invalide'
    END AS reason
  FROM public_exhibitor_profiles p
  WHERE p.is_test = false
    AND p.website IS NOT NULL
    AND btrim(p.website) <> ''
    AND NOT (
      p.website !~ '\s'
      AND p.website ~* '^(https?://)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+(/.*)?$'
    )
  ORDER BY p.source_type, p.display_name;
END;
$$;

-- =========================================================================
-- 10. EXECUTION PRIVILEGES (admin-only enforced internally)
-- =========================================================================
REVOKE ALL ON FUNCTION public.admin_find_website_duplicate(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_resolve_identity(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_website_duplicate(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_identity(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_website_update(text, uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_website_update(text, uuid, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_exhibitor_website(text, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_exhibitor_website(text, uuid, text, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_preview_exhibitor_removal(text, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_exhibitor_removal(text, uuid, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_remove_exhibitor_from_site(text, uuid, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_exhibitor_from_site(text, uuid, text, text, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_hard_delete_exhibitor(text, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_exhibitor(text, uuid, text, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_invalid_exhibitor_websites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_invalid_exhibitor_websites() TO authenticated;
