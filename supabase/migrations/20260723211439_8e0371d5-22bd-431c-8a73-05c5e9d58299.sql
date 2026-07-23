CREATE TABLE IF NOT EXISTS public.event_embeddings (
  event_id    uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  embedding   public.vector(1024) NOT NULL,
  embedded_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.event_embeddings TO service_role;

CREATE INDEX IF NOT EXISTS idx_event_embeddings_hnsw
  ON public.event_embeddings
  USING hnsw (embedding public.vector_cosine_ops);

ALTER TABLE public.event_embeddings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_embeddings IS
  'Index sémantique des salons, construit sur leur propre description. Permet de trouver un salon même sans exposant indexé. Ne détermine PAS le rang : voir match_events_semantic.';

CREATE OR REPLACE FUNCTION public.embed_pending_events(p_max_batches integer DEFAULT 6)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_texts jsonb; v_ids uuid[]; v_status int; v_content text; v_emb jsonb; i int;
  n_batches int := 0; v_total int := 0;
BEGIN
  DELETE FROM public.event_embeddings ee
  WHERE NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = ee.event_id
      AND e.visible = true
      AND COALESCE(e.is_test, false) = false
  );

  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');

  LOOP
    EXIT WHEN n_batches >= p_max_batches;

    SELECT array_agg(id ORDER BY id), jsonb_agg(haystack ORDER BY id)
    INTO v_ids, v_texts
    FROM (
      SELECT e.id,
        trim(
          coalesce(e.nom_event, '') || '. ' ||
          left(coalesce(nullif(trim(e.description_enrichie), ''),
                        nullif(trim(e.description_event), ''), ''), 2000) || ' ' ||
          coalesce((SELECT string_agg(v, ' ') FROM jsonb_array_elements_text(
                      CASE WHEN jsonb_typeof(e.secteur) = 'array' THEN e.secteur ELSE '[]'::jsonb END) v), '') || ' ' ||
          coalesce((SELECT string_agg(v, ' ') FROM jsonb_array_elements_text(
                      CASE WHEN jsonb_typeof(e.suggested_keywords) = 'array' THEN e.suggested_keywords ELSE '[]'::jsonb END) v), '')
        ) AS haystack
      FROM public.events e
      LEFT JOIN public.event_embeddings ee ON ee.event_id = e.id
      WHERE e.visible = true
        AND COALESCE(e.is_test, false) = false
        AND length(trim(coalesce(e.nom_event, '') ||
                        coalesce(e.description_enrichie, e.description_event, ''))) >= 40
        AND (
          ee.event_id IS NULL
          OR (e.updated_at IS NOT NULL AND e.updated_at > ee.embedded_at)
        )
      ORDER BY e.id
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
      RAISE WARNING 'embed_pending_events: Cohere status % : %', v_status, left(v_content, 200);
      EXIT;
    END IF;

    v_emb := v_content::jsonb -> 'embeddings' -> 'float';

    FOR i IN 1 .. array_length(v_ids, 1) LOOP
      INSERT INTO public.event_embeddings (event_id, embedding, embedded_at)
      VALUES (v_ids[i], ((v_emb -> (i - 1))::text)::public.vector, now())
      ON CONFLICT (event_id) DO UPDATE
        SET embedding = excluded.embedding, embedded_at = now();
    END LOOP;

    v_total := v_total + array_length(v_ids, 1);
    n_batches := n_batches + 1;
  END LOOP;

  RETURN v_total;
END $function$;

REVOKE EXECUTE ON FUNCTION public.embed_pending_events(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.embed_pending_events(integer) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.match_events_semantic(
  p_query         text    DEFAULT NULL,
  p_ville         text    DEFAULT NULL,
  p_upcoming_only boolean DEFAULT true,
  p_date_max      date    DEFAULT NULL,
  p_threshold     double precision DEFAULT 0.32,
  p_k             integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_qvec public.vector(1024);
  v_mode text;
  v_k    int := LEAST(GREATEST(coalesce(p_k, 12), 1), 30);
  v_exploitables jsonb;
  v_peu_couverts jsonb;
  c_seuil_exploitable constant int := 10;
  c_margin constant double precision := 0.10;
BEGIN
  v_mode := CASE WHEN p_query IS NULL OR length(trim(p_query)) < 3 THEN 'filtre' ELSE 'semantique' END;

  IF v_mode = 'semantique' THEN
    v_qvec := public.cohere_embed_query(p_query);
  END IF;

  WITH base AS (
    SELECT e.id, e.nom_event, e.slug, e.ville, e.date_debut, e.date_fin,
           (e.date_debut >= current_date) AS a_venir,
           (SELECT count(DISTINCT p.id_exposant) FROM participation p WHERE p.id_event = e.id)::int AS n_exp,
           CASE WHEN v_mode = 'semantique'
                THEN (1 - (ee.embedding <=> v_qvec))::double precision
                ELSE NULL END AS sim
    FROM public.events e
    JOIN public.event_embeddings ee ON ee.event_id = e.id
    WHERE e.visible = true
      AND COALESCE(e.is_test, false) = false
      AND (p_upcoming_only = false OR e.date_debut >= current_date)
      AND (p_date_max IS NULL OR e.date_debut <= p_date_max)
      AND (p_ville IS NULL OR e.ville ILIKE '%'||trim(p_ville)||'%')
  ),
  mx AS (SELECT max(sim) AS m FROM base),
  retenus AS (
    SELECT b.* FROM base b, mx
    WHERE v_mode = 'filtre'
       OR b.sim >= GREATEST(p_threshold, mx.m - c_margin)
    ORDER BY
      CASE WHEN v_mode = 'filtre' THEN NULL ELSE b.sim END DESC NULLS LAST,
      b.n_exp DESC,
      b.date_debut ASC
    LIMIT v_k
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'nom', r.nom_event, 'slug', r.slug, 'ville', r.ville,
      'date_debut', r.date_debut, 'date_fin', r.date_fin, 'a_venir', r.a_venir,
      'nb_exposants_referenced', r.n_exp,
      'similarite', round(coalesce(r.sim, 0)::numeric, 3),
      'page_salon', '/events/'||r.slug
    )) FILTER (WHERE r.n_exp >= c_seuil_exploitable), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object(
      'nom', r.nom_event, 'slug', r.slug, 'ville', r.ville,
      'date_debut', r.date_debut, 'a_venir', r.a_venir,
      'nb_exposants_referenced', r.n_exp,
      'page_salon', '/events/'||r.slug
    )) FILTER (WHERE r.n_exp < c_seuil_exploitable), '[]'::jsonb)
  INTO v_exploitables, v_peu_couverts
  FROM retenus r;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'critere', jsonb_build_object(
      'sujet', nullif(trim(coalesce(p_query,'')), ''),
      'ville', nullif(trim(coalesce(p_ville,'')), ''),
      'a_venir_seulement', p_upcoming_only,
      'avant_le', p_date_max
    ),
    'salons_exploitables', v_exploitables,
    'salons_peu_couverts', v_peu_couverts,
    'note',
      'salons_exploitables : Lotexpo connaît assez d''exposants pour que la page du salon soit utile. '
      || 'Recommande CES salons en priorité et renvoie vers leur page. '
      || 'salons_peu_couverts : ces salons existent et correspondent au sujet, mais Lotexpo ne référence '
      || 'pas encore assez d''exposants pour en dire quelque chose d''utile. Tu peux les CITER pour ne pas '
      || 'laisser croire qu''ils n''existent pas, en précisant simplement que leur liste d''exposants n''est '
      || 'pas encore disponible sur Lotexpo. Ne les recommande pas, ne les place pas devant les exploitables, '
      || 'et n''explique PAS pourquoi la donnée manque. Ne renvoie JAMAIS vers un site externe, un site '
      || 'officiel de salon ou une source de presse : oriente le visiteur vers les salons exploitables.'
  );
END $function$;

REVOKE EXECUTE ON FUNCTION public.match_events_semantic(text, text, boolean, date, double precision, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.match_events_semantic(text, text, boolean, date, double precision, integer)
  TO anon, authenticated, service_role, postgres;

COMMENT ON FUNCTION public.match_events_semantic IS
  'Recherche de salons sur leur propre description. L''index détermine l''ÉLIGIBILITÉ, jamais le RANG : les salons dont Lotexpo connaît peu d''exposants sont renvoyés dans un tableau séparé et ne doivent pas être recommandés. Le critère de classement est l''utilité pour le visiteur (richesse des données disponibles), identique quelle que soit l''origine de la donnée. Aucun critère commercial n''intervient ni ne doit intervenir.';

SELECT cron.schedule(
  'embed-pending-events',
  '45 4 * * *',
  $cron$ SELECT public.embed_pending_events(6); $cron$
);