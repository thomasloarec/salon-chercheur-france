CREATE OR REPLACE FUNCTION public.set_seo_vault_secret(p_name text, p_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $fn$
DECLARE
  v_id uuid;
  v_allowed text[] := ARRAY['SEO_BATCH_SECRET','SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_FUNCTIONS_URL'];
  v_role text;
BEGIN
  -- Strict access control: service_role only
  v_role := current_setting('request.jwt.claim.role', true);
  IF v_role IS NULL OR v_role <> 'service_role' THEN
    -- Fallback for direct Postgres role (service_role connections)
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'service_role only';
    END IF;
  END IF;

  IF p_name IS NULL OR NOT (p_name = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'secret name not allowed: %', p_name;
  END IF;
  IF p_value IS NULL OR length(p_value) = 0 THEN
    RAISE EXCEPTION 'empty value';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_value, p_name, 'Set via set_seo_vault_secret() by service_role');
  ELSE
    PERFORM vault.update_secret(v_id, p_value, p_name);
  END IF;

  -- Never log the value, only the name and length
  INSERT INTO public.application_logs(level, source, message, details)
  VALUES ('info', 'seo-vault', 'Vault secret upserted', jsonb_build_object('name', p_name, 'length', length(p_value)));

  RETURN jsonb_build_object('ok', true, 'name', p_name, 'length', length(p_value));
END
$fn$;

REVOKE ALL ON FUNCTION public.set_seo_vault_secret(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_seo_vault_secret(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_seo_vault_secret(text, text) TO service_role;