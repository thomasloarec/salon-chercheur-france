-- Migration 2 : reclassement automatique des catégories exposants (05/10/2026)
-- Bug : assign_pending_categories ne classait que les exposants JAMAIS classés. Après un
-- réenrichissement + réembedding, la catégorie restait figée (4 642 fiches, dont 934 dans
-- une catégorie d'un autre secteur).
-- Correctifs :
--  a) assign_pending_categories reclasse aussi les fiches dont l'embedding est plus récent
--     que la catégorie, ou dont le secteur a changé (mise à jour de la ligne existante).
--  b) refresh_stale_event_profiles reconstruit aussi le profil d'un salon quand la catégorie
--     ou l'embedding d'un de ses exposants a changé depuis le dernier calcul (sinon le
--     reclassement ne se propage jamais aux profils salons / recos / Mon Marché).
--  c) Le cron des profils salons tourne sans limite de 120 s (évite un ROLLBACK silencieux
--     lors d'un gros rattrapage).

CREATE OR REPLACE FUNCTION public.assign_pending_categories(p_version integer DEFAULT 1)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assigned integer;
BEGIN
  WITH pending AS (
    SELECT em.exhibitor_id, ai.secteur_id, em.embedding
    FROM exhibitor_embeddings em
    JOIN exhibitor_ai ai ON ai.exhibitor_id::text = em.exhibitor_id
    WHERE ai.secteur_id IS NOT NULL
      -- À (re)classer : aucune catégorie à jour (calculée après le dernier embedding
      -- ET appartenant au secteur actuel de l'exposant)
      AND NOT EXISTS (
        SELECT 1 FROM exhibitor_categories ec
        JOIN taxonomy_categories tc ON tc.id = ec.category_id
        WHERE ec.version = p_version AND ec.exhibitor_id = em.exhibitor_id
          AND ec.assigned_at >= em.embedded_at
          AND tc.secteur_id = ai.secteur_id
      )
  ),
  best AS (
    SELECT p.exhibitor_id,
           c.id AS category_id,
           (c.centroid <=> p.embedding) AS dist,
           row_number() OVER (
             PARTITION BY p.exhibitor_id
             ORDER BY c.centroid <=> p.embedding
           ) AS rn
    FROM pending p
    JOIN taxonomy_categories c
      ON c.version = p_version AND c.secteur_id = p.secteur_id
  ),
  ins AS (
    INSERT INTO exhibitor_categories (version, exhibitor_id, category_id, distance, assigned_at)
    SELECT p_version, exhibitor_id, category_id, dist, now()
    FROM best WHERE rn = 1
    ON CONFLICT (version, exhibitor_id) DO UPDATE
      SET category_id = excluded.category_id,
          distance    = excluded.distance,
          assigned_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_assigned FROM ins;

  RETURN v_assigned;
END;
$function$;

DO $$
DECLARE
  d text := pg_get_functiondef('public.refresh_stale_event_profiles()'::regprocedure);
  d0 text := d;
  old_c text := $o$        OR p.first_seen_at > ep.computed_at
      )$o$;
  new_c text := $n$        OR p.first_seen_at > ep.computed_at
        -- Exposant reclassé ou réembeddé depuis le calcul du profil
        OR EXISTS (SELECT 1 FROM exhibitor_categories ec
                   WHERE ec.version = 1 AND ec.exhibitor_id = p.id_exposant
                     AND ec.assigned_at > ep.computed_at)
        OR EXISTS (SELECT 1 FROM exhibitor_embeddings em
                   WHERE em.exhibitor_id = p.id_exposant
                     AND em.embedded_at > ep.computed_at)
      )$n$;
BEGIN
  -- Neutralise les retours à la ligne Windows (copier-coller)
  old_c := replace(old_c, E'\r', ''); new_c := replace(new_c, E'\r', '');
  IF position(old_c in d) = 0 THEN RAISE EXCEPTION 'STOP: condition introuvable dans refresh_stale_event_profiles'; END IF;
  d := replace(d, old_c, new_c);
  IF d = d0 THEN RAISE EXCEPTION 'STOP: aucune modification'; END IF;
  EXECUTE d;
END $$;

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'refresh-event-profiles-daily'),
  command := 'SET statement_timeout = 0; SELECT public.refresh_stale_event_profiles();'
);
