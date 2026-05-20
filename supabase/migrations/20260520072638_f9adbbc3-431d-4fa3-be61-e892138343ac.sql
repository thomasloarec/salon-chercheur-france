CREATE OR REPLACE FUNCTION public.set_seo_vault_secret(p_name text, p_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_jwt_role text;
  v_existing_id uuid;
  v_result jsonb;
  v_allowed text[] := ARRAY[
    'SEO_BATCH_SECRET',
    'SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_FUNCTIONS_URL'
  ];
BEGIN
  v_jwt_role := current_setting('request.jwt.claim.role', true);

  IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_name IS NULL OR NOT (p_name = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'secret name not allowed: %', p_name;
  END IF;

  IF p_value IS NULL OR length(p_value) = 0 THEN
    RAISE EXCEPTION 'secret value required';
  END IF;

  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing_id, p_value, p_name, NULL);
    v_result := jsonb_build_object('action', 'updated', 'name', p_name, 'length', length(p_value));
  ELSE
    PERFORM vault.create_secret(p_value, p_name, NULL);
    v_result := jsonb_build_object('action', 'created', 'name', p_name, 'length', length(p_value));
  END IF;

  INSERT INTO public.application_logs (level, source, message, details)
  VALUES (
    'info',
    'set_seo_vault_secret',
    'Vault secret stored',
    jsonb_build_object('name', p_name, 'length', length(p_value), 'jwt_role', v_jwt_role)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_seo_vault_secret(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_seo_vault_secret(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_seo_vault_secret(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_seo_vault_secret(text, text) TO service_role;