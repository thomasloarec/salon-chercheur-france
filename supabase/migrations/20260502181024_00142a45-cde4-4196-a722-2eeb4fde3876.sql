
-- Nettoyage défensif du verrou si laissé en place par tentative avortée
DELETE FROM public.system_locks WHERE lock_name = 'exhibitor_ai_remap';

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

  IF EXISTS (SELECT 1 FROM public.exhibitor_ai_remap_archive WHERE operation = 'backup_before_remap') THEN
    RAISE EXCEPTION 'Migration déjà exécutée (snapshot trouvé). Utilisez restore si besoin.';
  END IF;

  INSERT INTO public.system_locks(lock_name, reason)
  VALUES ('exhibitor_ai_remap', 'Migration en cours: PK numérique → id_exposant')
  ON CONFLICT (lock_name) DO NOTHING;

  LOCK TABLE public.exhibitor_ai IN SHARE ROW EXCLUSIVE MODE;

  -- Table temp pour décisions de conflit (calcul une seule fois)
  CREATE TEMP TABLE _remap_decisions ON COMMIT DROP AS
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
  )
  SELECT
    p.id_exposant,
    CASE
      WHEN p.orphan_score > p.valid_score + 1 THEN p.orphan_id
      WHEN p.valid_score > p.orphan_score + 1 THEN p.valid_id
      WHEN p.orphan_domain_ok AND NOT p.valid_domain_ok THEN p.orphan_id
      WHEN p.valid_domain_ok AND NOT p.orphan_domain_ok THEN p.valid_id
      WHEN p.orphan_date > p.valid_date THEN p.orphan_id
      ELSE p.valid_id
    END AS keep_id,
    CASE
      WHEN p.orphan_score > p.valid_score + 1 THEN p.valid_id
      WHEN p.valid_score > p.orphan_score + 1 THEN p.orphan_id
      WHEN p.orphan_domain_ok AND NOT p.valid_domain_ok THEN p.valid_id
      WHEN p.valid_domain_ok AND NOT p.orphan_domain_ok THEN p.orphan_id
      WHEN p.orphan_date > p.valid_date THEN p.valid_id
      ELSE p.orphan_id
    END AS lose_id,
    CASE
      WHEN p.orphan_score > p.valid_score + 1 THEN 'KEEP_ORPHAN_completeness'
      WHEN p.valid_score > p.orphan_score + 1 THEN 'KEEP_VALID_completeness'
      WHEN p.orphan_domain_ok AND NOT p.valid_domain_ok THEN 'KEEP_ORPHAN_domain'
      WHEN p.valid_domain_ok AND NOT p.orphan_domain_ok THEN 'KEEP_VALID_domain'
      WHEN p.orphan_date > p.valid_date THEN 'KEEP_ORPHAN_recent'
      ELSE 'KEEP_VALID_default'
    END AS decision_reason
  FROM pairs p;

  ----------------------------------------------------------------------------
  -- ÉTAPE 1 : snapshot des lignes orphelines mappables (backup_before_remap)
  ----------------------------------------------------------------------------
  INSERT INTO public.exhibitor_ai_remap_archive
    (original_ai_id, old_exhibitor_id, new_exhibitor_id, operation, reason, original_row)
  SELECT a.id, a.exhibitor_id, e.id_exposant,
         'backup_before_remap',
         'Snapshot avant remappage PK numérique → id_exposant',
         to_jsonb(a)
  FROM public.exhibitor_ai a
  JOIN public.exposants e ON a.exhibitor_id ~ '^[0-9]+$' AND e.id = a.exhibitor_id::int
  WHERE NOT EXISTS (SELECT 1 FROM public.exposants e2 WHERE e2.id_exposant = a.exhibitor_id);
  GET DIAGNOSTICS v_backup_count = ROW_COUNT;

  ----------------------------------------------------------------------------
  -- ÉTAPE 2 : archive des perdants des conflits
  ----------------------------------------------------------------------------
  INSERT INTO public.exhibitor_ai_remap_archive
    (original_ai_id, old_exhibitor_id, new_exhibitor_id, operation, reason, original_row)
  SELECT a.id, a.exhibitor_id, d.id_exposant,
         'remap_conflict_loser',
         'Conflit avec exposant déjà enrichi — décision: ' || d.decision_reason,
         to_jsonb(a)
  FROM _remap_decisions d
  JOIN public.exhibitor_ai a ON a.id = d.lose_id;
  GET DIAGNOSTICS v_conflict_count = ROW_COUNT;

  -- Suppression des perdants
  DELETE FROM public.exhibitor_ai a
  USING _remap_decisions d
  WHERE a.id = d.lose_id;

  ----------------------------------------------------------------------------
  -- ÉTAPE 3 : remappage massif (plus de conflit possible)
  ----------------------------------------------------------------------------
  UPDATE public.exhibitor_ai a
  SET exhibitor_id = e.id_exposant
  FROM public.exposants e
  WHERE a.exhibitor_id ~ '^[0-9]+$'
    AND e.id = a.exhibitor_id::int
    AND NOT EXISTS (SELECT 1 FROM public.exposants e2 WHERE e2.id_exposant = a.exhibitor_id);
  GET DIAGNOSTICS v_remapped = ROW_COUNT;

  ----------------------------------------------------------------------------
  -- ÉTAPE 4 : archiver les non remappables (sans suppression)
  ----------------------------------------------------------------------------
  INSERT INTO public.exhibitor_ai_remap_archive
    (original_ai_id, old_exhibitor_id, new_exhibitor_id, operation, reason, original_row)
  SELECT a.id, a.exhibitor_id, NULL, 'unmapped_orphan',
         'Aucun exposant ne correspond (ni id_exposant ni id PK)',
         to_jsonb(a)
  FROM public.exhibitor_ai a
  WHERE NOT EXISTS (SELECT 1 FROM public.exposants e WHERE e.id_exposant = a.exhibitor_id);
  GET DIAGNOSTICS v_unmapped_archived = ROW_COUNT;

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
