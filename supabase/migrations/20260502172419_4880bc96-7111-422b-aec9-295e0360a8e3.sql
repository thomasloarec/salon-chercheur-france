-- Replace scan_event_duplicates with stricter logic
CREATE OR REPLACE FUNCTION public.scan_event_duplicates(p_kind text, p_id uuid, p_persist boolean DEFAULT true)
 RETURNS TABLE(out_matched_kind text, out_matched_id uuid, out_matched_id_event text, out_matched_nom text, out_matched_date_debut date, out_matched_date_fin date, out_matched_url text, out_matched_visible boolean, out_score integer, out_match_level text, out_reasons jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_nom text;
  v_dd date;
  v_df date;
  v_url_norm text;
  v_domain text;
  v_ville text;
  v_lieu text;
  v_id_event text;
  v_best_status text := 'none';
  v_best_reason text := NULL;
  v_best_score integer := 0;
BEGIN
  IF p_kind = 'event' THEN
    SELECT nom_event, date_debut, date_fin,
           public.normalize_event_url(url_site_officiel),
           public.normalize_event_domain(url_site_officiel),
           ville, nom_lieu, id_event
      INTO v_nom, v_dd, v_df, v_url_norm, v_domain, v_ville, v_lieu, v_id_event
    FROM public.events WHERE id = p_id;
  ELSIF p_kind = 'staging' THEN
    SELECT nom_event, date_debut, date_fin,
           public.normalize_event_url(url_site_officiel),
           public.normalize_event_domain(url_site_officiel),
           ville, nom_lieu, id_event
      INTO v_nom, v_dd, v_df, v_url_norm, v_domain, v_ville, v_lieu, v_id_event
    FROM public.staging_events_import WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Invalid kind: %', p_kind;
  END IF;

  IF v_nom IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      e.id,
      e.id_event,
      e.nom_event,
      e.date_debut,
      e.date_fin,
      e.url_site_officiel,
      e.url_site_officiel_normalized,
      e.url_site_officiel_domain,
      e.ville,
      e.nom_lieu,
      e.visible,
      -- name similarity
      extensions.similarity(lower(extensions.unaccent(coalesce(e.nom_event,''))), lower(extensions.unaccent(coalesce(v_nom,'')))) AS sim,
      -- URL / domain
      (v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm) AS same_url,
      (v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain) AS same_domain,
      -- dates
      (v_dd IS NOT NULL AND v_df IS NOT NULL AND e.date_debut = v_dd AND e.date_fin = v_df) AS same_dates,
      (v_dd IS NOT NULL AND e.date_debut IS NOT NULL
        AND e.date_debut <= COALESCE(v_df, v_dd) AND COALESCE(e.date_fin, e.date_debut) >= v_dd
        AND NOT (v_dd IS NOT NULL AND v_df IS NOT NULL AND e.date_debut = v_dd AND e.date_fin = v_df)
      ) AS overlap_dates,
      -- locations
      (v_ville IS NOT NULL AND e.ville IS NOT NULL
        AND lower(extensions.unaccent(e.ville)) = lower(extensions.unaccent(v_ville))) AS same_city,
      (v_lieu IS NOT NULL AND e.nom_lieu IS NOT NULL
        AND lower(extensions.unaccent(e.nom_lieu)) = lower(extensions.unaccent(v_lieu))) AS same_venue
    FROM public.events e
    WHERE NOT (p_kind = 'event' AND e.id = p_id)
      AND (
        -- only consider candidates that share a real identity signal
        (v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm)
        OR (v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain)
        OR (v_nom IS NOT NULL AND e.nom_event % v_nom)
      )
  ),
  scored AS (
    SELECT
      b.*,
      (
        CASE WHEN b.same_url THEN 45
             WHEN b.same_domain THEN 30
             ELSE 0 END
        + CASE WHEN b.sim >= 0.75 THEN 35
               WHEN b.sim >= 0.55 THEN 18
               ELSE 0 END
        + CASE WHEN b.same_dates THEN 25
               WHEN b.overlap_dates THEN 15
               ELSE 0 END
        + CASE WHEN b.same_venue THEN 15 ELSE 0 END
        + CASE WHEN b.same_city THEN 5 ELSE 0 END
      ) AS total,
      -- GUARD: keep only candidates with a real identity signal
      (
        b.same_url
        OR b.same_domain
        OR b.sim >= 0.70
        OR (b.sim >= 0.55 AND (b.same_city OR b.same_venue))
        OR (b.same_venue AND b.sim >= 0.55)
      ) AS keep_candidate
    FROM base b
  )
  SELECT
    'event'::text,
    s.id,
    s.id_event,
    s.nom_event,
    s.date_debut,
    s.date_fin,
    s.url_site_officiel,
    s.visible,
    s.total,
    CASE
      -- probable
      WHEN s.same_url AND s.same_dates THEN 'probable_duplicate'
      WHEN s.sim >= 0.75 AND s.same_dates AND (s.same_city OR s.same_venue) THEN 'probable_duplicate'
      WHEN s.same_domain AND s.same_dates AND s.sim >= 0.60 THEN 'probable_duplicate'
      -- potential
      WHEN s.same_url THEN 'potential_duplicate'
      WHEN s.same_domain AND s.sim >= 0.55 THEN 'potential_duplicate'
      WHEN s.sim >= 0.70 AND (s.same_dates OR s.overlap_dates) THEN 'potential_duplicate'
      WHEN s.sim >= 0.70 AND s.same_city THEN 'potential_duplicate'
      -- to_watch
      WHEN s.same_domain AND s.same_dates THEN 'to_watch'
      WHEN s.sim >= 0.55 AND s.same_dates THEN 'to_watch'
      WHEN s.same_venue AND s.sim >= 0.55 THEN 'to_watch'
      ELSE 'none'
    END,
    jsonb_build_object(
      'same_dates', s.same_dates,
      'overlap_dates', s.overlap_dates,
      'same_url', s.same_url,
      'same_domain', s.same_domain,
      'name_similarity', round(s.sim::numeric, 2),
      'same_city', s.same_city,
      'same_venue', s.same_venue
    )
  FROM scored s
  WHERE s.keep_candidate
    AND (
      s.same_url
      OR (s.same_domain AND (s.sim >= 0.55 OR s.same_dates))
      OR s.sim >= 0.70
      OR (s.sim >= 0.55 AND (s.same_city OR s.same_venue))
    )
  ORDER BY s.total DESC
  LIMIT 20;

  IF p_persist THEN
    DELETE FROM public.event_duplicate_candidates
    WHERE source_kind = p_kind AND source_id = p_id AND resolution IS NULL;

    INSERT INTO public.event_duplicate_candidates
      (source_kind, source_id, source_id_event, matched_kind, matched_id, matched_id_event,
       score, match_level, reasons)
    SELECT
      p_kind, p_id, v_id_event,
      r.out_matched_kind, r.out_matched_id, r.out_matched_id_event,
      r.out_score, r.out_match_level, r.out_reasons
    FROM public.scan_event_duplicates(p_kind, p_id, false) r
    WHERE r.out_match_level <> 'none'
      AND NOT EXISTS (
        SELECT 1 FROM public.event_duplicate_candidates c
        WHERE c.source_kind = p_kind AND c.source_id = p_id
          AND c.matched_kind = r.out_matched_kind AND c.matched_id = r.out_matched_id
          AND c.resolution = 'confirmed_distinct'
      )
    ON CONFLICT (source_kind, source_id, matched_kind, matched_id) DO UPDATE
      SET score = EXCLUDED.score,
          match_level = EXCLUDED.match_level,
          reasons = EXCLUDED.reasons,
          updated_at = now()
      WHERE event_duplicate_candidates.resolution IS NULL;

    SELECT
      CASE
        WHEN max(c.score) >= 80 THEN 'probable_duplicate'
        WHEN max(c.score) >= 55 THEN 'potential_duplicate'
        WHEN max(c.score) >= 40 THEN 'to_watch'
        ELSE 'none'
      END,
      max(c.score)
    INTO v_best_status, v_best_score
    FROM public.event_duplicate_candidates c
    WHERE c.source_kind = p_kind AND c.source_id = p_id AND c.resolution IS NULL;

    IF v_best_status IS NULL THEN v_best_status := 'none'; END IF;

    v_best_reason := CASE v_best_status
      WHEN 'probable_duplicate' THEN 'Doublon probable détecté'
      WHEN 'potential_duplicate' THEN 'Doublon potentiel détecté'
      WHEN 'to_watch' THEN 'Événement à vérifier'
      ELSE NULL END;

    IF p_kind = 'event' THEN
      UPDATE public.events
      SET duplicate_check_status = CASE
            WHEN duplicate_check_status IN ('confirmed_distinct','confirmed_duplicate') THEN duplicate_check_status
            ELSE v_best_status
          END,
          duplicate_check_reason = v_best_reason,
          duplicate_check_score = v_best_score,
          duplicate_check_at = now()
      WHERE id = p_id;
    ELSE
      UPDATE public.staging_events_import
      SET duplicate_check_status = v_best_status,
          duplicate_check_reason = v_best_reason,
          duplicate_check_score = v_best_score,
          duplicate_check_at = now()
      WHERE id = p_id;
    END IF;
  END IF;
