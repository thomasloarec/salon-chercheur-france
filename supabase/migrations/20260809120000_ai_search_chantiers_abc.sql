-- =====================================================================
-- Recherche IA - Chantiers A / B / C
-- Etat final consolide des 4 fonctions, identique a la production.
-- Idempotent : peut etre rejoue sans effet de bord (CREATE OR REPLACE,
-- avec DROP prealable pour match_salons_v2 dont le type de retour a evolue).
--
-- A : match_salons_v2  -> recherche de salons unifiee (categories + zone
--     geographique + bonus secteur + statut recommande/connexe)
-- B : fiche_salon       -> resolution d'un salon par son nom (lieu, dates)
-- C : salons_des_concurrents -> salons ou exposent les concurrents de X
--     events_dans_zone  -> resolution ville -> zone (communes peripheriques)
-- =====================================================================

-- ---------------------------------------------------------------------
-- events_dans_zone : ville demandee -> evenements de la zone
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.events_dans_zone(p_ville text)
 RETURNS TABLE(event_id uuid, proximite text, ville_reelle text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_norm text;
  v_dep text;
  v_reg text;
  v_deps text[];
BEGIN
  IF p_ville IS NULL OR btrim(p_ville) = '' THEN RETURN; END IF;
  v_norm := lower(unaccent(btrim(p_ville)));

  -- Resolution ville -> departement/region via correspondance exacte (indexable)
  SELECT c.dep_code, c.region_code INTO v_dep, v_reg
  FROM communes c
  WHERE lower(unaccent(c.nom)) = v_norm
  ORDER BY c.id LIMIT 1;

  IF v_dep IS NULL THEN
    RETURN QUERY
    SELECT e.id, 'exacte'::text, e.ville
    FROM events e
    WHERE e.visible AND COALESCE(e.is_test,false) = false
      AND unaccent(e.ville) ILIKE '%'||unaccent(p_ville)||'%';
    RETURN;
  END IF;

  -- Paris : parcs repartis sur plusieurs departements -> region entiere.
  IF v_dep = '75' THEN
    SELECT array_agg(d.code) INTO v_deps FROM departements d WHERE d.region_code = v_reg;
  ELSE
    v_deps := ARRAY[v_dep];
  END IF;

  -- Filtrage direct sur events par prefixe de code postal (2 chiffres = departement),
  -- sans passer par la vue events_geo (LATERAL couteux sur 35000 communes).
  RETURN QUERY
  SELECT e.id,
         CASE WHEN lower(unaccent(e.ville)) = v_norm THEN 'exacte' ELSE 'proche' END,
         e.ville
  FROM events e
  WHERE e.visible AND COALESCE(e.is_test,false) = false
    AND e.code_postal IS NOT NULL
    AND left(regexp_replace(e.code_postal, '\s', '', 'g'), 2) = ANY(v_deps);
END;
$function$;

REVOKE ALL ON FUNCTION public.events_dans_zone(text) FROM public;
GRANT EXECUTE ON FUNCTION public.events_dans_zone(text) TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- match_salons_v2 : recherche de salons unifiee (Chantier A)
-- Le type de retour a evolue -> DROP prealable obligatoire.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.match_salons_v2(text, text, date, boolean, integer);

CREATE OR REPLACE FUNCTION public.match_salons_v2(p_query text DEFAULT NULL::text, p_ville text DEFAULT NULL::text, p_date_max date DEFAULT NULL::date, p_upcoming_only boolean DEFAULT true, p_k integer DEFAULT 12)
 RETURNS TABLE(nom_event text, ville text, date_debut date, date_fin date, slug text, statut text, proximite text, nb_exposants_domaine integer, sim_max numeric, score numeric, categories_matchees text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET statement_timeout TO '30s'
AS $function$
#variable_conflict use_column
DECLARE
  v_q vector(1024); v_mx float; v_s3 float; v_broad boolean := false;
  v_xlow float; v_nb_reco integer;
  c_top_exposants constant integer := 200;
  c_bonus_secteur constant numeric := 0.8;
  c_porte constant numeric := 0.55;
BEGIN
  DROP TABLE IF EXISTS _zone;
  CREATE TEMP TABLE _zone ON COMMIT DROP AS
  SELECT z.event_id, z.proximite FROM public.events_dans_zone(p_ville) z
  WHERE p_ville IS NOT NULL AND btrim(p_ville) <> '';

  IF p_query IS NULL OR btrim(p_query) = '' THEN
    RETURN QUERY
    SELECT e.nom_event, e.ville, e.date_debut, e.date_fin, e.slug,
           'recommande'::text, COALESCE(z.proximite,'exacte'), 0, 0::numeric, 0::numeric, ARRAY[]::text[]
    FROM events e LEFT JOIN _zone z ON z.event_id = e.id
    WHERE e.visible AND COALESCE(e.is_test,false) = false
      AND (NOT p_upcoming_only OR e.date_debut >= CURRENT_DATE)
      AND (p_ville IS NULL OR btrim(p_ville) = '' OR z.event_id IS NOT NULL)
      AND (p_date_max IS NULL OR e.date_debut <= p_date_max)
    ORDER BY (COALESCE(z.proximite,'exacte') = 'exacte') DESC, e.date_debut LIMIT p_k;
    RETURN;
  END IF;

  v_q := public.cohere_embed_query(p_query);

  DROP TABLE IF EXISTS _cat; DROP TABLE IF EXISTS _ret; DROP TABLE IF EXISTS _sect;
  DROP TABLE IF EXISTS _x;   DROP TABLE IF EXISTS _xlab; DROP TABLE IF EXISTS _agg;

  CREATE TEMP TABLE _cat ON COMMIT DROP AS
  SELECT tc.id, tc.secteur_id, tc.label, (1 - (tc.centroid <=> v_q))::float AS sim
  FROM taxonomy_categories tc WHERE tc.version = public.taxo_current_version();

  SELECT max(sim) INTO v_mx FROM _cat;
  SELECT sim INTO v_s3 FROM _cat ORDER BY sim DESC OFFSET 2 LIMIT 1;
  v_broad := (v_mx - COALESCE(v_s3, v_mx)) < 0.04;

  CREATE TEMP TABLE _sect ON COMMIT DROP AS
  SELECT s.name FROM (
    SELECT c.secteur_id, max(c.sim) sm FROM _cat c GROUP BY c.secteur_id ORDER BY sm DESC LIMIT 1
  ) t JOIN sectors s ON s.id = t.secteur_id;

  CREATE TEMP TABLE _ret ON COMMIT DROP AS
  SELECT c.id, c.label FROM _cat c WHERE c.sim >= v_mx - 0.08
  UNION
  SELECT c.id, c.label FROM _cat c
  WHERE v_broad AND c.secteur_id IN (SELECT c2.secteur_id FROM _cat c2 ORDER BY c2.sim DESC LIMIT 3);

  -- Etape 1 : scorer les exposants candidats SANS agreger les labels (evite un tri massif),
  -- garder le top N. C'est l'optimisation cle : 0.7s au lieu de 15s.
  CREATE TEMP TABLE _x ON COMMIT DROP AS
  SELECT s.xid, s.xsim FROM (
    SELECT em.exhibitor_id AS xid, (1 - (em.embedding <=> v_q))::float AS xsim
    FROM (SELECT DISTINCT ec.exhibitor_id
          FROM exhibitor_categories ec
          JOIN _ret r ON r.id = ec.category_id
          WHERE ec.version = public.taxo_current_version()) c
    JOIN exhibitor_embeddings em ON em.exhibitor_id = c.exhibitor_id
    ORDER BY xsim DESC
    LIMIT c_top_exposants
  ) s;

  SELECT min(x.xsim) INTO v_xlow FROM _x x;
  IF v_xlow IS NULL THEN RETURN; END IF;

  -- Etape 2 : rattacher les labels uniquement pour les 200 retenus
  CREATE TEMP TABLE _xlab ON COMMIT DROP AS
  SELECT x.xid, x.xsim, array_agg(DISTINCT r.label) AS labels
  FROM _x x
  JOIN exhibitor_categories ec ON ec.exhibitor_id = x.xid AND ec.version = public.taxo_current_version()
  JOIN _ret r ON r.id = ec.category_id
  GROUP BY x.xid, x.xsim;

  CREATE TEMP TABLE _agg ON COMMIT DROP AS
  SELECT e.id, e.nom_event, e.ville, e.date_debut, e.date_fin, e.slug,
         COALESCE(zo.proximite,'exacte') AS prox,
         count(DISTINCT x.xid)::integer AS nb, max(x.xsim)::float AS smax,
         (ln(1 + count(DISTINCT x.xid)) * GREATEST(max(x.xsim) - v_xlow, 0.001)
          * (1 + CASE WHEN EXISTS (
                  SELECT 1 FROM jsonb_array_elements_text(
                    CASE WHEN jsonb_typeof(e.secteur)='array' THEN e.secteur ELSE '[]'::jsonb END) sv
                  JOIN _sect ON _sect.name = sv)
                THEN c_bonus_secteur ELSE 0 END))::numeric AS sc,
         (array_agg(DISTINCT l.lab))[1:3] AS cats
  FROM _xlab x
  JOIN participation p ON p.id_exposant = x.xid
  JOIN events e ON e.id = p.id_event
  LEFT JOIN _zone zo ON zo.event_id = e.id
  CROSS JOIN LATERAL unnest(x.labels) AS l(lab)
  WHERE e.visible AND COALESCE(e.is_test,false) = false
    AND (NOT p_upcoming_only OR e.date_debut >= CURRENT_DATE)
    AND (p_ville IS NULL OR btrim(p_ville) = '' OR zo.event_id IS NOT NULL)
    AND (p_date_max IS NULL OR e.date_debut <= p_date_max)
  GROUP BY e.id, e.nom_event, e.ville, e.date_debut, e.date_fin, e.slug, zo.proximite, e.secteur;

  SELECT count(*) INTO v_nb_reco FROM _agg a
  WHERE a.nb >= 2 AND a.sc >= c_porte * (SELECT max(a2.sc) FROM _agg a2);

  RETURN QUERY
  WITH marque AS (
    SELECT a.*, CASE WHEN a.nb >= 2 AND a.sc >= c_porte * (SELECT max(a2.sc) FROM _agg a2)
                     THEN 'recommande' ELSE 'connexe' END AS st FROM _agg a
  ), limite AS (
    SELECT m.*, row_number() OVER (PARTITION BY m.st ORDER BY m.sc DESC) AS rn FROM marque m
  )
  SELECT l.nom_event, l.ville, l.date_debut, l.date_fin, l.slug,
         l.st, l.prox, l.nb, round(l.smax::numeric,3), round(l.sc,3), l.cats
  FROM limite l
  WHERE l.st = 'recommande' OR (v_nb_reco < 3 AND l.rn <= 2)
  ORDER BY (l.st = 'recommande') DESC, l.sc DESC
  LIMIT p_k;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_salons_v2(text, text, date, boolean, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.match_salons_v2(text, text, date, boolean, integer) TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- fiche_salon : resolution d'un salon par son nom (Chantier B)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiche_salon(p_salon text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_qn text; v_r record; v_n integer; v_couv text;
  v_autres jsonb; v_cands jsonb; v_statut text;
BEGIN
  IF p_salon IS NULL OR btrim(p_salon) = '' THEN
    RETURN jsonb_build_object('statut','requete_vide');
  END IF;

  v_qn := btrim(regexp_replace(
            lower(unaccent(p_salon)),
            '\y(salon|foire|congres|le|la|les|du|de|des|d|the|expo|20[0-9]{2})\y', ' ', 'g'));
  IF v_qn = '' THEN v_qn := lower(unaccent(p_salon)); END IF;

  DROP TABLE IF EXISTS _c;
  CREATE TEMP TABLE _c ON COMMIT DROP AS
  SELECT e.id, e.nom_event, e.ville, e.nom_lieu, e.rue, e.code_postal,
         e.date_debut, e.date_fin, e.slug, e.type_event, e.secteur,
         (e.date_debut >= CURRENT_DATE) AS a_venir,
         GREATEST(
           CASE WHEN lower(e.slug) = lower(p_salon) THEN 1.0 ELSE 0 END,
           word_similarity(v_qn, lower(unaccent(e.nom_event))),
           similarity(v_qn, lower(unaccent(e.nom_event)))
         )::float AS sc
  FROM events e
  WHERE e.visible = true AND COALESCE(e.is_test,false) = false;

  SELECT * INTO v_r FROM _c ORDER BY sc DESC, a_venir DESC, date_debut ASC LIMIT 1;

  IF v_r.id IS NULL OR v_r.sc < 0.45 THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'nom_event', c.nom_event, 'ville', c.ville,
             'date_debut', c.date_debut, 'slug', c.slug,
             'proximite', round(c.sc::numeric,2))), '[]'::jsonb)
    INTO v_cands
    FROM (SELECT * FROM _c ORDER BY sc DESC, a_venir DESC, date_debut ASC LIMIT 3) c;
    RETURN jsonb_build_object(
      'statut','salon_introuvable', 'salon_demande', p_salon, 'suggestions', v_cands,
      'note','Aucun salon ne correspond avec assez de certitude. Ne dis JAMAIS que ce salon n''existe pas : dis que tu ne le trouves pas dans l''index Lotexpo, et propose les suggestions si elles sont plausibles.');
  END IF;

  v_statut := CASE WHEN v_r.sc < 0.60 THEN 'resolution_incertaine' ELSE 'ok' END;

  SELECT count(DISTINCT p.id_exposant) INTO v_n
  FROM participation p WHERE p.id_event = v_r.id;

  v_couv := CASE WHEN v_n = 0 THEN 'aucune' WHEN v_n < 10 THEN 'tres_partielle'
                 WHEN v_n < 30 THEN 'partielle' ELSE 'referencee' END;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'nom_event', c.nom_event, 'ville', c.ville,
           'date_debut', c.date_debut, 'slug', c.slug) ORDER BY c.date_debut), '[]'::jsonb)
  INTO v_autres
  FROM _c c WHERE c.id <> v_r.id AND c.a_venir AND c.sc >= 0.60;

  RETURN jsonb_build_object(
    'statut', v_statut,
    'salon', jsonb_build_object(
      'nom_event', v_r.nom_event, 'ville', v_r.ville, 'lieu', v_r.nom_lieu,
      'adresse', btrim(concat_ws(', ', v_r.rue, concat_ws(' ', v_r.code_postal, v_r.ville))),
      'date_debut', v_r.date_debut, 'date_fin', v_r.date_fin, 'a_venir', v_r.a_venir,
      'type', v_r.type_event, 'secteurs', v_r.secteur,
      'nb_exposants_referencees', v_n, 'couverture_exposants', v_couv,
      'page_salon', '/events/' || v_r.slug, 'slug', v_r.slug),
    'autres_editions_a_venir', v_autres,
    'note', CASE
      WHEN NOT v_r.a_venir THEN 'Cette edition est PASSEE. Ne la recommande pas pour une visite. Si autres_editions_a_venir contient une edition, oriente vers elle.'
      WHEN v_couv = 'aucune' THEN 'Le salon existe et a lieu aux dates indiquees. Aucun exposant n''est encore reference sur Lotexpo : ne dis JAMAIS qu''il n''a pas d''exposants, dis que la liste n''est pas encore disponible.'
      ELSE 'Le salon existe et a lieu aux dates indiquees. Reponds directement avec la ville, le lieu et les dates.'
    END);
