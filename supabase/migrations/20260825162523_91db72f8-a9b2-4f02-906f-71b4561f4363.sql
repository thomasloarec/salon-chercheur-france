CREATE OR REPLACE FUNCTION public.load_participations_from_staging(p_session_id uuid)
 RETURNS TABLE(upserted integer, rejected integer, inserted integer, updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  v_upserted     integer := 0;
  v_inserted     integer := 0;
  v_updated      integer := 0;
  v_rej_event    integer := 0;
  v_rej_exposant integer := 0;
BEGIN
  DELETE FROM participation_import_errors WHERE import_session_id = p_session_id;

  DROP TABLE IF EXISTS _web2exp;
  CREATE TEMP TABLE _web2exp ON COMMIT DROP AS
  SELECT DISTINCT ON (nw) nw, id_exposant
  FROM (
    SELECT e.id_exposant, normalize_domain(e.website_exposant) AS nw,
           CASE WHEN pe.id_exposant IS NOT NULL THEN 0 ELSE 1 END AS rnk
    FROM exposants e
    LEFT JOIN (SELECT DISTINCT id_exposant FROM participation) pe ON pe.id_exposant = e.id_exposant
    WHERE e.website_exposant IS NOT NULL AND btrim(e.website_exposant) <> ''
  ) z
  WHERE nw IS NOT NULL
  ORDER BY nw, rnk, id_exposant;
  CREATE INDEX ON _web2exp (nw);

  DROP TABLE IF EXISTS _existing;
  CREATE TEMP TABLE _existing ON COMMIT DROP AS
  SELECT DISTINCT ON (nw, id_event_text) nw, id_event_text, id_exposant
  FROM (
    SELECT normalize_domain(website_exposant) AS nw, id_event_text, id_exposant, first_seen_at
    FROM participation
    WHERE website_exposant IS NOT NULL AND btrim(website_exposant) <> '' AND id_event_text IS NOT NULL
  ) q
  WHERE nw IS NOT NULL
  ORDER BY nw, id_event_text, first_seen_at ASC;
  CREATE INDEX ON _existing (nw, id_event_text);

  -- ====== AJOUT GARDE-FOU : correspondance variante -> canonique ======
  DROP TABLE IF EXISTS _alias;
  CREATE TEMP TABLE _alias ON COMMIT DROP AS
  SELECT e.id_exposant AS variant_key, c.id_exposant AS canonical_key
  FROM exposants e
  JOIN exposants c ON c.id = e.canonical_id
  WHERE e.canonical_id IS NOT NULL;
  CREATE INDEX ON _alias (variant_key);
  -- ===================================================================

  -- Rejet: événement inconnu (journalisation idempotente)
  INSERT INTO participation_import_errors
    (import_session_id, record_id, id_event, urlexpo_event, website_exposant, nom_exposant, stand_exposant, reason, created_at)
  SELECT p_session_id, s.airtable_record_id, NULL, s.urlexpo_event, s.website_exposant, s.nom_exposant, s.stand_exposant,
         'event introuvable: ' || COALESCE(NULLIF(s.id_event_text,''), '(vide)'), now()
  FROM staging_participation_import s
  WHERE s.import_session_id = p_session_id
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.id_event = s.id_event_text)
  ON CONFLICT (record_id) DO UPDATE SET
    import_session_id = EXCLUDED.import_session_id, id_event = EXCLUDED.id_event,
    urlexpo_event = EXCLUDED.urlexpo_event, website_exposant = EXCLUDED.website_exposant,
    nom_exposant = EXCLUDED.nom_exposant, stand_exposant = EXCLUDED.stand_exposant,
    reason = EXCLUDED.reason, created_at = EXCLUDED.created_at;
  GET DIAGNOSTICS v_rej_event = ROW_COUNT;

  -- Rejet: website non résolu (journalisation idempotente)
  INSERT INTO participation_import_errors
    (import_session_id, record_id, id_event, urlexpo_event, website_exposant, nom_exposant, stand_exposant, reason, created_at)
  SELECT p_session_id, s.airtable_record_id, NULL, s.urlexpo_event, s.website_exposant, s.nom_exposant, s.stand_exposant,
         'exposant introuvable pour website: ' || COALESCE(NULLIF(s.website_exposant,''), '(vide)'), now()
  FROM staging_participation_import s
  WHERE s.import_session_id = p_session_id
    AND EXISTS (SELECT 1 FROM events e WHERE e.id_event = s.id_event_text)
    AND NOT EXISTS (SELECT 1 FROM _existing x WHERE x.nw = normalize_domain(s.website_exposant) AND x.id_event_text = s.id_event_text)
    AND NOT EXISTS (SELECT 1 FROM _web2exp w WHERE w.nw = normalize_domain(s.website_exposant))
  ON CONFLICT (record_id) DO UPDATE SET
    import_session_id = EXCLUDED.import_session_id, id_event = EXCLUDED.id_event,
    urlexpo_event = EXCLUDED.urlexpo_event, website_exposant = EXCLUDED.website_exposant,
    nom_exposant = EXCLUDED.nom_exposant, stand_exposant = EXCLUDED.stand_exposant,
    reason = EXCLUDED.reason, created_at = EXCLUDED.created_at;
  GET DIAGNOSTICS v_rej_exposant = ROW_COUNT;

  WITH resolved AS (
    SELECT
      -- ====== AJOUT GARDE-FOU : redirection vers le canonique ======
      COALESCE(a.canonical_key, COALESCE(x.id_exposant, w.id_exposant)) AS id_exposant,
      -- =============================================================
      s.id_event_text, e.id AS id_event,
      NULLIF(s.website_exposant, '')  AS website_exposant,
      NULLIF(s.stand_exposant, '')    AS stand_exposant,
      NULLIF(s.urlexpo_event, '')     AS urlexpo_event,
      s.ingested_at
    FROM staging_participation_import s
    JOIN events e ON e.id_event = s.id_event_text
    LEFT JOIN _existing x ON x.nw = normalize_domain(s.website_exposant) AND x.id_event_text = s.id_event_text
    LEFT JOIN _web2exp w ON w.nw = normalize_domain(s.website_exposant)
    LEFT JOIN _alias a ON a.variant_key = COALESCE(x.id_exposant, w.id_exposant)
    WHERE s.import_session_id = p_session_id
      AND COALESCE(x.id_exposant, w.id_exposant) IS NOT NULL
  ),
  clean AS (
    SELECT DISTINCT ON (id_exposant, id_event_text)
      id_exposant, id_event_text, id_event, website_exposant, stand_exposant, urlexpo_event
    FROM resolved
    ORDER BY id_exposant, id_event_text, ingested_at DESC
  ),
  up AS (
    INSERT INTO participation
      (id_exposant, id_event_text, id_event, website_exposant, stand_exposant, urlexpo_event, last_seen_at)
    SELECT id_exposant, id_event_text, id_event, website_exposant, stand_exposant, urlexpo_event, now()
    FROM clean
    ON CONFLICT (id_exposant, id_event_text) DO UPDATE SET
      id_event         = EXCLUDED.id_event,
      website_exposant = EXCLUDED.website_exposant,
      stand_exposant   = CASE WHEN participation.stand_locked
                              THEN participation.stand_exposant
                              ELSE EXCLUDED.stand_exposant END,
      urlexpo_event    = EXCLUDED.urlexpo_event,
      last_seen_at     = now()
    WHERE participation.source <> 'organizer'
    RETURNING (xmax::text::bigint = 0) AS was_inserted
  )
  SELECT count(*)::int,
         count(*) FILTER (WHERE was_inserted)::int,
         count(*) FILTER (WHERE NOT was_inserted)::int
  INTO v_upserted, v_inserted, v_updated
  FROM up;

  RETURN QUERY SELECT v_upserted, (v_rej_event + v_rej_exposant), v_inserted, v_updated;
END;
$function$;