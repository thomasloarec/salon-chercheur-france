CREATE OR REPLACE FUNCTION public.scan_event_duplicates(
  p_kind text,
  p_id uuid,
  p_persist boolean DEFAULT true
)
RETURNS TABLE (
  matched_kind text,
  matched_id uuid,
  matched_id_event text,
  matched_nom text,
  matched_date_debut date,
  matched_date_fin date,
  matched_url text,
  matched_visible boolean,
  score integer,
  match_level text,
  reasons jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_nom text;
  v_dd date;
  v_df date;
  v_url_norm text;
  v_domain text;
  v_ville text;
  v_id_event text;
  v_best_status text := 'none';
  v_best_reason text := NULL;
  v_best_score integer := 0;
BEGIN
  IF p_kind = 'event' THEN
    SELECT nom_event, date_debut, date_fin,
           public.normalize_event_url(url_site_officiel),
           public.normalize_event_domain(url_site_officiel),
           ville, id_event
      INTO v_nom, v_dd, v_df, v_url_norm, v_domain, v_ville, v_id_event
    FROM public.events WHERE id = p_id;
  ELSIF p_kind = 'staging' THEN
    SELECT nom_event, date_debut, date_fin,
           public.normalize_event_url(url_site_officiel),
           public.normalize_event_domain(url_site_officiel),
           ville, id_event
      INTO v_nom, v_dd, v_df, v_url_norm, v_domain, v_ville, v_id_event
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
      e.visible,
      CASE WHEN v_dd IS NOT NULL AND v_df IS NOT NULL
            AND e.date_debut = v_dd AND e.date_fin = v_df THEN 40 ELSE 0 END AS s_dates,
      CASE WHEN v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm THEN 35
           WHEN v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain THEN 25
           ELSE 0 END AS s_url,
      CASE WHEN v_nom IS NOT NULL AND extensions.similarity(lower(extensions.unaccent(e.nom_event)), lower(extensions.unaccent(v_nom))) >= 0.7 THEN 25
           WHEN v_nom IS NOT NULL AND extensions.similarity(lower(extensions.unaccent(e.nom_event)), lower(extensions.unaccent(v_nom))) >= 0.5 THEN 12
           ELSE 0 END AS s_name,
      CASE WHEN v_ville IS NOT NULL AND e.ville IS NOT NULL
            AND lower(extensions.unaccent(e.ville)) = lower(extensions.unaccent(v_ville)) THEN 10 ELSE 0 END AS s_city,
      extensions.similarity(lower(extensions.unaccent(coalesce(e.nom_event,''))), lower(extensions.unaccent(coalesce(v_nom,'')))) AS sim
    FROM public.events e
    WHERE NOT (p_kind = 'event' AND e.id = p_id)
      AND (
        (v_dd IS NOT NULL AND v_df IS NOT NULL AND e.date_debut = v_dd AND e.date_fin = v_df)
        OR (v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm)
        OR (v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain)
        OR (v_nom IS NOT NULL AND e.nom_event % v_nom)
      )
  ),
  scored AS (
    SELECT *, (s_dates + s_url + s_name + s_city) AS total FROM base
  )
  SELECT
    'event'::text, s.id, s.id_event, s.nom_event, s.date_debut, s.date_fin,
    s.url_site_officiel, s.visible, s.total,
    CASE
      WHEN s.total >= 80 THEN 'probable_duplicate'
      WHEN s.total >= 55 THEN 'potential_duplicate'
      WHEN s.total >= 40 THEN 'to_watch'
      ELSE 'none'
    END,
    jsonb_build_object(
      'same_dates', s.s_dates > 0,
      'same_url', s.s_url = 35,
      'same_domain', s.s_url = 25,
      'name_similarity', round(s.sim::numeric, 2),
      'same_city', s.s_city > 0
    )
  FROM scored s
  WHERE s.total >= 40
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
      r.matched_kind, r.matched_id, r.matched_id_event,
      r.score, r.match_level, r.reasons
    FROM public.scan_event_duplicates(p_kind, p_id, false) r
    WHERE r.match_level <> 'none'
      AND NOT EXISTS (
        SELECT 1 FROM public.event_duplicate_candidates c
        WHERE c.source_kind = p_kind AND c.source_id = p_id
          AND c.matched_kind = r.matched_kind AND c.matched_id = r.matched_id
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
$$;