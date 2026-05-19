
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS enrichissement_ignored boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_enrichissement_ignored
  ON public.events(enrichissement_ignored) WHERE enrichissement_ignored = true;

CREATE OR REPLACE FUNCTION public.seo_eligible_events(p_only_post_import boolean DEFAULT false)
RETURNS TABLE (
  id uuid, nom_event text, slug text, date_debut date,
  enrichissement_score int, enrichissement_statut text,
  description_enrichie_present boolean, enrichissement_ignored boolean,
  current_hash text, generated_from_hash text, status text, reason text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_last_run_at timestamptz; v_is_service boolean;
BEGIN
  BEGIN
    v_is_service := (auth.role() = 'service_role');
  EXCEPTION WHEN OTHERS THEN
    v_is_service := false;
  END;
  IF NOT (
    v_is_service
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_only_post_import THEN
    SELECT max(started_at) INTO v_last_run_at FROM public.seo_enrichment_runs
     WHERE status IN ('success','partial');
    IF v_last_run_at IS NULL THEN v_last_run_at := now() - interval '35 days'; END IF;
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT e.id, e.nom_event, e.slug, e.date_debut,
           e.enrichissement_score, e.enrichissement_statut,
           e.description_enrichie, e.enrichissement_ignored,
           e.seo_generated_from_hash,
           public.compute_seo_source_hash(e.id) AS current_hash,
           e.updated_at, e.created_at
    FROM public.events e
    WHERE e.visible=true
      AND coalesce(e.is_test,false)=false
      AND coalesce(e.enrichissement_ignored,false)=false
      AND e.slug IS NOT NULL AND e.slug<>''
      AND e.date_debut >= CURRENT_DATE
      AND coalesce(e.enrichissement_score,0) >= 55
      AND (NOT p_only_post_import OR e.updated_at >= v_last_run_at OR e.created_at >= v_last_run_at)
  )
  SELECT b.id, b.nom_event, b.slug, b.date_debut,
    b.enrichissement_score, b.enrichissement_statut,
    (b.description_enrichie IS NOT NULL AND length(btrim(b.description_enrichie))>0),
    coalesce(b.enrichissement_ignored,false),
    b.current_hash, b.seo_generated_from_hash,
    CASE WHEN b.description_enrichie IS NOT NULL
              AND length(btrim(b.description_enrichie))>0
              AND b.enrichissement_statut='valide'
              AND b.seo_generated_from_hash=b.current_hash
         THEN 'up_to_date' ELSE 'needs_claude' END,
    CASE
      WHEN b.description_enrichie IS NULL OR length(btrim(b.description_enrichie))=0
        THEN 'description_enrichie absente'
      WHEN coalesce(b.enrichissement_statut,'')<>'valide'
        THEN 'enrichissement_statut <> valide ('||coalesce(b.enrichissement_statut,'null')||')'
      WHEN b.seo_generated_from_hash IS NULL THEN 'hash jamais enregistré'
      WHEN b.seo_generated_from_hash<>b.current_hash THEN 'source modifiée depuis dernière génération'
      ELSE NULL END
  FROM base b;
END;
$$;
REVOKE ALL ON FUNCTION public.seo_eligible_events(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seo_eligible_events(boolean) TO authenticated, service_role;
