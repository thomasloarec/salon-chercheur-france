-- Lot 2 — Import listes exposants organisateur : ingestion des lignes normalisees.
--
-- Repartition des responsabilites :
--   Edge function organizer-import-parse (TS) : authentification, lecture du classeur,
--     nettoyage du texte et des URL, production de domain_full et nom_normalized.
--   Cette RPC (SQL) : insertion, calcul de domain_registrable via la fonction de reference,
--     detection des doublons internes au fichier, validation de l'id_exposant saisi.
--
-- registrable_domain() n'est JAMAIS reimplemente cote TypeScript : une seule source de verite.

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
  -- Garde-fou : claims JWT uniquement. auth.role() peut valoir NULL, d'ou le COALESCE.
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

  -- Re-parsing idempotent : on repart d'une ardoise propre pour cet import.
  DELETE FROM staging_organizer_exhibitors WHERE import_id = p_import_id;

  INSERT INTO staging_organizer_exhibitors (
    import_id, event_id, line_no,
    raw_id_exposant, raw_nom, raw_stand, raw_website,
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
    NULLIF(btrim(COALESCE(r->>'nom_normalized','')), ''),
    NULLIF(btrim(COALESCE(r->>'domain_full','')), ''),
    -- Seule source de verite pour le domaine enregistrable
    public.registrable_domain(NULLIF(btrim(COALESCE(r->>'domain_full','')), '')),
    COALESCE(NULLIF(r->>'parse_flag',''), 'ok')
  FROM jsonb_array_elements(p_rows) AS r;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  -- ----------------------------------------------------------
  -- Validation de l'id_exposant saisi manuellement.
  -- Les drapeaux poses par le nettoyage TS ne sont jamais ecrases :
  -- on ne traite que les lignes encore en 'ok'.
  -- ----------------------------------------------------------

  -- Cas 1 : identifiant connu mais non canonique -> redirection silencieuse, tracee
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

  -- Cas 2 : identifiant inconnu mais de forme Airtable valide
  -- -> la fiche existe dans Airtable, le cycle import-airtable n'a pas encore tourne
  UPDATE staging_organizer_exhibitors s
  SET parse_flag = 'id_not_yet_synced',
      match_reason = 'id_exposant absent de la base, fiche Airtable pas encore synchronisee'
  WHERE s.import_id = p_import_id
    AND s.parse_flag = 'ok'
    AND s.raw_id_exposant IS NOT NULL
    AND s.raw_id_exposant ~ '^Exporec[A-Za-z0-9]{10,}$'
    AND NOT EXISTS (SELECT 1 FROM exposants e WHERE e.id_exposant = s.raw_id_exposant);

  -- Cas 3 : identifiant ne respectant aucune forme connue -> ignore, retour a la cascade
  UPDATE staging_organizer_exhibitors s
  SET parse_flag = 'bad_id_exposant',
      match_reason = 'id_exposant de forme inattendue, ignore'
  WHERE s.import_id = p_import_id
    AND s.parse_flag = 'ok'
    AND s.raw_id_exposant IS NOT NULL
    AND s.raw_id_exposant !~ '^Exporec[A-Za-z0-9]{10,}$'
    AND NOT EXISTS (SELECT 1 FROM exposants e WHERE e.id_exposant = s.raw_id_exposant);

  -- ----------------------------------------------------------
  -- Doublons internes au fichier : meme domaine enregistrable deux fois.
  -- La premiere occurrence par line_no est conservee.
  -- ----------------------------------------------------------
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

  -- ----------------------------------------------------------
  -- Compteurs et mise a jour de l'import
  -- ----------------------------------------------------------
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

REVOKE EXECUTE ON FUNCTION public.organizer_stage_lines(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.organizer_stage_lines(uuid, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.organizer_stage_lines(uuid, jsonb) TO authenticated, service_role;
