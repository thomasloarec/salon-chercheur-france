-- =====================================================================
-- Recherche IA - Donnees qualifiantes des salons
--
-- Ouvre a l'agent les champs description, affluence, tarif, adresse,
-- type et secteur, jusqu'ici invisibles pour lui.
--
-- Trois points de vigilance traites ici :
--  1. events.affluence est du TEXTE et le point y est un separateur de
--     MILLIERS a la francaise : "10.000" vaut dix mille. Une conversion
--     naive faussait d'un facteur 1000. -> parse_affluence()
--  2. "non communique" est une valeur factice presente sur 80 des 248
--     salons a venir. Le remplissage reel est de 68%, pas de 100%.
--  3. events.tarif contient 48 fois "Voir site internet", qui pousserait
--     l'agent a renvoyer l'utilisateur hors de Lotexpo, en violation
--     d'une regle absolue. -> neutralise en 'non_communique'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- parse_affluence : texte libre -> entier, sans jamais deviner
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parse_affluence(p_txt text)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v text;
BEGIN
  IF p_txt IS NULL THEN RETURN NULL; END IF;
  v := lower(btrim(p_txt));

  -- Valeurs factices explicites
  IF v IN ('', 'non communiqué', 'non communique', 'nc', 'n/a', '-') THEN
    RETURN NULL;
  END IF;

  -- Format "100+" / "250+" : on retient le plancher annonce
  IF v ~ '^[0-9]+\s*\+$' THEN
    RETURN (regexp_replace(v, '[^0-9]', '', 'g'))::integer;
  END IF;

  -- Format francais avec point separateur de milliers : "10.000", "1.500"
  IF v ~ '^[0-9]{1,3}(\.[0-9]{3})+$' THEN
    RETURN (replace(v, '.', ''))::integer;
  END IF;

  -- Format francais avec espace : "10 000"
  IF v ~ '^[0-9]{1,3}( [0-9]{3})+$' THEN
    RETURN (replace(v, ' ', ''))::integer;
  END IF;

  -- Entier simple
  IF v ~ '^[0-9]+$' THEN
    RETURN v::integer;
  END IF;

  -- Format inconnu : on refuse de deviner
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.parse_affluence(text) FROM public;
GRANT EXECUTE ON FUNCTION public.parse_affluence(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.parse_affluence(text) IS
  'Convertit events.affluence (texte libre) en entier. Gere le point comme separateur de milliers (format francais), le suffixe "+", et renvoie NULL pour "non communique" et tout format non reconnu (jamais de valeur devinee).';


-- ---------------------------------------------------------------------
-- fiche_salon : fiche complete enrichie des donnees qualifiantes
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
  v_aff integer; v_env text; v_tarif_cat text; v_tarif_txt text;
  v_desc text; v_notes text[];
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
         e.description_event, e.description_enrichie, e.affluence, e.tarif,
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

  -- Affluence normalisee + palier d'envergure cale sur les quantiles reels du parc
  v_aff := public.parse_affluence(v_r.affluence);
  v_env := CASE
             WHEN v_aff IS NULL      THEN NULL
             WHEN v_aff < 1000       THEN 'confidentiel'
             WHEN v_aff < 10000      THEN 'regional'
             WHEN v_aff < 50000      THEN 'national'
             ELSE 'international'
           END;

  -- Tarif : on ne parse JAMAIS le montant (texte libre). On categorise, et on
  -- neutralise les renvois hors Lotexpo ("Voir site internet" = 48 occurrences).
  v_tarif_txt := nullif(btrim(coalesce(v_r.tarif,'')), '');
  v_tarif_cat := CASE
    WHEN v_tarif_txt IS NULL THEN 'non_communique'
    WHEN lower(v_tarif_txt) IN ('non communiqué','non communique','nc') THEN 'non_communique'
    WHEN lower(v_tarif_txt) LIKE 'voir site%' OR lower(v_tarif_txt) LIKE 'voir le site%'
      OR lower(v_tarif_txt) LIKE '%organisateur%' THEN 'non_communique'
    WHEN lower(v_tarif_txt) LIKE 'gratuit%' THEN 'gratuit'
    ELSE 'payant'
  END;
  IF v_tarif_cat = 'non_communique' THEN v_tarif_txt := NULL; END IF;

  -- Description : enrichie prioritaire, tronquee pour ne pas saturer le contexte
  v_desc := coalesce(nullif(btrim(coalesce(v_r.description_enrichie,'')),''),
                     nullif(btrim(coalesce(v_r.description_event,'')),''));
  IF v_desc IS NOT NULL AND lower(v_desc) LIKE '%non communiqu%' AND length(v_desc) < 60 THEN
    v_desc := NULL;
  END IF;
  IF v_desc IS NOT NULL AND length(v_desc) > 1200 THEN
    v_desc := left(v_desc, 1200) || '...';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'nom_event', c.nom_event, 'ville', c.ville,
           'date_debut', c.date_debut, 'slug', c.slug) ORDER BY c.date_debut), '[]'::jsonb)
  INTO v_autres
  FROM _c c WHERE c.id <> v_r.id AND c.a_venir AND c.sc >= 0.60;

  -- Notes de conduite, cumulables
  v_notes := ARRAY[]::text[];
  IF NOT v_r.a_venir THEN
    v_notes := array_append(v_notes, 'Cette edition est PASSEE. Ne la recommande pas pour une visite. Si autres_editions_a_venir contient une edition, oriente vers elle.'::text);
  ELSE
    v_notes := array_append(v_notes, 'Le salon existe et a lieu aux dates indiquees. Reponds directement avec la ville, le lieu et les dates.'::text);
  END IF;
  IF v_couv = 'aucune' THEN
    v_notes := array_append(v_notes, 'Aucun exposant n''est encore reference sur Lotexpo : ne dis JAMAIS qu''il n''a pas d''exposants, dis que la liste n''est pas encore disponible.'::text);
  END IF;
  IF v_aff IS NULL THEN
    v_notes := array_append(v_notes, 'AFFLUENCE INCONNUE : ce chiffre n''est pas renseigne pour ce salon. Ne l''estime pas, ne le deduis pas du nombre d''exposants. Dis simplement que Lotexpo ne dispose pas de cette information.'::text);
  END IF;
  IF v_tarif_cat = 'non_communique' THEN
    v_notes := array_append(v_notes, 'TARIF INCONNU : dis que le tarif n''est pas renseigne sur Lotexpo. Ne renvoie JAMAIS vers le site de l''organisateur ni vers une source externe.'::text);
  END IF;

  RETURN jsonb_build_object(
    'statut', v_statut,
    'salon', jsonb_build_object(
      'nom_event', v_r.nom_event, 'ville', v_r.ville, 'lieu', v_r.nom_lieu,
      'adresse', btrim(concat_ws(', ', v_r.rue, concat_ws(' ', v_r.code_postal, v_r.ville))),
      'date_debut', v_r.date_debut, 'date_fin', v_r.date_fin, 'a_venir', v_r.a_venir,
      'type', v_r.type_event, 'secteurs', v_r.secteur,
      'description', v_desc,
      'affluence_visiteurs', v_aff,
      'affluence_source', CASE WHEN v_aff IS NULL THEN NULL ELSE btrim(v_r.affluence) END,
      'envergure', v_env,
      'tarif_categorie', v_tarif_cat,
      'tarif_detail', v_tarif_txt,
      'nb_exposants_referencees', v_n, 'couverture_exposants', v_couv,
      'page_salon', '/events/' || v_r.slug, 'slug', v_r.slug),
    'autres_editions_a_venir', v_autres,
    'note', array_to_string(v_notes, ' '));
