-- Helper: extract distinct 4-digit years (2020-2040) from a text
CREATE OR REPLACE FUNCTION public.extract_event_years(p_text text)
RETURNS integer[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT array_agg(DISTINCT (m[1])::int ORDER BY (m[1])::int)
     FROM regexp_matches(COALESCE(p_text,''), '(20[2-4][0-9])', 'g') AS m),
    ARRAY[]::int[]
  );
$$;

-- Stricter scan_event_duplicates
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
  v_years int[];
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

  v_years := public.extract_event_years(v_nom);

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
      extensions.similarity(
        lower(extensions.unaccent(coalesce(e.nom_event,''))),
        lower(extensions.unaccent(coalesce(v_nom,'')))
      ) AS sim,
      (v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm) AS same_url,
      (v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain) AS same_domain,
      (v_dd IS NOT NULL AND v_df IS NOT NULL AND e.date_debut = v_dd AND e.date_fin = v_df) AS same_dates,
      (v_dd IS NOT NULL AND e.date_debut IS NOT NULL
        AND e.date_debut <= COALESCE(v_df, v_dd)
        AND COALESCE(e.date_fin, e.date_debut) >= v_dd
        AND NOT (v_df IS NOT NULL AND e.date_debut = v_dd AND e.date_fin = v_df)
      ) AS overlap_dates,
      (v_ville IS NOT NULL AND e.ville IS NOT NULL
        AND lower(extensions.unaccent(e.ville)) = lower(extensions.unaccent(v_ville))) AS same_city,
      (v_lieu IS NOT NULL AND e.nom_lieu IS NOT NULL
        AND lower(extensions.unaccent(e.nom_lieu)) = lower(extensions.unaccent(v_lieu))) AS same_venue,
      (v_ville IS NOT NULL AND e.ville IS NOT NULL
        AND lower(extensions.unaccent(e.ville)) <> lower(extensions.unaccent(v_ville))) AS diff_city,
      (v_lieu IS NOT NULL AND e.nom_lieu IS NOT NULL
        AND lower(extensions.unaccent(e.nom_lieu)) <> lower(extensions.unaccent(v_lieu))) AS diff_venue,
      public.extract_event_years(e.nom_event) AS years_other,
      ABS(COALESCE(e.date_debut - v_dd, 0)) AS days_apart
    FROM public.events e
    WHERE NOT (p_kind = 'event' AND e.id = p_id)
      AND (
        (v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm)
        OR (v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain)
        OR (v_nom IS NOT NULL AND e.nom_event % v_nom)
      )
  ),
  enriched AS (
    SELECT
      b.*,
      -- dates considered coherent: same dates OR overlap (and at least one date present on each side)
      (b.same_dates OR b.overlap_dates) AS dates_coherent,
      -- non-overlapping dates (both sides have dates and they don't touch)
      (v_dd IS NOT NULL AND b.date_debut IS NOT NULL
        AND NOT b.same_dates AND NOT b.overlap_dates) AS dates_disjoint,
      -- different explicit years in names
      (array_length(v_years,1) > 0
       AND array_length(b.years_other,1) > 0
       AND NOT (v_years && b.years_other)) AS diff_years
    FROM base b
  ),
  scored AS (
    SELECT
      e.*,
      (
        CASE WHEN e.same_url THEN 45
             WHEN e.same_domain THEN 15
             ELSE 0 END
        + CASE WHEN e.sim >= 0.92 THEN 40
               WHEN e.sim >= 0.78 THEN 30
               WHEN e.sim >= 0.60 THEN 18
               WHEN e.sim >= 0.45 THEN 8
               ELSE 0 END
        + CASE WHEN e.same_dates THEN 30
               WHEN e.overlap_dates THEN 20
               ELSE 0 END
        + CASE WHEN e.same_venue THEN 20 ELSE 0 END
        + CASE WHEN e.same_city AND NOT e.same_venue THEN 8 ELSE 0 END
        - CASE WHEN e.diff_city THEN 20 ELSE 0 END
        - CASE WHEN e.diff_venue AND NOT e.same_city THEN 15 ELSE 0 END
        - CASE WHEN e.dates_disjoint THEN 25 ELSE 0 END
        - CASE WHEN e.diff_years THEN 30 ELSE 0 END
      ) AS total,
      -- ====== STRICT CANDIDACY GUARD ======
      -- Reject "multi-city / network" pattern: same domain + close name but different city AND non-overlapping dates
      (
        NOT (e.same_domain AND e.diff_city AND e.dates_disjoint)
        -- Reject "annual edition" pattern: different years in names + dates more than 90 days apart
        AND NOT (e.diff_years AND e.days_apart > 90)
        AND (
          -- CASE A: exact URL + dates or location coherence
          (e.same_url AND (e.dates_coherent OR e.same_city OR e.same_venue))
          -- CASE B: same domain + close name + coherent dates + same location
          OR (e.same_domain AND e.sim >= 0.60 AND e.dates_coherent AND (e.same_city OR e.same_venue))
          -- CASE C: very close name + coherent dates + same location
          OR (e.sim >= 0.78 AND e.dates_coherent AND (e.same_city OR e.same_venue))
          -- CASE D: nearly identical name + (dates coherent OR same location)
          OR (e.sim >= 0.92 AND (e.dates_coherent OR e.same_city OR e.same_venue))
        )
      ) AS keep_candidate
    FROM enriched e
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
      WHEN s.total >= 85 THEN 'probable_duplicate'
      WHEN s.total >= 70 THEN 'potential_duplicate'
      WHEN s.total >= 60 THEN 'to_watch'
      ELSE 'none'
    END,
    jsonb_build_object(
      'same_dates', s.same_dates,
      'overlap_dates', s.overlap_dates,
      'same_url', s.same_url,
      'same_domain', s.same_domain,
      'name_similarity', round(s.sim::numeric, 2),
      'same_city', s.same_city,
      'same_venue', s.same_venue,
      'diff_city', s.diff_city,
      'diff_years', s.diff_years
    )
  FROM scored s
  WHERE s.keep_candidate
    AND s.total >= 60
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
        WHEN max(c.score) >= 85 THEN 'probable_duplicate'
        WHEN max(c.score) >= 70 THEN 'potential_duplicate'
        WHEN max(c.score) >= 60 THEN 'to_watch'
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