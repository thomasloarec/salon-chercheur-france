DROP FUNCTION IF EXISTS public.create_novelty_atomic(uuid,uuid,uuid,text,text,text,text[],text,text,uuid);

CREATE OR REPLACE FUNCTION public.create_novelty_atomic(
  p_event_id             uuid,
  p_exhibitor_id         uuid,
  p_created_by           uuid,
  p_title                text,
  p_type                 text,
  p_reason               text,
  p_images               text[],
  p_brochure_pdf         text    DEFAULT NULL,
  p_stand_info           text    DEFAULT NULL,
  p_pending_exhibitor_id uuid    DEFAULT NULL,
  p_reason_2             text    DEFAULT NULL,
  p_reason_3             text    DEFAULT NULL,
  p_summary              text    DEFAULT NULL,
  p_audience_tags        text[]  DEFAULT NULL,
  p_is_platform_admin    boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quota          jsonb;
  v_current_count  int;
  v_max_novelties  int;
  v_inserted_id    uuid;
  v_inserted_title text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_exhibitor_id::text || p_event_id::text));

  v_quota         := public.novelty_quota_status(p_exhibitor_id, p_event_id);
  v_current_count := (v_quota->>'current_count')::int;
  v_max_novelties := (v_quota->>'limit')::int;

  IF NOT coalesce(p_is_platform_admin, false)
     AND NOT (v_quota->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'error',   true,
      'code',    'QUOTA_EXCEEDED',
      'message', CASE WHEN (v_quota->>'is_premium')::boolean
        THEN format('Limite atteinte: %s nouveauté(s) maximum pour votre forfait Premium.', v_max_novelties)
        ELSE 'Plan gratuit: 1 nouveauté maximum par exposant et par événement. Passez au forfait Premium pour en publier davantage.'
      END,
      'current', v_current_count,
      'limit',   v_max_novelties
    );
  END IF;

  INSERT INTO public.novelties (
    event_id, exhibitor_id, title, type,
    reason_1, reason_2, reason_3, summary, audience_tags,
    media_urls, images_count, doc_url, stand_info,
    created_by, status, pending_exhibitor_id
  ) VALUES (
    p_event_id, p_exhibitor_id, trim(p_title), p_type,
    trim(p_reason),
    nullif(trim(coalesce(p_reason_2, '')), ''),
    nullif(trim(coalesce(p_reason_3, '')), ''),
    nullif(trim(coalesce(p_summary,  '')), ''),
    CASE
      WHEN p_audience_tags IS NULL OR array_length(p_audience_tags, 1) IS NULL THEN NULL
      ELSE p_audience_tags[1:10]
    END,
    p_images, array_length(p_images, 1), p_brochure_pdf, p_stand_info,
    p_created_by, 'draft', p_pending_exhibitor_id
  )
  RETURNING id, title INTO v_inserted_id, v_inserted_title;

  RETURN jsonb_build_object(
    'error', false,
    'id',    v_inserted_id,
    'title', v_inserted_title,
    'pending_exhibitor_id', p_pending_exhibitor_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_novelty_atomic(
  uuid,uuid,uuid,text,text,text,text[],text,text,uuid,text,text,text,text[],boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_novelty_atomic(
  uuid,uuid,uuid,text,text,text,text[],text,text,uuid,text,text,text,text[],boolean
) TO service_role, postgres;