END;
$function$;

-- Reset function: removes unresolved suggestions and resets detection statuses
CREATE OR REPLACE FUNCTION public.reset_event_duplicate_candidates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer := 0;
  v_reset_events integer := 0;
  v_reset_staging integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH deleted AS (
    DELETE FROM public.event_duplicate_candidates
    WHERE resolution IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  WITH upd AS (
    UPDATE public.events
    SET duplicate_check_status = 'none',
        duplicate_check_reason = NULL,
        duplicate_check_score = NULL,
        duplicate_check_at = now()
    WHERE duplicate_check_status NOT IN ('confirmed_distinct','confirmed_duplicate')
      AND (duplicate_check_status IS NOT NULL OR duplicate_check_score IS NOT NULL OR duplicate_check_reason IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*) INTO v_reset_events FROM upd;

  WITH upd2 AS (
    UPDATE public.staging_events_import
    SET duplicate_check_status = 'none',
        duplicate_check_reason = NULL,
        duplicate_check_score = NULL,
        duplicate_check_at = now()
    WHERE duplicate_check_status NOT IN ('confirmed_distinct','confirmed_duplicate')
      AND (duplicate_check_status IS NOT NULL OR duplicate_check_score IS NOT NULL OR duplicate_check_reason IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*) INTO v_reset_staging FROM upd2;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_candidates', v_deleted,
    'reset_events', v_reset_events + v_reset_staging
  );
END;
$function$;