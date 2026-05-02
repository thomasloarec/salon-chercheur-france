
-- ============================================================================
-- STRUCTURE : archive + fonctions de remappage
-- Aucune donnée n'est modifiée par cette migration. L'exécution réelle se fait
-- dans un second temps via SELECT public.run_exhibitor_ai_remap();
-- ============================================================================

-- 1) Table d'archive
CREATE TABLE IF NOT EXISTS public.exhibitor_ai_remap_archive (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_ai_id uuid NOT NULL,
  old_exhibitor_id text NOT NULL,
  new_exhibitor_id text,
  operation text NOT NULL CHECK (operation IN
    ('backup_before_remap','remap_conflict_loser','unmapped_orphan')),
  reason text,
  original_row jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remap_archive_old ON public.exhibitor_ai_remap_archive(old_exhibitor_id);
CREATE INDEX IF NOT EXISTS idx_remap_archive_new ON public.exhibitor_ai_remap_archive(new_exhibitor_id);
CREATE INDEX IF NOT EXISTS idx_remap_archive_op  ON public.exhibitor_ai_remap_archive(operation);

ALTER TABLE public.exhibitor_ai_remap_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read remap archive" ON public.exhibitor_ai_remap_archive;
CREATE POLICY "Admins can read remap archive"
  ON public.exhibitor_ai_remap_archive
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role manages remap archive" ON public.exhibitor_ai_remap_archive;
CREATE POLICY "Service role manages remap archive"
  ON public.exhibitor_ai_remap_archive
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2) Verrou applicatif global pour empêcher l'enrichissement pendant la migration
CREATE TABLE IF NOT EXISTS public.system_locks (
  lock_name text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
ALTER TABLE public.system_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read system locks" ON public.system_locks;
CREATE POLICY "Admins read system locks" ON public.system_locks
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Service role manages system locks" ON public.system_locks;
CREATE POLICY "Service role manages system locks" ON public.system_locks
  FOR ALL TO public USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

-- 3) Fonction de scoring (utilitaire interne)
CREATE OR REPLACE FUNCTION public._exhibitor_ai_completeness(a public.exhibitor_ai)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT
    (CASE WHEN length(coalesce(a.resume_court,'')) > 30 THEN 2 ELSE 0 END
     + CASE WHEN a.resume_court ILIKE ANY (ARRAY['%insuffisant%','%impossible%analyser%','%insuffisantes%']) THEN -3 ELSE 0 END
     + CASE WHEN coalesce(a.secteur_principal,'') <> '' THEN 1 ELSE 0 END
     + CASE WHEN jsonb_array_length(coalesce(a.sous_secteurs,'[]'::jsonb)) > 0 THEN 1 ELSE 0 END
     + CASE WHEN jsonb_array_length(coalesce(a.produits_services,'[]'::jsonb)) > 0 THEN 1 ELSE 0 END
     + CASE WHEN jsonb_array_length(coalesce(a.mots_cles_metier,'[]'::jsonb)) > 0 THEN 1 ELSE 0 END
     + CASE WHEN jsonb_array_length(coalesce(a.profils_visiteurs,'[]'::jsonb)) > 0 THEN 1 ELSE 0 END
     + CASE WHEN jsonb_array_length(coalesce(a.type_interet,'[]'::jsonb)) > 0 THEN 1 ELSE 0 END
    );
$$;

