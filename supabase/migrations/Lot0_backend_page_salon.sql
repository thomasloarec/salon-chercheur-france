-- =====================================================================
-- Lot 0 — Backend refonte page salon /events/:slug
-- Date : 2026-08-20
-- Nature : additive uniquement. Aucune policy existante modifiee,
--          aucune table alteree, aucun droit d'ecriture accorde.
-- Rollback : voir bloc en fin de fichier.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Index manquant sur le materialized view des profils publics
--
-- Constat mesure le 20/08/2026 : public_exhibitor_profiles_mv n'a aucun
-- index sur legacy_exposant_id. Une jointure sur cette colonne declenche
-- un Seq Scan de 847 ms sur 27 429 lignes, ce qui fait passer la requete
-- des categories de 6,7 ms a 1 665 ms.
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pep_mv_legacy_exposant
  ON public.public_exhibitor_profiles_mv (legacy_exposant_id)
  WHERE legacy_exposant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pep_mv_exhibitor_id
  ON public.public_exhibitor_profiles_mv (exhibitor_id)
  WHERE exhibitor_id IS NOT NULL;

ANALYZE public.public_exhibitor_profiles_mv;


-- ---------------------------------------------------------------------
-- 2. RPC categories d'un evenement
--
-- Expose uniquement des donnees publiques agregees :
--   id de categorie, libelle, slug, nombre d'exposants, 3 exemples.
-- N'expose jamais : centroid, embeddings, distance brute, donnees CRM,
--   donnees admin, exposants de test.
--
-- Garde de visibilite : l'evenement doit etre visible et non-test,
--   sauf pour un admin (mode apercu).
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_public_event_categories(uuid);

