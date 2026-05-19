CREATE OR REPLACE FUNCTION public.count_seo_enrichment_eligible()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total int;
  v_no_meta int;
  v_not_valid int;
  v_no_desc int;
  v_short_desc int;
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH base AS (
    SELECT
      *,
      (
        enrichissement_statut = 'valide'
        AND validation_mode = 'manual'
        AND coalesce(trim(meta_description_gen), '') <> ''
      ) AS manually_resolved_with_meta
    FROM public.events
    WHERE visible = true
      AND coalesce(is_test, false) = false
      AND slug IS NOT NULL AND slug <> ''
      AND date_debut >= CURRENT_DATE
  )
  SELECT count(*) INTO v_no_meta
  FROM base
  WHERE coalesce(trim(meta_description_gen), '') = '';

  WITH base AS (
    SELECT
      *,
      (
        enrichissement_statut = 'valide'
        AND validation_mode = 'manual'
        AND coalesce(trim(meta_description_gen), '') <> ''
      ) AS manually_resolved_with_meta
    FROM public.events
    WHERE visible = true
      AND coalesce(is_test, false) = false
      AND slug IS NOT NULL AND slug <> ''
      AND date_debut >= CURRENT_DATE
  )
  SELECT count(*) INTO v_not_valid
  FROM base
  WHERE NOT manually_resolved_with_meta
    AND (enrichissement_statut IS NULL OR enrichissement_statut <> 'valide');

  WITH base AS (
    SELECT
      *,
      (
        enrichissement_statut = 'valide'
        AND validation_mode = 'manual'
        AND coalesce(trim(meta_description_gen), '') <> ''
      ) AS manually_resolved_with_meta
    FROM public.events
    WHERE visible = true
      AND coalesce(is_test, false) = false
      AND slug IS NOT NULL AND slug <> ''
      AND date_debut >= CURRENT_DATE
  )
  SELECT count(*) INTO v_no_desc
  FROM base
  WHERE NOT manually_resolved_with_meta
    AND coalesce(trim(description_enrichie), '') = '';

  WITH base AS (
    SELECT
      *,
      (
        enrichissement_statut = 'valide'
        AND validation_mode = 'manual'
        AND coalesce(trim(meta_description_gen), '') <> ''
      ) AS manually_resolved_with_meta
    FROM public.events
    WHERE visible = true
      AND coalesce(is_test, false) = false
      AND slug IS NOT NULL AND slug <> ''
      AND date_debut >= CURRENT_DATE
  )
  SELECT count(*) INTO v_short_desc
  FROM base
  WHERE NOT manually_resolved_with_meta
    AND char_length(coalesce(description_event,'')) < 500;

  WITH base AS (
    SELECT
      *,
      (
        enrichissement_statut = 'valide'
        AND validation_mode = 'manual'
        AND coalesce(trim(meta_description_gen), '') <> ''
      ) AS manually_resolved_with_meta
    FROM public.events
    WHERE visible = true
      AND coalesce(is_test, false) = false
      AND slug IS NOT NULL AND slug <> ''
      AND date_debut >= CURRENT_DATE
  )
  SELECT count(*) INTO v_total
  FROM base
  WHERE NOT manually_resolved_with_meta
    AND (
      coalesce(trim(meta_description_gen), '') = ''
      OR enrichissement_statut IS NULL OR enrichissement_statut <> 'valide'
      OR coalesce(trim(description_enrichie), '') = ''
      OR char_length(coalesce(description_event,'')) < 500
    );

  RETURN jsonb_build_object(
    'total_eligible', v_total,
    'no_meta', v_no_meta,
    'not_valide_status', v_not_valid,
    'no_description_enrichie', v_no_desc,
    'short_description', v_short_desc
  );
END;
$function$;