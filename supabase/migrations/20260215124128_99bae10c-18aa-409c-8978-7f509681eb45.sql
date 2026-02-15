
-- Fonction atomique pour créer une nouveauté avec vérification de quota
-- Utilise pg_advisory_xact_lock pour empêcher les race conditions
CREATE OR REPLACE FUNCTION public.create_novelty_atomic(
  p_event_id uuid,
  p_exhibitor_id uuid,
  p_created_by uuid,
  p_title text,
  p_type text,
  p_reason text,
  p_images text[],
  p_brochure_pdf text DEFAULT NULL,
  p_stand_info text DEFAULT NULL,
  p_pending_exhibitor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_novelties int;
  v_current_count int;
  v_is_premium boolean;
  v_inserted_id uuid;
  v_inserted_title text;
BEGIN
  -- Advisory lock basé sur exhibitor_id + event_id pour empêcher les requêtes concurrentes
  PERFORM pg_advisory_xact_lock(hashtext(p_exhibitor_id::text || p_event_id::text));

  -- Vérifier entitlement premium
  SELECT max_novelties INTO v_max_novelties
  FROM public.premium_entitlements
  WHERE exhibitor_id = p_exhibitor_id
    AND event_id = p_event_id
    AND revoked_at IS NULL;

  v_is_premium := v_max_novelties IS NOT NULL;
  IF NOT v_is_premium THEN
    v_max_novelties := 1;
  END IF;

  -- Compter les nouveautés existantes (hors rejected)
  SELECT COUNT(*) INTO v_current_count
  FROM public.novelties
  WHERE exhibitor_id = p_exhibitor_id
    AND event_id = p_event_id
    AND status IN ('draft', 'pending', 'under_review', 'published');

  -- Vérifier le quota
  IF v_current_count >= v_max_novelties THEN
    RETURN jsonb_build_object(
      'error', true,
      'code', 'QUOTA_EXCEEDED',
      'message', CASE WHEN v_is_premium 
        THEN format('Limite atteinte: %s nouveauté(s) maximum pour votre forfait Premium.', v_max_novelties)
        ELSE 'Plan gratuit: 1 nouveauté maximum par exposant et par événement. Passez au forfait Premium pour en publier davantage.'
      END,
      'current', v_current_count,
      'limit', v_max_novelties
    );
  END IF;

  -- Insérer la nouveauté (dans le même transaction, donc atomique avec le lock)
  INSERT INTO public.novelties (
    event_id, exhibitor_id, title, type, reason_1,
    media_urls, images_count, doc_url, stand_info,
    created_by, status, pending_exhibitor_id
  ) VALUES (
    p_event_id, p_exhibitor_id, trim(p_title), p_type, trim(p_reason),
    p_images, array_length(p_images, 1), p_brochure_pdf, p_stand_info,
    p_created_by, 'draft', p_pending_exhibitor_id
  )
  RETURNING id, title INTO v_inserted_id, v_inserted_title;

  RETURN jsonb_build_object(
    'error', false,
    'id', v_inserted_id,
    'title', v_inserted_title,
    'pending_exhibitor_id', p_pending_exhibitor_id
  );
END;
$$;
