-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Helpers de normalisation (immutable pour pouvoir indexer)
CREATE OR REPLACE FUNCTION public.normalize_event_url(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  IF p_url IS NULL THEN RETURN NULL; END IF;
  s := lower(trim(p_url));
  IF s = '' THEN RETURN NULL; END IF;
  s := regexp_replace(s, '^https?://', '');
  s := regexp_replace(s, '^www\.', '');
  -- retirer fragments
  s := split_part(s, '#', 1);
  -- retirer query string
  s := split_part(s, '?', 1);
  -- retirer slash final
  s := regexp_replace(s, '/+$', '');
  RETURN NULLIF(s, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_event_domain(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  s := public.normalize_event_url(p_url);
  IF s IS NULL THEN RETURN NULL; END IF;
  -- garder uniquement la partie domaine
  s := split_part(s, '/', 1);
  RETURN NULLIF(s, '');
END;
$$;

-- 3. Colonnes sur events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS duplicate_check_status text NOT NULL DEFAULT 'none'
    CHECK (duplicate_check_status IN ('none','potential_duplicate','probable_duplicate','to_watch','confirmed_distinct','confirmed_duplicate')),
  ADD COLUMN IF NOT EXISTS duplicate_check_reason text,
  ADD COLUMN IF NOT EXISTS duplicate_check_score integer,
  ADD COLUMN IF NOT EXISTS duplicate_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS url_site_officiel_normalized text GENERATED ALWAYS AS (public.normalize_event_url(url_site_officiel)) STORED,
  ADD COLUMN IF NOT EXISTS url_site_officiel_domain text GENERATED ALWAYS AS (public.normalize_event_domain(url_site_officiel)) STORED;

CREATE INDEX IF NOT EXISTS idx_events_dup_status ON public.events (duplicate_check_status) WHERE duplicate_check_status <> 'none';
CREATE INDEX IF NOT EXISTS idx_events_dup_domain ON public.events (url_site_officiel_domain);
CREATE INDEX IF NOT EXISTS idx_events_dup_dates ON public.events (date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_events_dup_name_trgm ON public.events USING gin (nom_event gin_trgm_ops);

-- 4. Colonnes sur staging_events_import (mêmes champs, defaults plus permissifs)
ALTER TABLE public.staging_events_import
  ADD COLUMN IF NOT EXISTS duplicate_check_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS duplicate_check_reason text,
  ADD COLUMN IF NOT EXISTS duplicate_check_score integer,
  ADD COLUMN IF NOT EXISTS duplicate_check_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_staging_events_dup_status ON public.staging_events_import (duplicate_check_status) WHERE duplicate_check_status <> 'none';

-- 5. Table de candidats (paires)
CREATE TABLE IF NOT EXISTS public.event_duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('event','staging')),
  source_id uuid NOT NULL,
  source_id_event text,
  matched_kind text NOT NULL CHECK (matched_kind IN ('event','staging')),
  matched_id uuid NOT NULL,
  matched_id_event text,
  score integer NOT NULL,
  match_level text NOT NULL CHECK (match_level IN ('to_watch','potential_duplicate','probable_duplicate')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution text CHECK (resolution IN ('confirmed_distinct','confirmed_duplicate')),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id, matched_kind, matched_id)
);

CREATE INDEX IF NOT EXISTS idx_edc_source ON public.event_duplicate_candidates (source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_edc_matched ON public.event_duplicate_candidates (matched_kind, matched_id);
CREATE INDEX IF NOT EXISTS idx_edc_unresolved ON public.event_duplicate_candidates (resolution) WHERE resolution IS NULL;

ALTER TABLE public.event_duplicate_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read duplicate candidates" ON public.event_duplicate_candidates;
CREATE POLICY "Admins can read duplicate candidates"
  ON public.event_duplicate_candidates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update duplicate candidates" ON public.event_duplicate_candidates;
CREATE POLICY "Admins can update duplicate candidates"
  ON public.event_duplicate_candidates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete duplicate candidates" ON public.event_duplicate_candidates;
CREATE POLICY "Admins can delete duplicate candidates"
  ON public.event_duplicate_candidates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- service_role bypasse via SECURITY DEFINER côté functions ; pas de policy INSERT publique

CREATE TRIGGER trg_edc_updated_at
  BEFORE UPDATE ON public.event_duplicate_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Fonction principale : analyser un seul événement (events ou staging) vs events
CREATE OR REPLACE FUNCTION public.scan_event_duplicates(
  p_kind text,        -- 'event' | 'staging'
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
SET search_path = public
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
  -- Charger l'événement source
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

  -- Calcul des candidats : on compare uniquement contre events (publiés ou hidden)
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
      -- composantes du score
      CASE WHEN v_dd IS NOT NULL AND v_df IS NOT NULL
            AND e.date_debut = v_dd AND e.date_fin = v_df THEN 40 ELSE 0 END AS s_dates,
      CASE WHEN v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm THEN 35
           WHEN v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain THEN 25
           ELSE 0 END AS s_url,
      CASE WHEN v_nom IS NOT NULL AND similarity(lower(unaccent(e.nom_event)), lower(unaccent(v_nom))) >= 0.7 THEN 25
           WHEN v_nom IS NOT NULL AND similarity(lower(unaccent(e.nom_event)), lower(unaccent(v_nom))) >= 0.5 THEN 12
           ELSE 0 END AS s_name,
      CASE WHEN v_ville IS NOT NULL AND e.ville IS NOT NULL
            AND lower(unaccent(e.ville)) = lower(unaccent(v_ville)) THEN 10 ELSE 0 END AS s_city,
      similarity(lower(unaccent(coalesce(e.nom_event,''))), lower(unaccent(coalesce(v_nom,'')))) AS sim
    FROM public.events e
    WHERE NOT (p_kind = 'event' AND e.id = p_id)
      AND (
        -- au moins un signal fort pour limiter la cardinalité
        (v_dd IS NOT NULL AND v_df IS NOT NULL AND e.date_debut = v_dd AND e.date_fin = v_df)
        OR (v_url_norm IS NOT NULL AND e.url_site_officiel_normalized = v_url_norm)
        OR (v_domain IS NOT NULL AND e.url_site_officiel_domain = v_domain)
        OR (v_nom IS NOT NULL AND e.nom_event % v_nom)
      )
  ),
  scored AS (
    SELECT *,
      (s_dates + s_url + s_name + s_city) AS total
    FROM base
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

  -- Persister si demandé
  IF p_persist THEN
    -- Effacer les anciens candidats non résolus pour cette source
    DELETE FROM public.event_duplicate_candidates
    WHERE source_kind = p_kind
      AND source_id = p_id
      AND resolution IS NULL;

    -- Réinsérer les nouveaux (en respectant les paires confirmées : on ne touche pas aux résolus)
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

    -- Mettre à jour le statut résumé sur la table source
    SELECT
      CASE
        WHEN max(score) >= 80 THEN 'probable_duplicate'
        WHEN max(score) >= 55 THEN 'potential_duplicate'
        WHEN max(score) >= 40 THEN 'to_watch'
        ELSE 'none'
      END,
      max(score),
      (SELECT string_agg(distinct r, ' · ') FROM (
        SELECT CASE
          WHEN (reasons->>'same_url')::boolean = true THEN 'même URL officielle'
          WHEN (reasons->>'same_domain')::boolean = true THEN 'même domaine'
          ELSE NULL END AS r
        FROM public.event_duplicate_candidates
        WHERE source_kind = p_kind AND source_id = p_id AND resolution IS NULL
      ) sub WHERE r IS NOT NULL)
    INTO v_best_status, v_best_score, v_best_reason
    FROM public.event_duplicate_candidates
    WHERE source_kind = p_kind AND source_id = p_id AND resolution IS NULL;

    IF v_best_status IS NULL THEN v_best_status := 'none'; END IF;

    -- Construire une raison concise complémentaire
    IF v_best_reason IS NULL OR v_best_reason = '' THEN
      v_best_reason := CASE v_best_status
        WHEN 'probable_duplicate' THEN 'Doublon probable détecté'
        WHEN 'potential_duplicate' THEN 'Doublon potentiel détecté'
        WHEN 'to_watch' THEN 'Événement à vérifier'
        ELSE NULL END;
    ELSE
      v_best_reason := initcap(v_best_status) || ' — ' || v_best_reason;
    END IF;

    IF p_kind = 'event' THEN
      UPDATE public.events
      SET duplicate_check_status = CASE
            -- ne pas écraser une décision admin
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

-- 7. Recalcul de masse
CREATE OR REPLACE FUNCTION public.rebuild_event_duplicate_candidates(p_only_future boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  -- Events
  FOR r IN
    SELECT id FROM public.events
    WHERE (NOT p_only_future) OR (date_debut IS NULL OR date_debut >= CURRENT_DATE)
  LOOP
    PERFORM public.scan_event_duplicates('event', r.id, true);
    v_count := v_count + 1;
  END LOOP;

  -- Staging
  FOR r IN
    SELECT id FROM public.staging_events_import
    WHERE (NOT p_only_future) OR (date_debut IS NULL OR date_debut >= CURRENT_DATE)
  LOOP
    PERFORM public.scan_event_duplicates('staging', r.id, true);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'scanned', v_count, 'only_future', p_only_future);
END;
$$;

-- 8. Sécuriser l'exécution : seul le service_role / admin peut appeler le rebuild via RPC depuis le front
REVOKE ALL ON FUNCTION public.rebuild_event_duplicate_candidates(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_event_duplicate_candidates(boolean) TO authenticated;
-- on filtre côté fonction :
CREATE OR REPLACE FUNCTION public.rebuild_event_duplicate_candidates(p_only_future boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR r IN
    SELECT id FROM public.events
    WHERE (NOT p_only_future) OR (date_debut IS NULL OR date_debut >= CURRENT_DATE)
  LOOP
    PERFORM public.scan_event_duplicates('event', r.id, true);
    v_count := v_count + 1;
  END LOOP;

  FOR r IN
    SELECT id FROM public.staging_events_import
    WHERE (NOT p_only_future) OR (date_debut IS NULL OR date_debut >= CURRENT_DATE)
  LOOP
    PERFORM public.scan_event_duplicates('staging', r.id, true);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'scanned', v_count, 'only_future', p_only_future);
END;
$$;