-- 4) Fonction principale : exécution réelle de la migration en transaction
CREATE OR REPLACE FUNCTION public.run_exhibitor_ai_remap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup_count int := 0;
  v_conflict_count int := 0;
  v_remapped int := 0;
  v_unmapped_archived int := 0;
  v_final_valid int := 0;
  v_final_orphans int := 0;
  v_total_exp int := 0;
  v_remaining_with_site int := 0;
  v_remaining_total int := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Empêcher double exécution
  IF EXISTS (SELECT 1 FROM public.exhibitor_ai_remap_archive WHERE operation = 'backup_before_remap') THEN
    RAISE EXCEPTION 'Migration déjà exécutée (snapshot trouvé). Utilisez restore si besoin.';
  END IF;

  -- Pose le verrou applicatif
  INSERT INTO public.system_locks(lock_name, reason)
  VALUES ('exhibitor_ai_remap', 'Migration en cours: PK numérique → id_exposant')
  ON CONFLICT (lock_name) DO NOTHING;

  -- Verrou table pour éviter inserts concurrents pendant la migration
  LOCK TABLE public.exhibitor_ai IN SHARE ROW EXCLUSIVE MODE;

  ----------------------------------------------------------------------------
  -- ÉTAPE 1 : snapshot complet (backup_before_remap) de toutes les lignes
  -- qui vont changer (orphelines numériques mappables)
  ----------------------------------------------------------------------------
  WITH targets AS (
    SELECT a.*, e.id_exposant AS new_id
    FROM public.exhibitor_ai a
    JOIN public.exposants e ON a.exhibitor_id ~ '^[0-9]+$' AND e.id = a.exhibitor_id::int
    WHERE NOT EXISTS (SELECT 1 FROM public.exposants e2 WHERE e2.id_exposant = a.exhibitor_id)
  ), inserted AS (
    INSERT INTO public.exhibitor_ai_remap_archive
      (original_ai_id, old_exhibitor_id, new_exhibitor_id, operation, reason, original_row)
    SELECT t.id, t.exhibitor_id, t.new_id,
           'backup_before_remap',
           'Snapshot avant remappage PK numérique → id_exposant',
           to_jsonb(t) - 'new_id'
    FROM targets t
    RETURNING 1
  )
  SELECT count(*) INTO v_backup_count FROM inserted;

  ----------------------------------------------------------------------------
  -- ÉTAPE 2 : résoudre les conflits (où la cible id_exposant a déjà une ligne)
  ----------------------------------------------------------------------------
  WITH pairs AS (
    SELECT
      e.id_exposant,
      e.website_exposant,
      av.id AS valid_id,
      ao.id AS orphan_id,
      public._exhibitor_ai_completeness(av) AS valid_score,
      public._exhibitor_ai_completeness(ao) AS orphan_score,
      av.enriched_at AS valid_date,
      ao.enriched_at AS orphan_date,
      (regexp_replace(regexp_replace(lower(coalesce(e.website_exposant,'')), '^https?://(www\.)?',''),'/.*$','')
         = regexp_replace(regexp_replace(lower(coalesce(av.source_url,'')), '^https?://(www\.)?',''),'/.*$','')) AS valid_domain_ok,
      (regexp_replace(regexp_replace(lower(coalesce(e.website_exposant,'')), '^https?://(www\.)?',''),'/.*$','')
         = regexp_replace(regexp_replace(lower(coalesce(ao.source_url,'')), '^https?://(www\.)?',''),'/.*$','')) AS orphan_domain_ok
    FROM public.exhibitor_ai ao
    JOIN public.exposants e ON ao.exhibitor_id ~ '^[0-9]+$' AND e.id = ao.exhibitor_id::int
    JOIN public.exhibitor_ai av ON av.exhibitor_id = e.id_exposant
    WHERE NOT EXISTS (SELECT 1 FROM public.exposants e2 WHERE e2.id_exposant = ao.exhibitor_id)
  ),
  decisions AS (
    SELECT
      *,
      CASE
        WHEN orphan_score > valid_score + 1 THEN orphan_id
        WHEN valid_score > orphan_score + 1 THEN valid_id
        WHEN orphan_domain_ok AND NOT valid_domain_ok THEN orphan_id
        WHEN valid_domain_ok AND NOT orphan_domain_ok THEN valid_id
        WHEN orphan_date > valid_date THEN orphan_id
        ELSE valid_id
      END AS keep_id,
      CASE
        WHEN orphan_score > valid_score + 1 THEN valid_id
        WHEN valid_score > orphan_score + 1 THEN orphan_id
        WHEN orphan_domain_ok AND NOT valid_domain_ok THEN valid_id
        WHEN valid_domain_ok AND NOT orphan_domain_ok THEN orphan_id
        WHEN orphan_date > valid_date THEN valid_id
        ELSE orphan_id
      END AS lose_id,
      CASE
        WHEN orphan_score > valid_score + 1 THEN 'KEEP_ORPHAN_completeness'
        WHEN valid_score > orphan_score + 1 THEN 'KEEP_VALID_completeness'
        WHEN orphan_domain_ok AND NOT valid_domain_ok THEN 'KEEP_ORPHAN_domain'
        WHEN valid_domain_ok AND NOT orphan_domain_ok THEN 'KEEP_VALID_domain'
        WHEN orphan_date > valid_date THEN 'KEEP_ORPHAN_recent'
        ELSE 'KEEP_VALID_default'
      END AS decision_reason
  ),
  archived_losers AS (
    INSERT INTO public.exhibitor_ai_remap_archive
      (original_ai_id, old_exhibitor_id, new_exhibitor_id, operation, reason, original_row)
    SELECT a.id, a.exhibitor_id, d.id_exposant,
           'remap_conflict_loser',
           'Conflit avec exposant déjà enrichi — décision: ' || d.decision_reason,
           to_jsonb(a)
    FROM decisions d
    JOIN public.exhibitor_ai a ON a.id = d.lose_id
    RETURNING 1
  )
  SELECT count(*) INTO v_conflict_count FROM archived_losers;

  -- Supprimer les perdants (donnée déjà dans l'archive)
  DELETE FROM public.exhibitor_ai a
  USING (
    SELECT
      CASE
        WHEN public._exhibitor_ai_completeness(ao) > public._exhibitor_ai_completeness(av) + 1 THEN av.id
        WHEN public._exhibitor_ai_completeness(av) > public._exhibitor_ai_completeness(ao) + 1 THEN ao.id
        WHEN ao.enriched_at > av.enriched_at THEN av.id
        ELSE ao.id
      END AS lose_id
    FROM public.exhibitor_ai ao
    JOIN public.exposants e ON ao.exhibitor_id ~ '^[0-9]+$' AND e.id = ao.exhibitor_id::int
    JOIN public.exhibitor_ai av ON av.exhibitor_id = e.id_exposant
    WHERE NOT EXISTS (SELECT 1 FROM public.exposants e2 WHERE e2.id_exposant = ao.exhibitor_id)
  ) d
  WHERE a.id = d.lose_id;

  ----------------------------------------------------------------------------
  -- ÉTAPE 3 : remappage massif (plus de conflit possible)
  ----------------------------------------------------------------------------
  WITH upd AS (
    UPDATE public.exhibitor_ai a
    SET exhibitor_id = e.id_exposant
    FROM public.exposants e
    WHERE a.exhibitor_id ~ '^[0-9]+$'
      AND e.id = a.exhibitor_id::int
      AND NOT EXISTS (SELECT 1 FROM public.exposants e2 WHERE e2.id_exposant = a.exhibitor_id)
    RETURNING 1
  )
  SELECT count(*) INTO v_remapped FROM upd;

  ----------------------------------------------------------------------------
  -- ÉTAPE 4 : archiver les vraiment non remappables (sans suppression)
  ----------------------------------------------------------------------------
  WITH unmapped AS (
    INSERT INTO public.exhibitor_ai_remap_archive
      (original_ai_id, old_exhibitor_id, new_exhibitor_id, operation, reason, original_row)
    SELECT a.id, a.exhibitor_id, NULL, 'unmapped_orphan',
           'Aucun exposant ne correspond (ni id_exposant ni id PK)',
           to_jsonb(a)
    FROM public.exhibitor_ai a
    WHERE NOT EXISTS (SELECT 1 FROM public.exposants e WHERE e.id_exposant = a.exhibitor_id)
    RETURNING 1
  )
  SELECT count(*) INTO v_unmapped_archived FROM unmapped;

  ----------------------------------------------------------------------------
  -- ÉTAPE 5 : compteurs finaux
  ----------------------------------------------------------------------------
  SELECT count(*) INTO v_final_valid
  FROM public.exhibitor_ai a
  WHERE EXISTS (SELECT 1 FROM public.exposants e WHERE e.id_exposant = a.exhibitor_id);

  SELECT count(*) INTO v_final_orphans
  FROM public.exhibitor_ai a
  WHERE NOT EXISTS (SELECT 1 FROM public.exposants e WHERE e.id_exposant = a.exhibitor_id);

  SELECT count(*) INTO v_total_exp FROM public.exposants WHERE id_exposant IS NOT NULL;

  SELECT count(*) INTO v_remaining_with_site
  FROM public.exposants e
  WHERE e.id_exposant IS NOT NULL
    AND e.website_exposant IS NOT NULL AND e.website_exposant <> ''
    AND NOT EXISTS (SELECT 1 FROM public.exhibitor_ai a WHERE a.exhibitor_id = e.id_exposant);

  SELECT count(*) INTO v_remaining_total
  FROM public.exposants e
  WHERE e.id_exposant IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.exhibitor_ai a WHERE a.exhibitor_id = e.id_exposant);

  -- Lever le verrou
  DELETE FROM public.system_locks WHERE lock_name = 'exhibitor_ai_remap';

  RETURN jsonb_build_object(
    'ok', true,
    'backup_count', v_backup_count,
    'conflicts_archived', v_conflict_count,
    'remapped', v_remapped,
    'unmapped_archived_kept', v_unmapped_archived,
    'final_valid', v_final_valid,
    'final_orphans', v_final_orphans,
    'total_exposants', v_total_exp,
    'remaining_with_site', v_remaining_with_site,
    'remaining_total', v_remaining_total
  );
END;
$$;

-- 5) Bloquer la fonction d'enrichissement pendant un verrou actif
CREATE OR REPLACE FUNCTION public.list_exposants_to_enrich(p_limit integer DEFAULT 50)
RETURNS TABLE(id_exposant text, nom_exposant text, website_exposant text, exposant_description text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Bloquer si une migration est en cours
  IF EXISTS (SELECT 1 FROM public.system_locks WHERE lock_name = 'exhibitor_ai_remap') THEN
    RAISE EXCEPTION 'Enrichment temporarily disabled: remap migration in progress';
  END IF;

  RETURN QUERY
  SELECT e.id_exposant, e.nom_exposant, e.website_exposant, e.exposant_description
  FROM public.exposants e
  LEFT JOIN public.exhibitor_ai a ON a.exhibitor_id = e.id_exposant
  WHERE e.id_exposant IS NOT NULL
    AND e.website_exposant IS NOT NULL
    AND e.website_exposant <> ''
    AND a.exhibitor_id IS NULL
  ORDER BY e.created_at ASC NULLS LAST, e.id_exposant ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;
