-- 1. Alimentation : retrait du type du texte embarqué
CREATE OR REPLACE FUNCTION public.embed_pending_novelties(p_max_batches integer DEFAULT 4)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_texts jsonb; v_ids uuid[]; v_status int; v_content text; v_emb jsonb; i int;
  n_batches int := 0; v_total int := 0;
BEGIN
  DELETE FROM public.novelty_embeddings ne
  WHERE NOT EXISTS (
    SELECT 1 FROM public.novelties n
    WHERE n.id = ne.novelty_id
      AND n.status = 'published'
      AND n.is_test = false
  );

  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');

  LOOP
    EXIT WHEN n_batches >= p_max_batches;

    SELECT array_agg(id ORDER BY id), jsonb_agg(haystack ORDER BY id)
    INTO v_ids, v_texts
    FROM (
      SELECT n.id,
        trim(
          coalesce(n.title, '')    || ' ' ||
          coalesce(n.summary, '')  || ' ' ||
          coalesce(n.reason_1, '') || ' ' ||
          coalesce(n.reason_2, '') || ' ' ||
          coalesce(n.reason_3, '') || ' ' ||
          coalesce(n.details, '')  || ' ' ||
          coalesce(array_to_string(n.audience_tags, ' '), '')
        ) AS haystack
      FROM public.novelties n
      LEFT JOIN public.novelty_embeddings ne ON ne.novelty_id = n.id
      WHERE n.status = 'published'
        AND n.is_test = false
        AND length(trim(coalesce(n.title, '') || coalesce(n.reason_1, ''))) >= 20
        AND (
          ne.novelty_id IS NULL
          OR (n.updated_at IS NOT NULL AND n.updated_at > ne.embedded_at)
        )
      ORDER BY n.id
      LIMIT 96
    ) s;

    EXIT WHEN v_ids IS NULL;

    SELECT r.status, r.content INTO v_status, v_content
    FROM extensions.http((
      'POST', 'https://api.cohere.com/v2/embed',
      ARRAY[extensions.http_header('Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'COHERE_KEY'))],
      'application/json',
      jsonb_build_object(
        'model', 'embed-v4.0',
        'input_type', 'search_document',
        'embedding_types', jsonb_build_array('float'),
        'output_dimension', 1024,
        'texts', v_texts
      )::text
    )::extensions.http_request) r;

    IF v_status <> 200 THEN
      RAISE WARNING 'embed_pending_novelties: Cohere status % : %', v_status, left(v_content, 200);
      EXIT;
    END IF;

    v_emb := v_content::jsonb -> 'embeddings' -> 'float';

    FOR i IN 1 .. array_length(v_ids, 1) LOOP
      INSERT INTO public.novelty_embeddings (novelty_id, embedding, embedded_at)
      VALUES (v_ids[i], ((v_emb -> (i - 1))::text)::public.vector, now())
      ON CONFLICT (novelty_id) DO UPDATE
        SET embedding = excluded.embedding, embedded_at = now();
    END LOOP;

    v_total := v_total + array_length(v_ids, 1);
    n_batches := n_batches + 1;
  END LOOP;

  RETURN v_total;
END $function$;

REVOKE EXECUTE ON FUNCTION public.embed_pending_novelties(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.embed_pending_novelties(integer) TO service_role, postgres;

-- 2. Recherche : type devient filtre exact
DROP FUNCTION IF EXISTS public.match_novelties_semantic(text, uuid, boolean, double precision, integer);

CREATE OR REPLACE FUNCTION public.match_novelties_semantic(
  p_query          text,
  p_event_id       uuid    DEFAULT NULL,
  p_type           text    DEFAULT NULL,
  p_upcoming_only  boolean DEFAULT true,
  p_threshold      double precision DEFAULT 0.32,
  p_k              integer DEFAULT 20
)
RETURNS TABLE(
  novelty_id     uuid,
  novelty_slug   text,
  title          text,
  novelty_type   text,
  resume         text,
  reason_1       text,
  reason_2       text,
  reason_3       text,
  exhibitor_name text,
  exhibitor_slug text,
  event_name     text,
  event_slug     text,
  event_date     date,
  event_ville    text,
  has_document   boolean,
  similarity     double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_qvec public.vector(1024);
  v_k    int := LEAST(GREATEST(coalesce(p_k, 20), 1), 50);
  c_margin constant double precision := 0.08;
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) = 0 THEN
    RETURN;
  END IF;

  v_qvec := public.cohere_embed_query(p_query);

  RETURN QUERY
  WITH cand AS (
    SELECT
      n.id, n.slug, n.title, n.type,
      coalesce(nullif(trim(n.summary), ''), n.reason_1) AS res,
      n.reason_1, n.reason_2, n.reason_3,
      ex.name, ex.slug AS exslug,
      ev.nom_event, ev.slug AS evslug, ev.date_debut::date, ev.ville,
      (n.doc_url IS NOT NULL OR n.resource_url IS NOT NULL) AS hasdoc,
      (1 - (ne.embedding <=> v_qvec))::double precision AS sim
    FROM public.novelty_embeddings ne
    JOIN public.novelties  n  ON n.id  = ne.novelty_id
    JOIN public.events     ev ON ev.id = n.event_id
    JOIN public.exhibitors ex ON ex.id = n.exhibitor_id
    WHERE n.status = 'published'
      AND n.is_test = false
      AND ev.visible = true
      AND ev.is_test = false
      AND (p_event_id IS NULL OR n.event_id = p_event_id)
      AND (p_type     IS NULL OR n.type     = p_type)
      AND (p_upcoming_only = false OR ev.date_debut >= current_date)
  ),
  mx AS (SELECT max(sim) AS m FROM cand)
  SELECT cand.id, cand.slug, cand.title, cand.type, cand.res,
         cand.reason_1, cand.reason_2, cand.reason_3,
         cand.name, cand.exslug,
         cand.nom_event, cand.evslug, cand.date_debut, cand.ville,
         cand.hasdoc, cand.sim
  FROM cand, mx
  WHERE cand.sim >= GREATEST(p_threshold, mx.m - c_margin)
  ORDER BY cand.sim DESC
  LIMIT v_k;
END $function$;

GRANT EXECUTE ON FUNCTION public.match_novelties_semantic(text, uuid, text, boolean, double precision, integer)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.match_novelties_semantic IS
  'Recherche sémantique sur les Nouveautés publiées. p_type filtre exactement sur Launch/Update/Demo/Special_Offer/Partnership/Innovation. Renvoie des lignes individuelles uniquement.';

-- 3. Ré-embarquement forcé (antidate)
UPDATE public.novelty_embeddings SET embedded_at = 'epoch'::timestamptz;