-- ============================================================
-- WF5 — Lot 2 : RPC de diagnostic d'activation.
--
-- Retourne, pour une campagne organisateur, l'etat reel de chacun de ses
-- salons revendiques et la liste des manques ("gaps") reellement ouverts.
--
-- PRINCIPE DES ANCRES (playbook Nouveaute) : un gap n'est ouvert que si
-- son ancre est detectee. Sans ancre, le sujet n'est pas evoque, et il
-- n'est PAS remplace par une formulation vague. Un congres sans exposants
-- ne doit jamais lire le mot "exposant".
--
-- Detection de expects_exhibitors, par ordre d'autorite :
--   1. events.expects_exhibitors (override admin)
--   2. true si le salon a deja des exposants references
--   3. true si un AUTRE salon du meme organisateur en a
--      (ex : Solucop Toulouse a 0 exposant, mais Lille en a 20 et Nice 87)
--   4. sinon NULL = indetermine -> silence total sur les exposants
--
-- Asymetrie assumee sur le programme : un congres sans exposants est
-- normal, un evenement sans programme l'est beaucoup moins. Le gap
-- programme est donc ouvert tant que expects_program n'est pas
-- explicitement false.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_organizer_activation_snapshot(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id uuid;
  v_result       jsonb;
BEGIN
  SELECT s.organizer_id INTO v_organizer_id
  FROM public.v_organizer_activation_state s
  WHERE s.campaign_id = p_campaign_id;

  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campagne_inconnue_ou_sans_salon_revendique');
  END IF;

  WITH salons AS (
    SELECT
      e.id, e.nom_event, e.slug, e.type_event, e.date_debut,
      e.expects_exhibitors AS override_expo,
      e.expects_program    AS override_prog,
      (e.date_debut - CURRENT_DATE)                              AS jours_avant,
      NULLIF(btrim(COALESCE(e.description_event, '')), '')       AS description_event,
      NULLIF(btrim(COALESCE(e.url_image, '')), '')               AS url_image,
      (SELECT count(*) FROM public.participation p
        WHERE p.id_event = e.id)                                 AS nb_exposants,
      (SELECT count(*) FROM public.event_program_sessions ps
        WHERE ps.event_id = e.id AND ps.status = 'published')     AS nb_sessions,
      (SELECT count(*) FROM public.event_updates u
        WHERE u.event_id = e.id AND u.status = 'published')       AS nb_fil,
      (SELECT max(u.published_at) FROM public.event_updates u
        WHERE u.event_id = e.id AND u.status = 'published')       AS dernier_fil_at,
      (SELECT COALESCE(sum(d.impressions), 0)
         FROM public.event_update_stats_daily d
        WHERE d.event_id = e.id
          AND d.stat_date >= CURRENT_DATE - 30)                   AS fil_impressions_30j,
      (SELECT COALESCE(sum(d.cta_clicks), 0)
         FROM public.event_update_stats_daily d
        WHERE d.event_id = e.id
          AND d.stat_date >= CURRENT_DATE - 30)                   AS fil_clics_30j,
      (SELECT count(*) FROM public.novelties n
        WHERE n.event_id = e.id AND n.status = 'published'
          AND COALESCE(n.is_test, false) = false)                 AS nb_nouveautes
    FROM public.organizer_domains od
    JOIN public.events e ON e.url_site_officiel_domain = od.domain
    WHERE od.organizer_id = v_organizer_id
      AND e.visible = true
      AND COALESCE(e.is_test, false) = false
      AND e.owner_user_id IS NOT NULL
  ),
  contexte AS (
    -- Signal transverse : l'organisateur a-t-il, quelque part, des exposants
    -- ou un programme ? Si oui, un salon vide est un manque, pas une nature.
    SELECT
      bool_or(nb_exposants > 0) AS organisateur_a_des_exposants,
      bool_or(nb_sessions  > 0) AS organisateur_a_un_programme
    FROM salons
  ),
  qualifies AS (
    SELECT s.*,
      COALESCE(s.override_expo,
               CASE WHEN s.nb_exposants > 0 THEN true
                    WHEN c.organisateur_a_des_exposants THEN true
                    ELSE NULL END)                                AS expects_exhibitors,
      COALESCE(s.override_prog,
               CASE WHEN s.nb_sessions > 0 THEN true
                    WHEN c.organisateur_a_un_programme THEN true
                    ELSE NULL END)                                AS expects_program,
      CASE
        WHEN s.jours_avant <= 30  THEN 2.0
        WHEN s.jours_avant <= 60  THEN 1.5
        WHEN s.jours_avant <= 120 THEN 1.2
        ELSE 1.0
      END                                                          AS urgence
    FROM salons s CROSS JOIN contexte c
  ),
  avec_gaps AS (
    SELECT q.*,
      -- Ancre exposants : uniquement si expects_exhibitors vaut true.
      CASE WHEN q.expects_exhibitors IS TRUE AND q.nb_exposants = 0
           THEN 'exposants_absents'
           WHEN q.expects_exhibitors IS TRUE AND q.nb_exposants > 0
           THEN 'exposants_a_completer'
           ELSE NULL END                                           AS gap_exposants,
      CASE WHEN q.expects_program IS NOT FALSE AND q.nb_sessions = 0
           THEN 'programme_absent' ELSE NULL END                    AS gap_programme,
      CASE WHEN q.nb_fil = 0 THEN 'fil_jamais_alimente'
           WHEN q.dernier_fil_at < now() - interval '45 days'
           THEN 'fil_en_sommeil' ELSE NULL END                      AS gap_fil,
      -- Sans exposants references, aucune nouveaute n'est possible.
      CASE WHEN q.nb_exposants > 0 AND q.nb_nouveautes = 0
           THEN 'nouveautes_absentes' ELSE NULL END                 AS gap_nouveautes
    FROM qualifies q
  ),
  scores AS (
    SELECT g.*,
      CASE WHEN g.gap_exposants = 'exposants_absents'     THEN 100 * g.urgence
           WHEN g.gap_exposants = 'exposants_a_completer' THEN  55 * g.urgence
           ELSE 0 END                                               AS score_exposants,
      CASE WHEN g.gap_programme IS NOT NULL THEN 70 * g.urgence ELSE 0 END AS score_programme,
      CASE WHEN g.gap_fil        IS NOT NULL THEN 40 * g.urgence ELSE 0 END AS score_fil,
      CASE WHEN g.gap_nouveautes IS NOT NULL THEN 25 * g.urgence ELSE 0 END AS score_nouveautes
    FROM avec_gaps g
    WHERE g.date_debut >= CURRENT_DATE
  ),
  agrege AS (
    SELECT
      SUM(score_exposants)  AS tot_exposants,
      SUM(score_programme)  AS tot_programme,
      SUM(score_fil)        AS tot_fil,
      SUM(score_nouveautes) AS tot_nouveautes
    FROM scores
  )
  SELECT jsonb_build_object(
    'ok', true,
    'campaign_id', p_campaign_id,
    'organizer_id', v_organizer_id,
    'computed_at', now(),
    'nb_salons_a_venir', (SELECT count(*) FROM scores),
    'nb_salons_total',   (SELECT count(*) FROM avec_gaps),
    'scores', jsonb_build_object(
      'exposants',  COALESCE((SELECT tot_exposants  FROM agrege), 0),
      'programme',  COALESCE((SELECT tot_programme  FROM agrege), 0),
      'fil',        COALESCE((SELECT tot_fil        FROM agrege), 0),
      'nouveautes', COALESCE((SELECT tot_nouveautes FROM agrege), 0)
    ),
    'next_action', (
      SELECT theme FROM (
        SELECT 'exposants'  AS theme, COALESCE((SELECT tot_exposants  FROM agrege),0) AS sc, 1 AS pr
        UNION ALL SELECT 'programme',  COALESCE((SELECT tot_programme  FROM agrege),0), 2
        UNION ALL SELECT 'fil',        COALESCE((SELECT tot_fil        FROM agrege),0), 3
        UNION ALL SELECT 'nouveautes', COALESCE((SELECT tot_nouveautes FROM agrege),0), 4
      ) t WHERE sc > 0 ORDER BY sc DESC, pr ASC LIMIT 1
    ),
    'themes_autorises', (
      -- Sujets que l'email a le droit d'evoquer. Un theme absent d'ici
      -- ne doit apparaitre sous AUCUNE forme, meme attenuee.
      SELECT COALESCE(jsonb_agg(DISTINCT theme), '[]'::jsonb) FROM (
        SELECT 'exposants'  AS theme FROM scores WHERE gap_exposants  IS NOT NULL
        UNION ALL SELECT 'programme'  FROM scores WHERE gap_programme  IS NOT NULL
        UNION ALL SELECT 'fil'        FROM scores WHERE gap_fil        IS NOT NULL
        UNION ALL SELECT 'nouveautes' FROM scores WHERE gap_nouveautes IS NOT NULL
      ) x
    ),
    'salons', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'event_id', s.id,
        'nom_event', s.nom_event,
        'slug', s.slug,
        'type_event', s.type_event,
        'date_debut', s.date_debut,
        'jours_avant', s.jours_avant,
        'nb_exposants', s.nb_exposants,
        'nb_sessions', s.nb_sessions,
        'nb_fil', s.nb_fil,
        'dernier_fil_at', s.dernier_fil_at,
        'fil_impressions_30j', s.fil_impressions_30j,
        'fil_clics_30j', s.fil_clics_30j,
        'nb_nouveautes', s.nb_nouveautes,
        'has_description', (s.description_event IS NOT NULL),
        'has_image', (s.url_image IS NOT NULL),
        'expects_exhibitors', s.expects_exhibitors,
        'expects_program', s.expects_program,
        'gaps', (
          SELECT COALESCE(jsonb_agg(g), '[]'::jsonb)
          FROM unnest(ARRAY[s.gap_exposants, s.gap_programme, s.gap_fil, s.gap_nouveautes]) g
          WHERE g IS NOT NULL
        )
      ) ORDER BY s.date_debut), '[]'::jsonb)
      FROM scores s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_organizer_activation_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organizer_activation_snapshot(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_organizer_activation_snapshot(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_organizer_activation_snapshot(uuid) TO service_role;
