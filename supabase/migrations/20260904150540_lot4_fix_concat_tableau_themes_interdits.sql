-- Correctif : text[] || 'chaine' est interprete comme un litteral de
-- tableau. Il faut un cast explicite en text pour concatener un element.

CREATE OR REPLACE FUNCTION public.get_organizer_activation_themes_interdits(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap      jsonb;
  v_interdits text[] := ARRAY[]::text[];
BEGIN
  v_snap := public.get_organizer_activation_snapshot(p_campaign_id);

  IF COALESCE(v_snap ->> 'ok', 'false') <> 'true' THEN
    RETURN '["exposants","programme","fil","nouveautes"]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_snap -> 'salons') s
    WHERE (s -> 'expects_exhibitors')::text = 'true'
  ) THEN
    v_interdits := v_interdits || 'exposants'::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_snap -> 'salons') s
    WHERE COALESCE((s -> 'expects_program')::text, 'null') <> 'false'
  ) THEN
    v_interdits := v_interdits || 'programme'::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_snap -> 'salons') s
    WHERE (s ->> 'nb_exposants')::int > 0
  ) THEN
    v_interdits := v_interdits || 'nouveautes'::text;
  END IF;

  RETURN to_jsonb(v_interdits);
END;
$$;

REVOKE ALL ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) TO service_role;
