-- =====================================================================
-- Lot 0 — Backend refonte page salon /events/:slug
-- Version 2 (20/08/2026) : integre le regroupement "Autres exposants"
-- Nature : additive uniquement. Aucune policy existante modifiee,
--          aucune table alteree, aucun droit d'ecriture accorde.
-- Rollback : voir bloc en fin de fichier.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Index manquants sur le materialized view des profils publics
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
--   donnees admin.
--
-- Renvoie TOUTES les categories, y compris les singletons. Le seuil
-- d'affichage est une decision produit appliquee cote frontend.
--
-- Renvoie EN PLUS une ligne finale avec category_id IS NULL portant le
-- nombre d'exposants du salon rattaches a aucune categorie. Le frontend
-- fusionne cette ligne avec les singletons pour composer le bucket
-- "Autres exposants". Sans cette ligne, ces exposants seraient
-- inaccessibles depuis la navigation par categories.
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
  WITH taxo AS (
    SELECT max(version) AS v FROM taxonomy_categories
  ),
  ev AS (
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
    CROSS JOIN taxo
    WHERE ec.version = taxo.v
  ),
  cats AS (
    SELECT
      tc.id    AS category_id,
      tc.label AS label,
      tc.slug  AS slug,
      max(ranked.n)::integer AS exhibitor_count,
      array_remove(
        array_agg(ex.nom_exposant ORDER BY ranked.rn) FILTER (WHERE ranked.rn <= 3),
        NULL
      ) AS example_names
    FROM ranked
    CROSS JOIN taxo
    JOIN taxonomy_categories tc
      ON tc.id = ranked.category_id
     AND tc.version = taxo.v
    LEFT JOIN exposants ex
      ON ex.id_exposant = ranked.id_exposant
    WHERE ranked.rn <= 3
    GROUP BY tc.id, tc.label, tc.slug
  ),
  uncat AS (
    SELECT
      NULL::uuid   AS category_id,
      NULL::text   AS label,
      NULL::text   AS slug,
      count(*)::integer AS exhibitor_count,
      NULL::text[] AS example_names
    FROM part
    CROSS JOIN taxo
    WHERE NOT EXISTS (
      SELECT 1 FROM exhibitor_categories ec
      WHERE ec.exhibitor_id = part.id_exposant
        AND ec.version = taxo.v
    )
    HAVING count(*) > 0
  )
  SELECT * FROM cats
  UNION ALL
  SELECT * FROM uncat
  ORDER BY (category_id IS NULL) ASC, 4 DESC, 2 ASC;
$$;

COMMENT ON FUNCTION public.get_public_event_categories(uuid) IS
  'Lecture seule. Categories d''exposants agregees pour la page publique d''un salon. La ligne finale avec category_id NULL compte les exposants non categorises. Ne renvoie rien si l''evenement est invisible ou de test, sauf pour un admin.';

