-- ════════════════════════════════════════════════════════════════════
-- Phase 4A-D (V5) — Audit log des modifications owner des fiches exposants
-- ════════════════════════════════════════════════════════════════════

-- 1. Table d'audit (aucune sous-requête dans les CHECK — Option A)
CREATE TABLE public.exhibitor_profile_change_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibitor_id uuid NOT NULL REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  actor_role text NOT NULL,
  source text NOT NULL DEFAULT 'exhibitors-manage:update',
  changed_fields text[] NOT NULL,
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exhibitor_change_actor_role_check
    CHECK (actor_role IN ('platform_admin','owner_user_id','team_owner','team_admin')),
  CONSTRAINT exhibitor_change_fields_whitelist_check
    CHECK (changed_fields <@ ARRAY['description','website','linkedin_url','logo_url']::text[]),
  CONSTRAINT exhibitor_change_fields_nonempty_check
    CHECK (cardinality(changed_fields) >= 1),
  CONSTRAINT exhibitor_change_changes_is_object_check
    CHECK (jsonb_typeof(changes) = 'object')
);

-- 2. Indexes
CREATE INDEX idx_exhibitor_change_logs_exhibitor
  ON public.exhibitor_profile_change_logs (exhibitor_id, created_at DESC);
CREATE INDEX idx_exhibitor_change_logs_actor
  ON public.exhibitor_profile_change_logs (actor_user_id, created_at DESC);
CREATE INDEX idx_exhibitor_change_logs_created
  ON public.exhibitor_profile_change_logs (created_at DESC);

-- 3. Grants
REVOKE ALL ON public.exhibitor_profile_change_logs FROM PUBLIC;
REVOKE ALL ON public.exhibitor_profile_change_logs FROM anon;
REVOKE ALL ON public.exhibitor_profile_change_logs FROM authenticated;
GRANT SELECT ON public.exhibitor_profile_change_logs TO authenticated; -- filtré par RLS admin-only
GRANT ALL ON public.exhibitor_profile_change_logs TO service_role;

