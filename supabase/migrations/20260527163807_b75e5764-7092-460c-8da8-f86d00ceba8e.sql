
-- ============================================================================
-- Hotfix anti-doublons exhibitors / participation (V3 finale)
-- ============================================================================

-- 1) normalize_company_name : suffixes légaux (incl. S.A., S.A.R.L., ...)
CREATE OR REPLACE FUNCTION public.normalize_company_name(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_base text;
  v text;
  v_prev text;
BEGIN
  IF input IS NULL OR length(btrim(input)) = 0 THEN
    RETURN '';
  END IF;

  -- 1) unaccent + lower (forme mono-argument, vérifiée fonctionnelle dans cet environnement)
  v_base := lower(extensions.unaccent(input));
  -- 2) supprimer les POINTS avant la normalisation (S.A. -> SA, S.A.R.L. -> SARL)
  v_base := replace(v_base, '.', '');
  -- 3) non [a-z0-9] -> espace, compactage
  v_base := btrim(regexp_replace(
    regexp_replace(v_base, '[^a-z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));

  v := v_base;
  LOOP
    v_prev := v;
    v := btrim(regexp_replace(
      v,
      '\s+(sas|sasu|sarl|sa|sci|snc|eurl|gmbh|ltd|limited|inc|llc|bv|srl|spa|ag|co|company|group|holding|holdings)$',
      '',
      'i'
    ));
    EXIT WHEN v = v_prev OR length(v) = 0;
  END LOOP;

  IF v IS NULL OR length(v) = 0 THEN
    RETURN v_base;
  END IF;
  RETURN v;
END
$$;

-- Backfill
UPDATE public.exhibitors
   SET name_normalized = public.normalize_company_name(name)
 WHERE name IS NOT NULL;

UPDATE public.exposants
   SET nom_normalized = public.normalize_company_name(nom_exposant)
 WHERE nom_exposant IS NOT NULL;

-- 2) extract_root_domain
CREATE OR REPLACE FUNCTION public.extract_root_domain(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  IF input IS NULL OR length(btrim(input)) = 0 THEN
    RETURN NULL;
  END IF;
  v := lower(btrim(input));
  v := regexp_replace(v, '^https?://', '');
  v := regexp_replace(v, '^www\.', '');
  v := split_part(v, '/', 1);
  v := split_part(v, '?', 1);
  v := split_part(v, '#', 1);
  v := btrim(v);
  IF length(v) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN v;
END
$$;

-- 3) create_exhibitor_with_lock
CREATE OR REPLACE FUNCTION public.create_exhibitor_with_lock(
  p_name        text,
  p_website     text,
  p_description text,
  p_stand_info  text,
  p_logo_url    text
)
RETURNS public.exhibitors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_dom  text;
  v_row  public.exhibitors;
BEGIN
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'invalid exhibitor name';
  END IF;

  v_norm := public.normalize_company_name(p_name);
  v_dom  := public.extract_root_domain(p_website);

  IF v_norm IS NULL OR length(v_norm) = 0 THEN
    RAISE EXCEPTION 'invalid normalized name for %', p_name;
  END IF;

  -- Verrous transactionnels
  PERFORM pg_advisory_xact_lock(hashtext('exhibitor_name:' || v_norm));
  IF v_dom IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('exhibitor_domain:' || v_dom));
  END IF;

  -- 1) Match par domaine — anti-archive / anti-test / priorité approved
  IF v_dom IS NOT NULL THEN
    SELECT * INTO v_row
      FROM public.exhibitors
     WHERE public.extract_root_domain(website) = v_dom
     ORDER BY
       (name ILIKE '[ARCHIVED]%') ASC,
       COALESCE(is_test, false) ASC,
       COALESCE(approved, false) DESC,
       updated_at DESC NULLS LAST
     LIMIT 1;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  -- 2) Match par nom normalisé
  SELECT * INTO v_row
    FROM public.exhibitors
   WHERE name_normalized = v_norm
   ORDER BY
     (name ILIKE '[ARCHIVED]%') ASC,
     COALESCE(is_test, false) ASC,
     COALESCE(approved, false) DESC,
     updated_at DESC NULLS LAST
   LIMIT 1;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  -- 3) Création — mêmes champs que le code legacy (approved=false, owner_user_id=null).
  --    Tous les autres champs reposent volontairement sur leurs defaults SQL
  --    (is_test=false, plan='free', email_source='pending', etc.).
  INSERT INTO public.exhibitors (
    name, website, description, stand_info, logo_url,
    approved, owner_user_id, name_normalized
  )
  VALUES (
    p_name, p_website, p_description, p_stand_info, p_logo_url,
    false, NULL, v_norm
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END
$$;

REVOKE ALL ON FUNCTION public.create_exhibitor_with_lock(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_exhibitor_with_lock(text, text, text, text, text)
  TO service_role;

-- 4) ensure_participation
CREATE OR REPLACE FUNCTION public.ensure_participation(
  p_exhibitor_id uuid,
  p_event_id     uuid,
  p_stand_info   text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          uuid;
  v_event_text  text;
BEGIN
  IF p_exhibitor_id IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION 'exhibitor_id and event_id are required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('participation:' || p_exhibitor_id::text || ':' || p_event_id::text)
  );

  SELECT id_participation INTO v_id
    FROM public.participation
   WHERE id_event = p_event_id
     AND (exhibitor_id = p_exhibitor_id OR id_exposant = p_exhibitor_id::text)
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id_event INTO v_event_text FROM public.events WHERE id = p_event_id;
  IF v_event_text IS NULL THEN
    RAISE EXCEPTION 'event not found for id %', p_event_id;
  END IF;

  INSERT INTO public.participation (
    id_exposant, exhibitor_id, id_event, id_event_text, stand_exposant
  ) VALUES (
    p_exhibitor_id::text, p_exhibitor_id, p_event_id, v_event_text, p_stand_info
  )
  RETURNING id_participation INTO v_id;

  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION public.ensure_participation(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_participation(uuid, uuid, text)
  TO service_role;

-- 5) Patch des 3 nouveautés orphelines
SELECT public.ensure_participation(
  '26153490-a0a3-4f7f-981a-f50dd09efcd4'::uuid,
  '77cd4dd7-5c0a-49ed-9f50-1f7d50479d44'::uuid,
  NULL
);
SELECT public.ensure_participation(
  '71633dcf-aa8c-43e9-be36-650641880649'::uuid,
  '036c451a-b131-466a-8c13-6addb8bf4e26'::uuid,
  NULL
);
SELECT public.ensure_participation(
  'bdda3a01-9653-4eb8-8760-92774fc9d696'::uuid,
  '5d5782e6-69e9-4d00-9540-dfb750f15866'::uuid,
  NULL
);
