-- LOT 0 — Unification et correction du quota Nouveauté

CREATE OR REPLACE FUNCTION public.novelty_quota_status(
  p_exhibitor_id uuid,
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max        int;
  v_count      int;
  v_is_premium boolean;
BEGIN
  IF p_exhibitor_id IS NULL OR p_event_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed',       false,
      'reason',        'Identifiant exposant ou événement manquant.',
      'current_count', 0,
      'limit',         0,
      'is_premium',    false
    );
  END IF;

  SELECT max_novelties INTO v_max
  FROM public.premium_entitlements
  WHERE exhibitor_id = p_exhibitor_id
    AND event_id     = p_event_id
    AND revoked_at IS NULL;

  v_is_premium := v_max IS NOT NULL;
  IF NOT v_is_premium THEN
    v_max := 1;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.novelties
  WHERE exhibitor_id = p_exhibitor_id
    AND event_id     = p_event_id
    AND status IN ('draft', 'pending', 'under_review', 'published');

  RETURN jsonb_build_object(
    'allowed',       v_count < v_max,
    'reason',        CASE
                       WHEN v_count < v_max THEN ''
                       WHEN v_is_premium THEN
                         format('Limite atteinte : %s nouveauté(s) maximum pour ce forfait.', v_max)
                       ELSE
                         'Plan gratuit : 1 nouveauté maximum par exposant et par événement.'
                     END,
    'current_count', v_count,
    'limit',         v_max,
    'is_premium',    v_is_premium
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.novelty_quota_status(uuid, uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_add_novelty(
  p_exhibitor_id uuid,
  p_event_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status jsonb;
  v_plan   text;
BEGIN
  v_status := public.novelty_quota_status(p_exhibitor_id, p_event_id);

  SELECT coalesce(plan, 'free') INTO v_plan
  FROM public.exhibitors
  WHERE id = p_exhibitor_id;

  RETURN json_build_object(
    'allowed',       (v_status->>'allowed')::boolean,
    'reason',         v_status->>'reason',
    'current_count', (v_status->>'current_count')::int,
    'plan',           coalesce(v_plan, 'free'),
    'limit',         (v_status->>'limit')::int,
    'is_premium',    (v_status->>'is_premium')::boolean
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_publish_novelty(
  exhibitor_id uuid,
  event_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF is_admin() THEN
    RETURN true;
  END IF;

  RETURN (
    public.novelty_quota_status(
      can_publish_novelty.exhibitor_id,
      can_publish_novelty.event_id
    ) ->> 'allowed'
  )::boolean;
END;
$function$;