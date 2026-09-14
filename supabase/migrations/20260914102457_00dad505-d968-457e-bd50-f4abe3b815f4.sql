ALTER TABLE public.staging_organizer_exhibitors
  ADD COLUMN IF NOT EXISTS raw_description text;

COMMENT ON COLUMN public.staging_organizer_exhibitors.raw_description IS
  'Description brute de l''exposant telle que fournie par l''organisateur dans le fichier d''import.';

CREATE OR REPLACE FUNCTION public.organizer_stage_lines(
  p_import_id uuid,
  p_rows      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_total    int;
  v_stats    jsonb;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'organizer_stage_lines: admin ou service_role uniquement';
  END IF;

  SELECT event_id INTO v_event_id
  FROM organizer_exhibitor_imports
  WHERE id = p_import_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'organizer_stage_lines: import % introuvable', p_import_id;
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'organizer_stage_lines: p_rows doit etre un tableau JSON';
  END IF;

  DELETE FROM staging_organizer_exhibitors WHERE import_id = p_import_id;

  INSERT INTO staging_organizer_exhibitors (
    import_id, event_id, line_no,
    raw_id_exposant, raw_nom, raw_stand, raw_website, raw_description,
    nom_normalized, domain_full, domain_registrable, parse_flag
  )
  SELECT
    p_import_id,
    v_event_id,
    (r->>'line_no')::int,
    NULLIF(btrim(COALESCE(r->>'raw_id_exposant','')), ''),
    NULLIF(btrim(COALESCE(r->>'raw_nom','')), ''),
    NULLIF(btrim(COALESCE(r->>'raw_stand','')), ''),
    NULLIF(btrim(COALESCE(r->>'raw_website','')), ''),
    NULLIF(btrim(COALESCE(r->>'raw_description','')), ''),
    NULLIF(btrim(COALESCE(r->>'nom_normalized','')), ''),
    NULLIF(btrim(COALESCE(r->>'domain_full','')), ''),
    public.registrable_domain(NULLIF(btrim(COALESCE(r->>'domain_full','')), '')),
    COALESCE(NULLIF(r->>'parse_flag',''), 'ok')
  FROM jsonb_array_elements(p_rows) AS r;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  UPDATE staging_organizer_exhibitors s
  SET matched_id_exposant = c.id_exposant,
      match_reason = 'id_exposant fourni non canonique, redirige vers ' || c.id_exposant
  FROM exposants e
  JOIN exposants c ON c.id = e.canonical_id
  WHERE s.import_id = p_import_id
    AND s.parse_flag = 'ok'
    AND s.raw_id_exposant IS NOT NULL
    AND e.id_exposant = s.raw_id_exposant
    AND e.is_canonical = false
    AND e.canonical_id IS NOT NULL;

  UPDATE staging_organizer_exhibitors s
  SET parse_flag = 'id_not_yet_synced',
      match_reason = 'id_exposant absent de la base, fiche Airtable pas encore synchronisee'
  WHERE s.import_id = p_import_id
    AND s.parse_flag = 'ok'
    AND s.raw_id_exposant IS NOT NULL
    AND s.raw_id_exposant ~ '^Exporec[A-Za-z0-9]{10,}$'
    AND NOT EXISTS (SELECT 1 FROM exposants e WHERE e.id_exposant = s.raw_id_exposant);

  UPDATE staging_organizer_exhibitors s
  SET parse_flag = 'bad_id_exposant',
      match_reason = 'id_exposant de forme inattendue, ignore'
  WHERE s.import_id = p_import_id
    AND s.parse_flag = 'ok'
    AND s.raw_id_exposant IS NOT NULL
    AND s.raw_id_exposant !~ '^Exporec[A-Za-z0-9]{10,}$'
    AND NOT EXISTS (SELECT 1 FROM exposants e WHERE e.id_exposant = s.raw_id_exposant);

  UPDATE staging_organizer_exhibitors s
  SET parse_flag = 'duplicate_line',
      match_reason = COALESCE(s.match_reason || ' | ', '')
                   || 'domaine deja present ligne ' || d.premiere_ligne
  FROM (
    SELECT id, first_value(line_no) OVER w AS premiere_ligne, line_no
    FROM staging_organizer_exhibitors
    WHERE import_id = p_import_id AND domain_registrable IS NOT NULL
    WINDOW w AS (PARTITION BY domain_registrable ORDER BY line_no)
  ) d
  WHERE s.id = d.id
    AND s.parse_flag = 'ok'
    AND d.line_no <> d.premiere_ligne;

  SELECT jsonb_build_object(
           'total', v_total,
           'par_flag', COALESCE(jsonb_object_agg(parse_flag, n), '{}'::jsonb)
         )
  INTO v_stats
  FROM (
    SELECT parse_flag, count(*) AS n
    FROM staging_organizer_exhibitors
    WHERE import_id = p_import_id
    GROUP BY parse_flag
  ) z;

  UPDATE organizer_exhibitor_imports
  SET status = 'parsed',
      parsed_at = now(),
      stats = v_stats
  WHERE id = p_import_id;

  RETURN v_stats;
END;
$$;

COMMENT ON FUNCTION public.organizer_stage_lines(uuid, jsonb) IS
  'Ingere les lignes nettoyees d''un fichier exposants organisateur dans staging_organizer_exhibitors. Calcule domain_registrable, valide l''id_exposant saisi, detecte les doublons internes. Idempotent : un second appel sur le meme import remplace les lignes.';
