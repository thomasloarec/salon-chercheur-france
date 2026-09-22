-- Onglet "Mon marché" (espace organisateur) + fermeture de la fuite nominative de get_growth_report_data
-- 22/09/2026
--
-- 1. get_growth_report_data : garde d'accès (admin, propriétaire du salon, service_role, contexte serveur).
--    Avant : exécutable par tout compte connecté (y compris sessions anonymes Recherche IA), sans contrôle
--    de propriété, et renvoyait des entreprises nommées (clé "recommandations"). Corps inchangé par ailleurs.
-- 2. get_market_intel : RPC dédiée à l'onglet. Jamais de nom d'entreprise en sortie :
--    uniquement des salons (information publique), des segments et des comptages (seuil >= 5).

-- ---------------------------------------------------------------------------
-- 1. get_growth_report_data : ajout de la garde d'accès
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_growth_report_data(p_event_id uuid, p_top_recos integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_salon jsonb; v_couverture jsonb; v_comparables jsonb;
  v_angles jsonb; v_recos jsonb; v_points_forts jsonb;
  v_secteur_dom uuid; v_secteur_dom_nom text;
BEGIN
  -- Garde d'acces ajoutee le 22/09/2026 : cette RPC renvoie des entreprises nommees.
  IF NOT (
       public.is_admin()
    OR public.is_event_owner(p_event_id)
    OR coalesce(auth.role(), '') = 'service_role'
    OR session_user <> 'authenticator'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM event_profiles WHERE event_id=p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profil_absent');
  END IF;

  SELECT tc.secteur_id, s.name INTO v_secteur_dom, v_secteur_dom_nom
  FROM event_profiles ep
  CROSS JOIN LATERAL jsonb_each_text(ep.category_distribution) d(key,value)
  JOIN taxonomy_categories tc ON tc.id=d.key::uuid
  JOIN sectors s ON s.id=tc.secteur_id
  WHERE ep.event_id=p_event_id
  GROUP BY tc.secteur_id, s.name
  ORDER BY sum((d.value)::numeric) DESC LIMIT 1;

  SELECT jsonb_build_object(
    'nom', e.nom_event, 'ville', e.ville, 'lieu', e.nom_lieu,
    'date_debut', e.date_debut, 'date_fin', e.date_fin, 'secteur_dominant', v_secteur_dom_nom
  ), jsonb_build_object(
    'nb_exposants', ep.nb_exposants, 'nb_embeddes', ep.nb_embeddes, 'nb_categorises', ep.nb_categorises,
    'pct_categorises', round(100.0*ep.nb_categorises/nullif(ep.nb_embeddes,0)),
    'nb_categories', (SELECT count(*) FROM jsonb_object_keys(ep.category_distribution)),
    'confiance', ep.confidence
  )
  INTO v_salon, v_couverture
  FROM events e JOIN event_profiles ep ON ep.event_id=e.id WHERE e.id=p_event_id;

  SELECT jsonb_agg(x) INTO v_points_forts FROM (
    SELECT jsonb_build_object('categorie', tc.label, 'nb', (d.value)::int,
      'pct', round((100.0*(d.value)::numeric/ep.nb_categorises)::numeric,1)) AS x
    FROM event_profiles ep
    CROSS JOIN LATERAL jsonb_each_text(ep.category_distribution) d(key,value)
    JOIN taxonomy_categories tc ON tc.id=d.key::uuid
    WHERE ep.event_id=p_event_id
    ORDER BY (d.value)::int DESC LIMIT 5
  ) sub;

  SELECT jsonb_agg(jsonb_build_object(
    'nom', e.nom_event, 'ville', e.ville,
    'proximite_semantique', round(es.score_semantique::numeric,3),
    'proximite_categorielle', round(es.score_categoriel::numeric,3),
    'exposants_partages', es.exposants_partages,
    'label_proximite', CASE WHEN es.score_categoriel>=0.6 THEN 'très forte'
                            WHEN es.score_categoriel>=0.4 THEN 'forte'
                            WHEN es.score_categoriel>=0.25 THEN 'moyenne' ELSE 'faible' END
  ) ORDER BY es.rang)
  INTO v_comparables
  FROM event_similarity es JOIN events e ON e.id=es.neighbor_event_id
  WHERE es.event_id=p_event_id AND es.retenu;

  WITH comps AS (SELECT neighbor_event_id FROM event_similarity WHERE event_id=p_event_id AND retenu),
  comp_parts AS (
    SELECT d.key AS cat_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY (d.value)::numeric/nullif(ep.nb_categorises,0)) AS part_comp
    FROM comps c JOIN event_profiles ep ON ep.event_id=c.neighbor_event_id
    CROSS JOIN LATERAL jsonb_each_text(ep.category_distribution) d(key,value) GROUP BY d.key
  ),
  self_parts AS (
    SELECT d.key AS cat_id, (d.value)::numeric/(SELECT nb_categorises FROM event_profiles WHERE event_id=p_event_id) AS part_self
    FROM event_profiles ep, jsonb_each_text(ep.category_distribution) d(key,value) WHERE ep.event_id=p_event_id
  )
  SELECT jsonb_agg(x ORDER BY (x->>'ecart')::numeric DESC) INTO v_angles FROM (
    SELECT jsonb_build_object(
      'categorie', tc.label,
      'pct_salon', round((coalesce(sp.part_self,0)*100)::numeric,1),
      'pct_comparables', round((cp.part_comp*100)::numeric,1),
      'entreprises_disponibles', (SELECT count(DISTINCT ec.exhibitor_id) FROM exhibitor_categories ec
         WHERE ec.version=1 AND ec.category_id=cp.cat_id::uuid
           AND ec.exhibitor_id NOT IN (SELECT id_exposant FROM participation WHERE id_event=p_event_id)),
      'ecart', (cp.part_comp - coalesce(sp.part_self,0))
    ) AS x
    FROM comp_parts cp
    JOIN taxonomy_categories tc ON tc.id=cp.cat_id::uuid AND tc.secteur_id=v_secteur_dom
    LEFT JOIN self_parts sp ON sp.cat_id=cp.cat_id
    WHERE cp.part_comp>0.01 AND coalesce(sp.part_self,0) < 0.6*cp.part_comp
    LIMIT 8
  ) sub;

  SELECT jsonb_agg(jsonb_build_object(
    'nom', ex.nom_exposant, 'website', ex.website_exposant, 'categorie', tc.label,
    'comble_angle_mort', er.categorie_sous_representee,
    'expose_sur', (SELECT e2.nom_event FROM participation pp
                   JOIN event_similarity es2 ON es2.neighbor_event_id=pp.id_event AND es2.event_id=p_event_id AND es2.retenu
                   JOIN events e2 ON e2.id=pp.id_event
                   WHERE pp.id_exposant=er.exhibitor_id ORDER BY es2.rang LIMIT 1)
  ) ORDER BY er.rang)
  INTO v_recos
  FROM event_recommendations er
  JOIN exposants ex ON ex.id_exposant=er.exhibitor_id
  LEFT JOIN taxonomy_categories tc ON tc.id=er.category_id
  WHERE er.event_id=p_event_id AND er.rang <= p_top_recos;

  RETURN jsonb_build_object(
    'ok', true, 'salon', v_salon, 'couverture', v_couverture,
    'points_forts', coalesce(v_points_forts,'[]'::jsonb),
    'comparables', coalesce(v_comparables,'[]'::jsonb),
    'angles_morts', coalesce(v_angles,'[]'::jsonb),
    'recommandations', coalesce(v_recos,'[]'::jsonb),
    'pricing', public.get_founder_pricing()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_growth_report_data(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_growth_report_data(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_growth_report_data(uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. get_market_intel : données de l'onglet "Mon marché"
-- ---------------------------------------------------------------------------
-- Règles :
--  * aucune entreprise nommée ; seuls les salons, les segments et des comptages sortent ;
--  * un angle mort n'est affiché que si au moins 5 entreprises du segment exposent chez les
--    salons comparables sans exposer chez vous (v_k), et si le segment pèse >= 3 % chez les comparables ;
--  * sans liste fournie par l'organisateur : 3 angles morts visibles, les suivants comptés mais masqués ;
--  * les autres éditions du même organisateur sont isolées des salons comparables.
CREATE OR REPLACE FUNCTION public.get_market_intel(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_k            constant integer := 5;     -- seuil d'anonymat des comptages
  v_plancher     constant numeric := 0.03;  -- part minimale d'un segment chez les comparables
  v_visibles_sans_liste constant integer := 3;
  v_ev           record;
  v_nb_part      integer;
  v_prof         record;
  v_liste_orga   boolean;
  v_en_attente   boolean;
  v_liste_fournie boolean;
  v_secteur_dom  text;
  v_points_forts jsonb;
  v_comparables  jsonb;
  v_autres_ed    jsonb;
  v_angles_all   jsonb;
  v_angles       jsonb;
  v_nb_angles    integer;
  v_vivier       integer;
  v_nb_comps     integer;
BEGIN
  IF NOT (
       public.is_admin()
    OR public.is_event_owner(p_event_id)
    OR coalesce(auth.role(), '') = 'service_role'
    OR session_user <> 'authenticator'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT id, nom_event, owner_user_id, has_exhibitors, exhibitors_confirmed_complete
    INTO v_ev FROM events WHERE id = p_event_id;
  IF v_ev.id IS NULL THEN
    RETURN jsonb_build_object('statut', 'salon_introuvable');
  END IF;

  -- Etat de la liste d'exposants (moteur du donnant-donnant)
  v_liste_orga := EXISTS (SELECT 1 FROM participation WHERE id_event = p_event_id AND source = 'organizer');
  v_en_attente := EXISTS (SELECT 1 FROM organizer_exhibitor_imports
                          WHERE event_id = p_event_id AND applied_at IS NULL);
  v_liste_fournie := v_liste_orga OR coalesce(v_ev.exhibitors_confirmed_complete, false);

  -- Evenement declare sans exposants (congres, conference)
  IF v_ev.has_exhibitors IS FALSE THEN
    RETURN jsonb_build_object('statut', 'evenement_sans_exposants', 'genere_le', now());
  END IF;

  SELECT count(DISTINCT id_exposant) INTO v_nb_part FROM participation WHERE id_event = p_event_id;
  IF v_nb_part = 0 THEN
    RETURN jsonb_build_object(
      'statut', 'aucun_exposant_reference',
      'liste', jsonb_build_object('fournie', false, 'en_attente', v_en_attente,
                                  'confirmee', coalesce(v_ev.exhibitors_confirmed_complete, false)),
      'genere_le', now());
  END IF;

  SELECT * INTO v_prof FROM event_profiles WHERE event_id = p_event_id;
  IF v_prof.event_id IS NULL THEN
    RETURN jsonb_build_object(
      'statut', 'analyse_en_preparation',
      'synthese', jsonb_build_object('nb_exposants', v_nb_part),
      'liste', jsonb_build_object('fournie', v_liste_fournie, 'en_attente', v_en_attente,
                                  'confirmee', coalesce(v_ev.exhibitors_confirmed_complete, false)),
      'genere_le', now());
  END IF;

  -- Secteur dominant (taxonomie canonique, 15 secteurs)
  SELECT s.name INTO v_secteur_dom
  FROM jsonb_each_text(v_prof.category_distribution) d(key, value)
  JOIN taxonomy_categories tc ON tc.id = d.key::uuid
  JOIN sectors s ON s.id = tc.secteur_id
  GROUP BY s.name ORDER BY sum((d.value)::numeric) DESC LIMIT 1;

  -- Points forts : 5 segments les plus representes
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'nb')::int DESC), '[]'::jsonb) INTO v_points_forts FROM (
    SELECT jsonb_build_object(
      'segment', tc.label, 'secteur', s.name, 'nb', (d.value)::int,
      'pct', round(100.0 * (d.value)::numeric / nullif(v_prof.nb_categorises, 0), 1)) AS x
    FROM jsonb_each_text(v_prof.category_distribution) d(key, value)
    JOIN taxonomy_categories tc ON tc.id = d.key::uuid
    JOIN sectors s ON s.id = tc.secteur_id
    ORDER BY (d.value)::int DESC LIMIT 5
  ) sub;

  -- Salons comparables retenus, hors autres editions du meme organisateur
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'nom', e.nom_event, 'ville', e.ville, 'date_debut', e.date_debut, 'slug', e.slug,
      'exposants_partages', es.exposants_partages,
      'proximite', CASE WHEN es.score_categoriel >= 0.6 THEN 'très forte'
                        WHEN es.score_categoriel >= 0.4 THEN 'forte'
                        WHEN es.score_categoriel >= 0.25 THEN 'moyenne' ELSE 'faible' END,
      'score', round(es.score_categoriel::numeric, 2)
    ) ORDER BY es.score_categoriel DESC, es.exposants_partages DESC), '[]'::jsonb),
    count(*)
  INTO v_comparables, v_nb_comps
  FROM event_similarity es JOIN events e ON e.id = es.neighbor_event_id
  WHERE es.event_id = p_event_id AND es.retenu
    AND e.visible AND coalesce(e.is_test, false) = false
    AND (v_ev.owner_user_id IS NULL OR e.owner_user_id IS DISTINCT FROM v_ev.owner_user_id);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'nom', e.nom_event, 'ville', e.ville, 'date_debut', e.date_debut, 'slug', e.slug,
      'exposants_partages', es.exposants_partages
    ) ORDER BY es.exposants_partages DESC), '[]'::jsonb)
  INTO v_autres_ed
  FROM event_similarity es JOIN events e ON e.id = es.neighbor_event_id
  WHERE es.event_id = p_event_id AND es.retenu
    AND v_ev.owner_user_id IS NOT NULL AND e.owner_user_id = v_ev.owner_user_id;

  -- Vivier : entreprises exposant chez les comparables (hors autres editions) et pas chez vous
  WITH comps AS (
    SELECT es.neighbor_event_id AS id
    FROM event_similarity es JOIN events e ON e.id = es.neighbor_event_id
    WHERE es.event_id = p_event_id AND es.retenu
      AND (v_ev.owner_user_id IS NULL OR e.owner_user_id IS DISTINCT FROM v_ev.owner_user_id)
  )
  SELECT count(DISTINCT p.id_exposant) INTO v_vivier
  FROM participation p
  WHERE p.id_event IN (SELECT id FROM comps)
    AND NOT EXISTS (SELECT 1 FROM participation s WHERE s.id_event = p_event_id AND s.id_exposant = p.id_exposant);

  -- Angles morts : segments bien representes chez les comparables, clairsemes chez vous
  WITH comps AS (
    SELECT es.neighbor_event_id AS id
    FROM event_similarity es JOIN events e ON e.id = es.neighbor_event_id
    WHERE es.event_id = p_event_id AND es.retenu
      AND (v_ev.owner_user_id IS NULL OR e.owner_user_id IS DISTINCT FROM v_ev.owner_user_id)
  ),
  comp_parts AS (
    SELECT d.key AS cat_id,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY (d.value)::numeric / nullif(ep.nb_categorises, 0)) AS part_comp
    FROM comps c JOIN event_profiles ep ON ep.event_id = c.id
    CROSS JOIN LATERAL jsonb_each_text(ep.category_distribution) d(key, value)
    GROUP BY d.key
  ),
  self_parts AS (
    SELECT d.key AS cat_id, (d.value)::numeric / nullif(v_prof.nb_categorises, 0) AS part_self
    FROM jsonb_each_text(v_prof.category_distribution) d(key, value)
  ),
  candidats AS (
    SELECT cp.cat_id, cp.part_comp, coalesce(sp.part_self, 0) AS part_self,
      (SELECT count(DISTINCT pp.id_exposant)
         FROM participation pp
         JOIN exhibitor_categories ec ON ec.version = 1 AND ec.exhibitor_id = pp.id_exposant
        WHERE pp.id_event IN (SELECT id FROM comps)
          AND ec.category_id = cp.cat_id::uuid
          AND NOT EXISTS (SELECT 1 FROM participation s WHERE s.id_event = p_event_id AND s.id_exposant = pp.id_exposant)
      ) AS vivier_segment
    FROM comp_parts cp
    LEFT JOIN self_parts sp ON sp.cat_id = cp.cat_id
    WHERE cp.part_comp >= v_plancher AND coalesce(sp.part_self, 0) < 0.6 * cp.part_comp
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'segment', tc.label, 'secteur', s.name,
      'pct_salon', round(100 * c.part_self, 1),
      'pct_comparables', round((100 * c.part_comp)::numeric, 1),
      'entreprises_absentes', c.vivier_segment
    ) ORDER BY (c.part_comp - c.part_self) DESC), '[]'::jsonb)
  INTO v_angles_all
  FROM candidats c
  JOIN taxonomy_categories tc ON tc.id = c.cat_id::uuid
  JOIN sectors s ON s.id = tc.secteur_id
  WHERE c.vivier_segment >= v_k;

  v_nb_angles := jsonb_array_length(v_angles_all);
  IF v_liste_fournie THEN
    v_angles := v_angles_all;
  ELSE
    SELECT coalesce(jsonb_agg(value ORDER BY ord), '[]'::jsonb) INTO v_angles
    FROM jsonb_array_elements(v_angles_all) WITH ORDINALITY t(value, ord)
    WHERE ord <= v_visibles_sans_liste;
  END IF;

  RETURN jsonb_build_object(
    'statut', 'ok',
    'analyse_partielle', NOT v_liste_fournie,
    'liste', jsonb_build_object(
      'fournie', v_liste_fournie,
      'source_organisateur', v_liste_orga,
      'confirmee', coalesce(v_ev.exhibitors_confirmed_complete, false),
      'en_attente', v_en_attente),
    'synthese', jsonb_build_object(
      'nb_exposants', v_prof.nb_exposants,
      'nb_segments', (SELECT count(*) FROM jsonb_object_keys(v_prof.category_distribution)),
      'nb_comparables', v_nb_comps,
      'vivier_absent', CASE WHEN v_vivier >= v_k THEN v_vivier ELSE NULL END,
      'secteur_dominant', v_secteur_dom,
      'confiance', v_prof.confidence),
    'points_forts', v_points_forts,
    'comparables', v_comparables,
    'autres_editions', v_autres_ed,
    'angles_morts', v_angles,
    'angles_morts_total', v_nb_angles,
    'angles_morts_masques', greatest(v_nb_angles - jsonb_array_length(v_angles), 0),
    'retention', jsonb_build_object('disponible', false, 'raison', 'liste_edition_precedente_requise'),
    'genere_le', coalesce(v_prof.computed_at, now())
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_market_intel(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_market_intel(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_market_intel(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_market_intel(uuid) IS
  'Onglet Mon marche de l espace organisateur. Aucune entreprise nommee en sortie : salons, segments et comptages (seuil 5). Garde admin / proprietaire.';

-- Appliquee via apply_migration le 22/09/2026 (version 20260922162446).
-- Le rechargement du cache PostgREST (NOTIFY pgrst, 'reload schema') a ete fait separement.