REVOKE ALL ON FUNCTION public.get_public_event_categories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_categories(uuid) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. RPC exposants pour une ou plusieurs categories
--
-- Accepte un tableau de category_id afin que le bucket
-- "Autres exposants" (agregation de N singletons) soit servi par le
-- meme appel qu'une categorie normale, sans dupliquer la regle metier
-- en base.
--
-- p_include_uncategorized ajoute les exposants du salon rattaches a
-- aucune categorie. Utilise uniquement pour le bucket "Autres".
--
-- Ordonne les exposants les plus riches visuellement en premier
-- (logo puis fiche publique), sans jamais en exclure aucun.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_public_event_exhibitors_by_category(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_public_event_exhibitors_by_category(uuid, uuid[], boolean, integer, integer);

CREATE OR REPLACE FUNCTION public.get_public_event_exhibitors_by_category(
  p_event_id               uuid,
  p_category_ids           uuid[],
  p_include_uncategorized  boolean DEFAULT false,
  p_limit                  integer DEFAULT 24,
  p_offset                 integer DEFAULT 0
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
  WITH taxo AS (
    SELECT max(version) AS v FROM taxonomy_categories
  ),
  ev AS (
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
  selected AS (
    SELECT part.id_exposant, part.stand, min(ec.distance) AS distance
    FROM part
    CROSS JOIN taxo
    JOIN exhibitor_categories ec
      ON ec.exhibitor_id = part.id_exposant
     AND ec.version = taxo.v
     AND ec.category_id = ANY (COALESCE(p_category_ids, ARRAY[]::uuid[]))
    GROUP BY part.id_exposant, part.stand

    UNION

    SELECT part.id_exposant, part.stand, NULL::double precision
    FROM part
    CROSS JOIN taxo
    WHERE COALESCE(p_include_uncategorized, false) IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM exhibitor_categories ec
        WHERE ec.exhibitor_id = part.id_exposant
          AND ec.version = taxo.v
      )
  )
  SELECT
    selected.id_exposant,
    COALESCE(mv.display_name, ex.nom_exposant)                              AS display_name,
    CASE WHEN COALESCE(mv.is_test, false) THEN NULL ELSE mv.logo_url END    AS logo_url,
    selected.stand,
    CASE WHEN COALESCE(mv.is_test, false) THEN NULL ELSE mv.public_slug END AS public_slug,
    COALESCE(mv.seo_indexable, false)                                       AS seo_indexable,
    COALESCE(mv.is_verified, false)                                         AS is_verified,
    count(*) OVER ()::integer                                               AS total_count
  FROM selected
  LEFT JOIN public_exhibitor_profiles_mv mv
    ON mv.legacy_exposant_id = selected.id_exposant
  LEFT JOIN exposants ex
    ON ex.id_exposant = selected.id_exposant
  WHERE COALESCE(mv.display_name, ex.nom_exposant) IS NOT NULL
  ORDER BY
    (mv.logo_url IS NOT NULL) DESC,
    (mv.public_slug IS NOT NULL) DESC,
    selected.distance ASC NULLS LAST,
    display_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.get_public_event_exhibitors_by_category(uuid, uuid[], boolean, integer, integer) IS
  'Lecture seule. Exposants d''une ou plusieurs categories sur un salon, pour le carousel public. p_include_uncategorized sert le bucket "Autres exposants". Limite bornee a 50. Ne renvoie rien si l''evenement est invisible ou de test, sauf pour un admin.';

REVOKE ALL ON FUNCTION public.get_public_event_exhibitors_by_category(uuid, uuid[], boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_exhibitors_by_category(uuid, uuid[], boolean, integer, integer) TO anon, authenticated;


-- =====================================================================
-- VERIFICATIONS A EXECUTER APRES APPLICATION
-- =====================================================================

-- V1. Les index sont bien crees
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname='public' AND tablename='public_exhibitor_profiles_mv';
-- Attendu : 5 index, dont idx_pep_mv_legacy_exposant et idx_pep_mv_exhibitor_id

-- V2. Les fonctions sont SECURITY DEFINER, STABLE, search_path fixe
-- SELECT p.proname, p.prosecdef, p.provolatile, p.proconfig
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname LIKE 'get_public_event_%';
-- Attendu : prosecdef=true, provolatile='s', proconfig={search_path=public}

-- V3. Aucune policy publique ajoutee sur les tables taxonomy
-- SELECT c.relname, p.polname FROM pg_policy p
-- JOIN pg_class c ON c.oid=p.polrelid
-- WHERE c.relname IN ('event_profiles','taxonomy_categories','exhibitor_categories');
-- Attendu : exactement 3 lignes, toutes en admin_full_access_*

-- V4. Droits limites a EXECUTE pour anon et authenticated
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name LIKE 'get_public_event_%';

-- V5. Test fonctionnel, Premiere Vision Paris (407 exposants)
-- SELECT * FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1'));
-- Attendu : 35 lignes = 34 categories + 1 ligne category_id NULL a 5.
-- La premiere ligne doit etre a 131 exposants, la derniere doit etre
-- celle a NULL.

-- V6. Le bucket "Autres" est bien complet
-- Attendu d'apres l'audit : 15 categories singleton + 5 non categorises
-- = 20 exposants dans le bucket "Autres exposants".
-- WITH c AS (SELECT * FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1')))
-- SELECT
--   (SELECT count(*) FROM c WHERE exhibitor_count=1 AND category_id IS NOT NULL) AS singletons,
--   (SELECT coalesce(max(exhibitor_count),0) FROM c WHERE category_id IS NULL) AS non_categorises;

-- V7. Le carousel "Autres" retourne bien les 20
-- WITH c AS (SELECT * FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1')))
-- SELECT total_count FROM public.get_public_event_exhibitors_by_category(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1'),
--   (SELECT array_agg(category_id) FROM c WHERE exhibitor_count=1 AND category_id IS NOT NULL),
--   true, 50, 0) LIMIT 1;
-- Attendu : 20

-- V8. Aucun exposant perdu. Somme des buckets = total du salon.
-- Les categories peuvent se chevaucher si un exposant a plusieurs
-- categories : verifier l'union distincte, pas la somme des compteurs.

-- V9. Garde de visibilite sur un evenement invisible
-- SELECT count(*) FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE visible IS NOT TRUE LIMIT 1));
-- Attendu : 0. Rappel : execute_sql via MCP tourne sans auth.uid(),
-- donc is_admin() y est toujours faux, ce test valide le cas anonyme.

-- V10. Perf, doit rester sous 20 ms sur le pire cas
-- EXPLAIN (ANALYZE) SELECT * FROM public.get_public_event_categories(
--   (SELECT id FROM events WHERE slug='premiere-vision-paris-1'));

-- V11. Cache PostgREST, si 404 sur les nouvelles RPC depuis le front
-- NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.get_public_event_exhibitors_by_category(uuid, uuid[], boolean, integer, integer);
-- DROP FUNCTION IF EXISTS public.get_public_event_categories(uuid);
-- DROP INDEX IF EXISTS public.idx_pep_mv_legacy_exposant;
-- DROP INDEX IF EXISTS public.idx_pep_mv_exhibitor_id;
-- Aucune donnee affectee, aucun objet existant modifie.