END;
$function$;

REVOKE ALL ON FUNCTION public.fiche_salon(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fiche_salon(text) TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- salons_des_concurrents : salons ou exposent les concurrents de X (Chantier C)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salons_des_concurrents(p_nom_ou_site text, p_k_entreprises integer DEFAULT 15, p_k_salons integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET statement_timeout TO '20s'
AS $function$
DECLARE
  v_ref record;
  v_amb integer;
  v_res jsonb;
BEGIN
  IF p_nom_ou_site IS NULL OR btrim(p_nom_ou_site) = '' THEN
    RETURN jsonb_build_object('statut','requete_vide');
  END IF;

  -- Resolution de l'entreprise de reference
  SELECT * INTO v_ref
  FROM public.resolve_exhibitor(p_nom_ou_site, 3)
  ORDER BY score DESC LIMIT 1;

  IF v_ref.exhibitor_id IS NULL THEN
    RETURN jsonb_build_object(
      'statut','entreprise_introuvable',
      'entreprise_demandee', p_nom_ou_site);
  END IF;

  -- Ambiguite : plusieurs candidats au meme score maximal
  SELECT count(*) INTO v_amb
  FROM public.resolve_exhibitor(p_nom_ou_site, 3) r
  WHERE r.score >= v_ref.score - 0.001;

  -- Salons a venir ou se concentrent les entreprises similaires
  WITH sim AS (
    SELECT m.exhibitor_id, m.nom_exposant, m.public_slug,
           m.secteur_principal, m.similarity, m.salons
    FROM public.match_exhibitors_by_exhibitor(v_ref.exhibitor_id, p_k_entreprises, true) m
  ),
  paires AS (
    SELECT s.nom_exposant, s.public_slug, s.secteur_principal, s.similarity,
           (sal->>'nom_event') AS nom_event,
           (sal->>'ville')     AS ville,
           (sal->>'date_debut')AS date_debut,
           (sal->>'slug')      AS slug
    FROM sim s, jsonb_array_elements(s.salons) AS sal
  ),
  grouped AS (
    SELECT nom_event, ville, date_debut, slug,
           count(*)::int AS nb_concurrents,
           round(max(similarity)::numeric,3) AS proximite_max,
           jsonb_agg(jsonb_build_object(
             'nom', nom_exposant,
             'public_slug', public_slug,
             'activite', secteur_principal,
             'proximite', round(similarity::numeric,3)
           ) ORDER BY similarity DESC) AS concurrents
    FROM paires
    GROUP BY nom_event, ville, date_debut, slug
  )
  SELECT coalesce(jsonb_agg(g ORDER BY g.nb_concurrents DESC, g.proximite_max DESC), '[]'::jsonb)
  INTO v_res
  FROM (SELECT * FROM grouped ORDER BY nb_concurrents DESC, proximite_max DESC LIMIT p_k_salons) g;

  RETURN jsonb_build_object(
    'statut', CASE WHEN jsonb_array_length(v_res) = 0 THEN 'aucun_salon_a_venir' ELSE 'ok' END,
    'entreprise_reference', jsonb_build_object(
        'nom', v_ref.nom_exposant,
        'public_slug', v_ref.public_slug,
        'methode_resolution', v_ref.methode,
        'expose_bientot', v_ref.expose_bientot),
    'resolution_ambigue', (v_amb > 1),
    'salons', v_res);
END;
$function$;

REVOKE ALL ON FUNCTION public.salons_des_concurrents(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.salons_des_concurrents(text, integer, integer) TO anon, authenticated, service_role;