-- 4. RLS
ALTER TABLE public.exhibitor_profile_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read exhibitor change logs"
ON public.exhibitor_profile_change_logs
FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Service role manages exhibitor change logs"
ON public.exhibitor_profile_change_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════
-- 5. RPC transactionnelle : UPDATE + INSERT log atomiques
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_exhibitor_public_profile_with_log(
  p_exhibitor_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_update jsonb,
  p_changed_fields text[],
  p_changes jsonb,
  p_source text DEFAULT 'exhibitors-manage:update'
)
RETURNS TABLE (
  id uuid,
  description text,
  website text,
  linkedin_url text,
  logo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY['description','website','linkedin_url','logo_url'];
  v_distinct int;
  v_key text;
  v_entry jsonb;
BEGIN
  -- ── changed_fields : non vide + whitelist + pas de doublon ──
  IF p_changed_fields IS NULL OR cardinality(p_changed_fields) < 1 THEN
    RAISE EXCEPTION 'changed_fields must not be empty';
  END IF;
  IF NOT (p_changed_fields <@ v_allowed) THEN
    RAISE EXCEPTION 'changed_fields contains a non-whitelisted column';
  END IF;
  SELECT count(DISTINCT x) INTO v_distinct FROM unnest(p_changed_fields) AS x;
  IF cardinality(p_changed_fields) <> v_distinct THEN
    RAISE EXCEPTION 'changed_fields must not contain duplicates';
  END IF;

  -- ── p_update : objet, non vide, clés whitelistées ──
  IF p_update IS NULL OR jsonb_typeof(p_update) <> 'object' THEN
    RAISE EXCEPTION 'p_update must be a json object';
  END IF;
  IF p_update = '{}'::jsonb THEN
    RAISE EXCEPTION 'p_update must not be empty';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_update) AS k(key)
    WHERE k.key <> ALL (v_allowed)
  ) THEN
    RAISE EXCEPTION 'p_update contains a non-whitelisted key';
  END IF;

  -- ── p_changes : objet non vide, clés whitelistées ──
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'p_changes must be a json object';
  END IF;
  IF p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'p_changes must not be empty';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_changes) AS k(key)
    WHERE k.key <> ALL (v_allowed)
  ) THEN
    RAISE EXCEPTION 'p_changes contains a non-whitelisted key';
  END IF;

  -- ── Cohérence stricte : keys(p_update) == p_changed_fields == keys(p_changes) ──
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_update) AS k(key)
    WHERE NOT (k.key = ANY (p_changed_fields))
  ) THEN
    RAISE EXCEPTION 'p_update keys must all be present in p_changed_fields';
  END IF;
  IF EXISTS (
    SELECT unnest(p_changed_fields)
    EXCEPT
    SELECT key FROM jsonb_object_keys(p_update) AS k(key)
  ) THEN
    RAISE EXCEPTION 'p_changed_fields must all be present in p_update keys';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_changes) AS k(key)
    WHERE NOT (k.key = ANY (p_changed_fields))
  ) THEN
    RAISE EXCEPTION 'p_changes keys must all be present in p_changed_fields';
  END IF;
  IF EXISTS (
    SELECT unnest(p_changed_fields)
    EXCEPT
    SELECT key FROM jsonb_object_keys(p_changes) AS k(key)
  ) THEN
    RAISE EXCEPTION 'p_changed_fields must all be present in p_changes keys';
  END IF;

  -- ── Structure stricte de chaque entrée de p_changes : { old, new } uniquement ──
  FOR v_key IN SELECT key FROM jsonb_object_keys(p_changes) AS k(key) LOOP
    v_entry := p_changes -> v_key;
    IF jsonb_typeof(v_entry) <> 'object' THEN
      RAISE EXCEPTION 'p_changes[%] must be a json object with old/new', v_key;
    END IF;
    IF NOT (v_entry ? 'old' AND v_entry ? 'new') THEN
      RAISE EXCEPTION 'p_changes[%] must contain both old and new keys', v_key;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(v_entry) AS e(key)) <> 2 THEN
      RAISE EXCEPTION 'p_changes[%] must contain only old and new keys', v_key;
    END IF;
  END LOOP;

  -- ── UPDATE des seuls champs réellement modifiés (valeurs normalisées) ──
  UPDATE public.exhibitors e SET
    description  = CASE WHEN p_update ? 'description'  THEN NULLIF(p_update->>'description', '')  ELSE e.description END,
    website      = CASE WHEN p_update ? 'website'      THEN NULLIF(p_update->>'website', '')      ELSE e.website END,
    linkedin_url = CASE WHEN p_update ? 'linkedin_url' THEN NULLIF(p_update->>'linkedin_url', '') ELSE e.linkedin_url END,
    logo_url     = CASE WHEN p_update ? 'logo_url'     THEN NULLIF(p_update->>'logo_url', '')     ELSE e.logo_url END,
    updated_at   = now()
  WHERE e.id = p_exhibitor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'exhibitor not found';
  END IF;

  -- ── INSERT du log dans la MÊME transaction (rollback si échec) ──
  INSERT INTO public.exhibitor_profile_change_logs
    (exhibitor_id, actor_user_id, actor_role, source, changed_fields, changes)
  VALUES
    (p_exhibitor_id, p_actor_user_id, p_actor_role, p_source, p_changed_fields, p_changes);

  RETURN QUERY
    SELECT e.id, e.description, e.website, e.linkedin_url, e.logo_url
    FROM public.exhibitors e
    WHERE e.id = p_exhibitor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_exhibitor_public_profile_with_log(uuid, uuid, text, jsonb, text[], jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_exhibitor_public_profile_with_log(uuid, uuid, text, jsonb, text[], jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_exhibitor_public_profile_with_log(uuid, uuid, text, jsonb, text[], jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_exhibitor_public_profile_with_log(uuid, uuid, text, jsonb, text[], jsonb, text) TO service_role;

-- ════════════════════════════════════════════════════════════════════
-- 6. RPC admin-only de lecture (service_role également autorisé)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.list_exhibitor_profile_change_logs(
  p_exhibitor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS SETOF public.exhibitor_profile_change_logs
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.exhibitor_profile_change_logs l
    WHERE p_exhibitor_id IS NULL OR l.exhibitor_id = p_exhibitor_id
    ORDER BY l.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

REVOKE ALL ON FUNCTION public.list_exhibitor_profile_change_logs(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_exhibitor_profile_change_logs(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_exhibitor_profile_change_logs(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_exhibitor_profile_change_logs(uuid, int) TO service_role;