END;
$function$;

REVOKE ALL ON FUNCTION public.fiche_salon(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fiche_salon(text) TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- match_salons_v2 : ajout des donnees qualifiantes en sortie.
-- Le type de retour evolue -> DROP prealable obligatoire.
--
-- L'affluence ne sert QUE de departage a score equivalent. Un bonus
-- multiplicatif penaliserait les 32% de salons dont l'affluence n'est pas
-- renseignee : ce serait un biais de donnee manquante, pas de pertinence.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.match_salons_v2(text, text, date, boolean, integer);

CREATE OR REPLACE FUNCTION public.match_salons_v2(p_query text DEFAULT NULL::text, p_ville text DEFAULT NULL::text, p_date_max date DEFAULT NULL::date, p_upcoming_only boolean DEFAULT true, p_k integer DEFAULT 12)
 RETURNS TABLE(nom_event text, ville text, date_debut date, date_fin date, slug text, statut text, proximite text, nb_exposants_domaine integer, affluence_visiteurs integer, envergure text, tarif_categorie text, type_event text, sim_max numeric, score numeric, categories_matchees text[])
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
           'recommande'::text, COALESCE(z.proximite,'exacte'),
           0,
           public.parse_affluence(e.affluence),
           CASE WHEN public.parse_affluence(e.affluence) IS NULL THEN NULL
                WHEN public.parse_affluence(e.affluence) < 1000 THEN 'confidentiel'
                WHEN public.parse_affluence(e.affluence) < 10000 THEN 'regional'
                WHEN public.parse_affluence(e.affluence) < 50000 THEN 'national'
                ELSE 'international' END,
           CASE WHEN nullif(btrim(coalesce(e.tarif,'')),'') IS NULL THEN 'non_communique'
                WHEN lower(btrim(e.tarif)) IN ('non communiqué','non communique','nc') THEN 'non_communique'
                WHEN lower(btrim(e.tarif)) LIKE 'voir site%' OR lower(btrim(e.tarif)) LIKE 'voir le site%'
                     OR lower(btrim(e.tarif)) LIKE '%organisateur%' THEN 'non_communique'
                WHEN lower(btrim(e.tarif)) LIKE 'gratuit%' THEN 'gratuit'
                ELSE 'payant' END,
           e.type_event,
           0::numeric, 0::numeric, ARRAY[]::text[]
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
         public.parse_affluence(e.affluence) AS aff,
         e.type_event AS tev,
         CASE WHEN nullif(btrim(coalesce(e.tarif,'')),'') IS NULL THEN 'non_communique'
              WHEN lower(btrim(e.tarif)) IN ('non communiqué','non communique','nc') THEN 'non_communique'
              WHEN lower(btrim(e.tarif)) LIKE 'voir site%' OR lower(btrim(e.tarif)) LIKE 'voir le site%'
                   OR lower(btrim(e.tarif)) LIKE '%organisateur%' THEN 'non_communique'
              WHEN lower(btrim(e.tarif)) LIKE 'gratuit%' THEN 'gratuit'
              ELSE 'payant' END AS tcat,
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
  GROUP BY e.id, e.nom_event, e.ville, e.date_debut, e.date_fin, e.slug, zo.proximite,
           e.secteur, e.affluence, e.tarif, e.type_event;

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
         l.st, l.prox, l.nb,
         l.aff,
         CASE WHEN l.aff IS NULL THEN NULL
              WHEN l.aff < 1000 THEN 'confidentiel'
              WHEN l.aff < 10000 THEN 'regional'
              WHEN l.aff < 50000 THEN 'national'
              ELSE 'international' END,
         l.tcat, l.tev,
         round(l.smax::numeric,3), round(l.sc,3), l.cats
  FROM limite l
  WHERE l.st = 'recommande' OR (v_nb_reco < 3 AND l.rn <= 2)
  ORDER BY (l.st = 'recommande') DESC, round(l.sc,2) DESC, l.aff DESC NULLS LAST, l.sc DESC
  LIMIT p_k;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_salons_v2(text, text, date, boolean, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.match_salons_v2(text, text, date, boolean, integer) TO anon, authenticated, service_role;

