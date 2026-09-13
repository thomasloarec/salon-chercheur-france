-- Lot B V2 Lead Magnet : desambiguisation par candidats + resultat par identifiant exact.
-- Objets NOUVEAUX uniquement. leadmagnet_search reste inchange (compat tool actuel).
-- Applique via apply_migration le 2026-09-13 (version 20260913103656). Verifie empiriquement.

-- RPC 1 : liste de candidats pour l'etape de confirmation
CREATE OR REPLACE FUNCTION public.leadmagnet_resolve_candidates(p_query text, p_limit integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_q text := btrim(coalesce(p_query, ''));
  v_dom text;
  v_is_domain boolean := false;
  v_match_type text;
  v_candidates jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 10);
BEGIN
  IF length(v_q) < 2 THEN
    RETURN jsonb_build_object('query', p_query, 'match_type', 'empty', 'count', 0, 'candidates', '[]'::jsonb);
  END IF;

  v_is_domain := position('.' in v_q) > 0 AND position(' ' in v_q) = 0;

  -- Branche domaine : match exact sur normalized_domain
  IF v_is_domain THEN
    v_dom := regexp_replace(regexp_replace(lower(v_q), '^https?://', ''), '^www\.', '');
    v_dom := split_part(v_dom, '/', 1);
    SELECT coalesce(jsonb_agg(c ORDER BY c->>'nom'), '[]'::jsonb) INTO v_candidates
    FROM (
      SELECT jsonb_build_object(
        'id_exposant', ex.id_exposant,
        'nom', ex.nom_exposant,
        'domaine', coalesce(ex.normalized_domain, ex.website_exposant),
        'description', left(coalesce(ex.exposant_description, ''), 180),
        'similarity', 1.0,
        'has_upcoming', EXISTS (
          SELECT 1 FROM participation p JOIN events e ON e.id = p.id_event
          WHERE p.id_exposant = ex.id_exposant AND coalesce(e.visible, false) = true
            AND e.is_test = false AND coalesce(e.date_fin, e.date_debut) >= current_date
        )
      ) AS c
      FROM exposants ex
      WHERE ex.normalized_domain = v_dom
        AND coalesce(ex.is_canonical, true) = true
      LIMIT v_limit
    ) s;
    IF jsonb_array_length(v_candidates) > 0 THEN
      v_match_type := 'domain_exact';
    END IF;
  END IF;

  -- Branche nom : similarite trigram (fallback si pas de match domaine)
  IF v_candidates IS NULL OR jsonb_array_length(v_candidates) = 0 THEN
    SELECT coalesce(jsonb_agg(c ORDER BY (c->>'similarity')::numeric DESC), '[]'::jsonb) INTO v_candidates
    FROM (
      SELECT jsonb_build_object(
        'id_exposant', ex.id_exposant,
        'nom', ex.nom_exposant,
        'domaine', coalesce(ex.normalized_domain, ex.website_exposant),
        'description', left(coalesce(ex.exposant_description, ''), 180),
        'similarity', round(word_similarity(v_q, ex.nom_exposant)::numeric, 3),
        'has_upcoming', EXISTS (
          SELECT 1 FROM participation p JOIN events e ON e.id = p.id_event
          WHERE p.id_exposant = ex.id_exposant AND coalesce(e.visible, false) = true
            AND e.is_test = false AND coalesce(e.date_fin, e.date_debut) >= current_date
        )
      ) AS c
      FROM exposants ex
      WHERE coalesce(ex.is_canonical, true) = true
        AND ex.nom_exposant %> v_q
      ORDER BY word_similarity(v_q, ex.nom_exposant) DESC
      LIMIT v_limit
    ) s;
    v_match_type := 'name';
  END IF;

  IF v_candidates IS NULL OR jsonb_array_length(v_candidates) = 0 THEN
    RETURN jsonb_build_object('query', p_query, 'match_type', 'not_found', 'count', 0, 'candidates', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'query', p_query,
    'match_type', v_match_type,
    'count', jsonb_array_length(v_candidates),
    'candidates', v_candidates
  );
END $function$;

-- RPC 2 : resultat (salons + prospects) pour une societe CONFIRMEE par son id
CREATE OR REPLACE FUNCTION public.leadmagnet_result_by_id(p_id_exposant text, p_similar_limit integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_id text; v_name text; v_web text;
  v_own jsonb; v_similar jsonb; v_mode text;
  v_limit integer := least(greatest(coalesce(p_similar_limit, 6), 1), 12);
BEGIN
  SELECT ex.id_exposant, ex.nom_exposant, ex.website_exposant
    INTO v_id, v_name, v_web
  FROM exposants ex
  WHERE ex.id_exposant = p_id_exposant
    AND coalesce(ex.is_canonical, true) = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('query', p_id_exposant, 'resolved', NULL, 'mode', 'not_found',
                              'own_participations', '[]'::jsonb, 'similar_prospects', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(t.x ORDER BY t.d), '[]'::jsonb) INTO v_own
  FROM (
    SELECT jsonb_build_object(
             'event_id', e.id, 'nom_event', e.nom_event, 'ville', e.ville,
             'date_debut', e.date_debut, 'date_fin', e.date_fin, 'slug', e.slug,
             'stand', min(p.stand_exposant)
           ) AS x,
           min(e.date_debut) AS d
    FROM participation p
    JOIN events e ON e.id = p.id_event
    WHERE p.id_exposant = v_id
      AND coalesce(e.visible, false) = true
      AND e.is_test = false
      AND coalesce(e.date_fin, e.date_debut) >= current_date
    GROUP BY e.id, e.nom_event, e.ville, e.date_debut, e.date_fin, e.slug
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.similarity DESC), '[]'::jsonb) INTO v_similar
  FROM public.match_exhibitors_by_exhibitor(v_id, v_limit, true) m;

  v_mode := CASE WHEN jsonb_array_length(v_own) > 0 THEN 'found' ELSE 'prospects' END;

  RETURN jsonb_build_object(
    'query', v_name,
    'resolved', jsonb_build_object('id_exposant', v_id, 'nom', v_name, 'website', v_web),
    'mode', v_mode,
    'own_participations', v_own,
    'similar_prospects', v_similar
  );
END $function$;

-- Droits : on replique la politique des RPC soeurs (anon/authenticated/service_role)
GRANT EXECUTE ON FUNCTION public.leadmagnet_resolve_candidates(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leadmagnet_result_by_id(text, integer) TO anon, authenticated, service_role;

-- Rafraichit le cache de schema PostgREST apres DDL
NOTIFY pgrst, 'reload schema';
