-- Lot 5 — Application d'un import organisateur.
-- Seule fonction de tout le chantier qui ecrit dans les tables de production.
-- Une seule transaction : tout passe ou rien ne passe.

CREATE OR REPLACE FUNCTION public.organizer_apply_exhibitor_list(
  p_import_id uuid,
  p_confirm   text DEFAULT NULL      -- 'RETIRER' pour lever le garde-fou des retraits
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   uuid;
  v_event_text text;
  v_statut     text;
  v_n_part     int;
  v_n_lignes   int;
  v_n_review   int;
  v_sans_id    int;
  v_liste      text;
  v_retraits   int;
  v_cree_expo  int := 0;
  v_cree_part  int := 0;
  v_maj_part   int := 0;
  v_supp_part  int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: admin uniquement';
  END IF;

  SELECT o.event_id, o.status, e.id_event
    INTO v_event_id, v_statut, v_event_text
  FROM organizer_exhibitor_imports o
  JOIN events e ON e.id = o.event_id
  WHERE o.id = p_import_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: import % introuvable', p_import_id;
  END IF;
  IF v_statut = 'applied' THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: import deja applique';
  END IF;
  IF v_statut <> 'matched' THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: le rapprochement doit avoir ete lance (statut actuel: %)', v_statut;
  END IF;

  -- ---------- Garde-fous ----------

  SELECT count(*) INTO v_n_review
  FROM staging_organizer_exhibitors
  WHERE import_id = p_import_id AND planned_action = 'review';
  IF v_n_review > 0 THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: % ligne(s) restent a arbitrer', v_n_review;
  END IF;

  -- Airtable reste l'annuaire d'identite : Supabase ne fabrique jamais d'id_exposant.
  SELECT count(*), string_agg('ligne ' || line_no || ' ' || COALESCE(raw_nom,'?'), ', ' ORDER BY line_no)
    INTO v_sans_id, v_liste
  FROM staging_organizer_exhibitors
  WHERE import_id = p_import_id
    AND planned_action = 'create'
    AND COALESCE(matched_id_exposant, raw_id_exposant) IS NULL;
  IF v_sans_id > 0 THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: % creation(s) sans id_exposant. Creez ces fiches dans Airtable, reportez leur identifiant dans le fichier, puis reimportez. Concernees: %',
      v_sans_id, v_liste;
  END IF;

  SELECT count(*) INTO v_n_lignes
  FROM staging_organizer_exhibitors WHERE import_id = p_import_id;
  SELECT count(*) INTO v_n_part
  FROM participation WHERE id_event = v_event_id;

  CREATE TEMP TABLE _retire ON COMMIT DROP AS
  SELECT p.*
  FROM participation p
  WHERE p.id_event = v_event_id
    AND p.id_exposant NOT IN (
      SELECT matched_id_exposant FROM staging_organizer_exhibitors
      WHERE import_id = p_import_id AND matched_id_exposant IS NOT NULL
      UNION
      SELECT raw_id_exposant FROM staging_organizer_exhibitors
      WHERE import_id = p_import_id AND raw_id_exposant IS NOT NULL
    );
  SELECT count(*) INTO v_retraits FROM _retire;

  IF v_n_part > 0 AND v_retraits::numeric / v_n_part > 0.30
     AND COALESCE(p_confirm, '') <> 'RETIRER' THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: % retraits sur % participations (plus de 30%%). Confirmation requise (p_confirm = RETIRER).',
      v_retraits, v_n_part;
  END IF;

  IF v_n_part > 0 AND v_n_lignes < v_n_part / 2.0
     AND COALESCE(p_confirm, '') <> 'RETIRER' THEN
    RAISE EXCEPTION 'organizer_apply_exhibitor_list: le fichier (% lignes) couvre moins de la moitie des % participations existantes. Liste probablement partielle. Confirmation requise (p_confirm = RETIRER).',
      v_n_lignes, v_n_part;
  END IF;

  -- ---------- 1. Fiches exposants manquantes ----------
  -- Cas id_not_yet_synced : l'identifiant Airtable est connu mais le cycle import-airtable
  -- n'a pas encore propage la fiche. On la cree avec CET identifiant, l'upsert Airtable
  -- suivant ecrasera nom et site, ce qui est le comportement voulu (Airtable fait autorite).
  WITH a_creer AS (
    SELECT DISTINCT ON (COALESCE(s.matched_id_exposant, s.raw_id_exposant))
           COALESCE(s.matched_id_exposant, s.raw_id_exposant) AS id_exposant,
           s.raw_nom, s.domain_full, s.raw_description
    FROM staging_organizer_exhibitors s
    WHERE s.import_id = p_import_id
      AND s.planned_action IN ('create','update_stand','unchanged')
      AND COALESCE(s.matched_id_exposant, s.raw_id_exposant) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM exposants e
                      WHERE e.id_exposant = COALESCE(s.matched_id_exposant, s.raw_id_exposant))
    ORDER BY COALESCE(s.matched_id_exposant, s.raw_id_exposant), s.line_no
  ), ins AS (
    INSERT INTO exposants (id_exposant, nom_exposant, website_exposant, exposant_description)
    SELECT id_exposant, raw_nom, domain_full, raw_description FROM a_creer
    ON CONFLICT (id_exposant) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_cree_expo FROM ins;

  -- ---------- 2. Participations ----------
  -- Sur une participation existante on ne touche QUE le stand : ecraser website_exposant
  -- casserait le lien de domaine avec la fiche exposant (cas SICAME / sicame-group.com).
  WITH cibles AS (
    SELECT DISTINCT ON (COALESCE(s.matched_id_exposant, s.raw_id_exposant))
           COALESCE(s.matched_id_exposant, s.raw_id_exposant) AS id_exposant,
           s.raw_stand, s.domain_full
    FROM staging_organizer_exhibitors s
    WHERE s.import_id = p_import_id
      AND s.planned_action IN ('create','update_stand','unchanged')
      AND COALESCE(s.matched_id_exposant, s.raw_id_exposant) IS NOT NULL
    ORDER BY COALESCE(s.matched_id_exposant, s.raw_id_exposant), s.line_no
  ), up AS (
    INSERT INTO participation
      (id_exposant, id_event, id_event_text, stand_exposant, website_exposant,
       source, stand_locked, last_seen_at)
    SELECT c.id_exposant, v_event_id, v_event_text, c.raw_stand, c.domain_full,
           'organizer', true, now()
    FROM cibles c
    ON CONFLICT (id_exposant, id_event_text) DO UPDATE SET
      stand_exposant = EXCLUDED.stand_exposant,
      source         = 'organizer',
      stand_locked   = true,
      last_seen_at   = now()
    RETURNING (xmax::text::bigint = 0) AS insere
  )
  SELECT count(*) FILTER (WHERE insere), count(*) FILTER (WHERE NOT insere)
  INTO v_cree_part, v_maj_part
  FROM up;

  -- ---------- 3. Retraits, archives avant suppression ----------
  INSERT INTO participation_removal_log
    (import_id, id_event, id_exposant, removed_row, reason, removed_by)
  SELECT p_import_id, r.id_event, r.id_exposant, to_jsonb(r),
         'absente de la liste organisateur', auth.uid()
  FROM _retire r;

  DELETE FROM participation p
  USING _retire r
  WHERE p.id_participation = r.id_participation;
  GET DIAGNOSTICS v_supp_part = ROW_COUNT;

  -- ---------- 4. Tracabilite ----------
  INSERT INTO admin_data_cleaning_logs
    (admin_user_id, action, entity_source, entity_id, entity_name, old_values, impact, reason)
  VALUES (
    auth.uid(), 'organizer_import_apply', 'event', v_event_id::text, v_event_text,
    jsonb_build_object('participations_avant', v_n_part),
    jsonb_build_object('exposants_crees', v_cree_expo, 'participations_creees', v_cree_part,
                       'participations_majs', v_maj_part, 'participations_supprimees', v_supp_part),
    'application de la liste exposants transmise par l''organisateur'
  );

  UPDATE organizer_exhibitor_imports
  SET status = 'applied', applied_at = now(), applied_by = auth.uid(),
      stats = COALESCE(stats, '{}'::jsonb) || jsonb_build_object('application', jsonb_build_object(
        'exposants_crees', v_cree_expo, 'participations_creees', v_cree_part,
        'participations_majs', v_maj_part, 'participations_supprimees', v_supp_part,
        'participations_avant', v_n_part))
  WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'exposants_crees', v_cree_expo,
    'participations_creees', v_cree_part,
    'participations_majs', v_maj_part,
    'participations_supprimees', v_supp_part,
    'participations_avant', v_n_part,
    'participations_apres', (SELECT count(*) FROM participation WHERE id_event = v_event_id)
  );
END;
$$;

COMMENT ON FUNCTION public.organizer_apply_exhibitor_list(uuid, text) IS
  'Applique un import organisateur : cree les fiches exposants manquantes avec leur identifiant Airtable, upsert les participations en source=organizer et stand_locked, archive puis supprime les participations absentes du fichier. Refuse si un arbitrage reste en attente ou si une creation n''a pas d''id_exposant. Transaction unique.';

REVOKE EXECUTE ON FUNCTION public.organizer_apply_exhibitor_list(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.organizer_apply_exhibitor_list(uuid, text) TO authenticated, service_role;