CREATE OR REPLACE FUNCTION public.get_public_event_categories(p_event_id uuid)
RETURNS TABLE (
  category_id      uuid,
  label            text,
  slug             text,
  exhibitor_count  integer,
  example_names    text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH ev AS (
    SELECT e.id
    FROM events e
    WHERE e.id = p_event_id
      AND (
        (e.visible IS TRUE AND e.is_test IS FALSE)
        OR public.is_admin()
      )
  ),
  part AS (
    SELECT DISTINCT p.id_exposant
    FROM participation p
    JOIN ev ON p.id_event = ev.id
    WHERE p.id_exposant IS NOT NULL
  ),
  ranked AS (
    SELECT
      ec.category_id,
      part.id_exposant,
      row_number() OVER (
        PARTITION BY ec.category_id
        ORDER BY ec.distance ASC NULLS LAST, part.id_exposant
      ) AS rn,
      count(*) OVER (PARTITION BY ec.category_id) AS n
    FROM exhibitor_categories ec
    JOIN part ON part.id_exposant = ec.exhibitor_id
    WHERE ec.version = (SELECT max(version) FROM taxonomy_categories)
  )
  SELECT
    tc.id,
    tc.label,
    tc.slug,
    max(ranked.n)::integer,
    array_remove(
      array_agg(ex.nom_exposant ORDER BY ranked.rn) FILTER (WHERE ranked.rn <= 3),
      NULL
    )
  FROM ranked
  JOIN taxonomy_categories tc
    ON tc.id = ranked.category_id
   AND tc.version = (SELECT max(version) FROM taxonomy_categories)
  LEFT JOIN exposants ex
    ON ex.id_exposant = ranked.id_exposant
  WHERE ranked.rn <= 3
  GROUP BY tc.id, tc.label, tc.slug
  ORDER BY 4 DESC, tc.label ASC;
$$;

COMMENT ON FUNCTION public.get_public_event_categories(uuid) IS
  'Lecture seule. Categories d''exposants agregees pour la page publique d''un salon. Ne renvoie rien si l''evenement est invisible ou de test, sauf pour un admin.';

REVOKE ALL ON FUNCTION public.get_public_event_categories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_categories(uuid) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. RPC exposants d'une categorie sur un evenement
--
-- Alimente le carousel sous les cartes de categorie.
-- Ordonne les exposants les plus riches visuellement en premier
-- (logo puis fiche publique), sans jamais en exclure aucun.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_public_event_exhibitors_by_category(uuid, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_public_event_exhibitors_by_category(
  p_event_id     uuid,
  p_category_id  uuid,
  p_limit        integer DEFAULT 24,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id_exposant    text,
  display_name   text,
  logo_url       text,
  stand          text,
  public_slug    text,
  seo_indexable  boolean,
  is_verified    boolean,
  total_count    integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH ev AS (
    SELECT e.id
    FROM events e
    WHERE e.id = p_event_id
      AND (
        (e.visible IS TRUE AND e.is_test IS FALSE)
        OR public.is_admin()
      )
  ),
  part AS (
    SELECT p.id_exposant, min(p.stand_exposant) AS stand
    FROM participation p
    JOIN ev ON p.id_event = ev.id
    WHERE p.id_exposant IS NOT NULL
    GROUP BY p.id_exposant
  ),
  in_cat AS (
    SELECT part.id_exposant, part.stand, ec.distance
    FROM part
    JOIN exhibitor_categories ec
      ON ec.exhibitor_id = part.id_exposant
     AND ec.category_id = p_category_id
     AND ec.version = (SELECT max(version) FROM taxonomy_categories)
  )
  SELECT
    in_cat.id_exposant,
    COALESCE(mv.display_name, ex.nom_exposant)                        AS display_name,
    CASE WHEN COALESCE(mv.is_test, false) THEN NULL ELSE mv.logo_url END AS logo_url,
    in_cat.stand,
    CASE WHEN COALESCE(mv.is_test, false) THEN NULL ELSE mv.public_slug END AS public_slug,
    COALESCE(mv.seo_indexable, false)                                 AS seo_indexable,
    COALESCE(mv.is_verified, false)                                   AS is_verified,
    count(*) OVER ()::integer                                         AS total_count
  FROM in_cat
  LEFT JOIN public_exhibitor_profiles_mv mv
    ON mv.legacy_exposant_id = in_cat.id_exposant
  LEFT JOIN exposants ex
    ON ex.id_exposant = in_cat.id_exposant
  WHERE COALESCE(mv.display_name, ex.nom_exposant) IS NOT NULL
  ORDER BY
    (mv.logo_url IS NOT NULL) DESC,
    (mv.public_slug IS NOT NULL) DESC,
    in_cat.distance ASC NULLS LAST,
    display_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.get_public_event_exhibitors_by_category(uuid, uuid, integer, integer) IS
  'Lecture seule. Exposants d''une categorie donnee sur un salon, pour le carousel public. Limite bornee a 50. Ne renvoie rien si l''evenement est invisible ou de test, sauf pour un admin.';

REVOKE ALL ON FUNCTION public.get_public_event_exhibitors_by_category(uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_exhibitors_by_category(uuid, uuid, integer, integer) TO anon, authenticated;


-- =====================================================================
-- VERIFICATIONS A EXECUTER APRES APPLICATION
-- =====================================================================

-- V1. Les index sont bien crees
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname='public' AND tablename='public_exhibitor_profiles_mv';
-- Attendu : 5 index, dont idx_pep_mv_legacy_exposant et idx_pep_mv_exhibitor_id

-- V2. Les fonctions sont bien SECURITY DEFINER, STABLE, search_path fixe
-- SELECT p.proname, p.prosecdef, p.provolatile, p.proconfig
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname LIKE 'get_public_event_%';
-- Attendu : prosecdef=true, provolatile='s', proconfig={search_path=public}

-- V3. Aucune policy publique n'a ete ajoutee sur les tables taxonomy
-- SELECT c.relname, p.polname FROM pg_policy p
-- JOIN pg_class c ON c.oid=p.polrelid
-- WHERE c.relname IN ('event_profiles','taxonomy_categories','exhibitor_categories');
-- Attendu : exactement 3 lignes, toutes en admin_full_access_*

-- V4. Les droits sont limites a EXECUTE pour anon et authenticated
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name LIKE 'get_public_event_%';
-- Attendu : uniquement EXECUTE pour anon et authenticated (plus postgres proprietaire)

-- V5. Test fonctionnel sur le pire cas, Premiere Vision Paris 407 exposants
-- SELECT * FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1')
-- );
-- Attendu : 34 lignes, premiere ligne vers 131 exposants, exemples non nuls

-- V6. Test de la garde de visibilite avec un evenement invisible
-- SELECT count(*) FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE visible IS NOT TRUE LIMIT 1)
-- );
-- Attendu : 0 en contexte non-admin.
-- Rappel : execute_sql via MCP tourne sans auth.uid(), donc is_admin() y est
-- toujours faux. Ce test valide bien le comportement visiteur anonyme.

-- V7. Test du carousel sur la plus grosse categorie
-- WITH c AS (
--   SELECT category_id FROM public.get_public_event_categories(
--     (SELECT id FROM events WHERE slug='premiere-vision-paris-1')
--   ) LIMIT 1
-- )
-- SELECT * FROM public.get_public_event_exhibitors_by_category(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1'),
--   (SELECT category_id FROM c), 12, 0
-- );
-- Attendu : 12 lignes, total_count coherent avec exhibitor_count de V5

-- V8. Perf, doit rester sous 20 ms
-- EXPLAIN (ANALYZE) SELECT * FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1')
-- );

-- V9. Cache PostgREST, si erreur 404 sur les nouvelles RPC depuis le front
-- NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.get_public_event_exhibitors_by_category(uuid, uuid, integer, integer);
-- DROP FUNCTION IF EXISTS public.get_public_event_categories(uuid);
-- DROP INDEX IF EXISTS public.idx_pep_mv_legacy_exposant;
-- DROP INDEX IF EXISTS public.idx_pep_mv_exhibitor_id;
-- Aucune donnee n'est affectee, aucun objet existant n'est modifie.
