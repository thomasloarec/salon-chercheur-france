-- Migration 1 : fausses alertes santé du site (05/10/2026)
-- 1) Tâches planifiées : juger sur la dernière exécution TERMINÉE ; une exécution en cours
--    n'alerte que si elle est bloquée depuis plus de 15 min.
-- 2) Embeddings exposants : l'âge du dernier embedding ne compte que s'il reste un backlog.
-- Remplacement chirurgical : la migration s'arrête (STOP) si le code en place ne correspond pas.

CREATE OR REPLACE VIEW public.pipeline_health AS
WITH last_done AS (
  SELECT jr.jobid,
    (array_agg(jr.status ORDER BY jr.start_time DESC))[1] AS last_status,
    max(jr.start_time) AS last_run_at,
    max(jr.start_time) FILTER (WHERE jr.status = 'succeeded') AS last_success_at
  FROM cron.job_run_details jr
  WHERE jr.status IN ('succeeded', 'failed')
  GROUP BY jr.jobid
),
latest AS (
  SELECT DISTINCT ON (jr.jobid) jr.jobid, jr.status, jr.start_time
  FROM cron.job_run_details jr
  ORDER BY jr.jobid, jr.start_time DESC
),
stuck AS (
  SELECT l.jobid, 'bloquee depuis ' || round(extract(epoch FROM now() - l.start_time) / 60) || ' min' AS stuck_status
  FROM latest l
  WHERE l.status NOT IN ('succeeded', 'failed') AND l.start_time < now() - interval '15 minutes'
)
SELECT j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  coalesce(s.stuck_status, ld.last_status) AS last_status,
  ld.last_run_at,
  ld.last_success_at,
  round(EXTRACT(epoch FROM now() - ld.last_success_at) / 3600::numeric, 1) AS hours_since_success,
  j.active AND (s.jobid IS NOT NULL OR COALESCE(ld.last_status, 'never') <> 'succeeded') AS needs_attention
FROM cron.job j
LEFT JOIN last_done ld ON ld.jobid = j.jobid
LEFT JOIN stuck s ON s.jobid = j.jobid
ORDER BY (j.active AND (s.jobid IS NOT NULL OR COALESCE(ld.last_status, 'never') <> 'succeeded')) DESC, j.jobname;

DO $$
DECLARE
  d text := pg_get_functiondef('public.compute_site_health()'::regprocedure);
  d0 text := d;
  old_cron text := $o$  WITH lastrun AS (
    SELECT jr.jobid, (array_agg(jr.status ORDER BY jr.start_time DESC))[1] AS last_status
    FROM cron.job_run_details jr GROUP BY jr.jobid
  ),
  fail AS (
    SELECT j.jobname, lr.last_status FROM cron.job j JOIN lastrun lr ON lr.jobid=j.jobid
    WHERE j.active AND coalesce(lr.last_status,'running') NOT IN ('succeeded','running')
  )$o$;
  new_cron text := $n$  WITH lastrun AS (
    -- Dernière exécution TERMINÉE (une exécution en cours n'est pas un échec)
    SELECT jr.jobid, (array_agg(jr.status ORDER BY jr.start_time DESC))[1] AS last_status
    FROM cron.job_run_details jr WHERE jr.status IN ('succeeded','failed') GROUP BY jr.jobid
  ),
  latest AS (
    SELECT DISTINCT ON (jr.jobid) jr.jobid, jr.status, jr.start_time
    FROM cron.job_run_details jr ORDER BY jr.jobid, jr.start_time DESC
  ),
  fail AS (
    SELECT j.jobname, lr.last_status FROM cron.job j JOIN lastrun lr ON lr.jobid=j.jobid
    WHERE j.active AND lr.last_status = 'failed'
    UNION ALL
    SELECT j.jobname, 'bloquée depuis '||round(extract(epoch FROM now()-l.start_time)/60)||' min'
    FROM cron.job j JOIN latest l ON l.jobid=j.jobid
    WHERE j.active AND l.status NOT IN ('succeeded','failed') AND l.start_time < now()-interval '15 minutes'
  )$n$;
  old_emb text := $o$    CASE WHEN e.backlog>5000 OR extract(epoch FROM now()-e.last_emb)/3600>26 THEN 'critical'
         WHEN e.backlog>1500 OR extract(epoch FROM now()-e.last_emb)/3600>8 THEN 'warn' ELSE 'ok' END,$o$;
  new_emb text := $n$    -- L'âge du dernier embedding ne compte que s'il reste des fiches en attente
    CASE WHEN e.backlog>5000 OR (e.backlog>0 AND extract(epoch FROM now()-e.last_emb)/3600>26) THEN 'critical'
         WHEN e.backlog>1500 OR (e.backlog>0 AND extract(epoch FROM now()-e.last_emb)/3600>8) THEN 'warn' ELSE 'ok' END,$n$;
BEGIN
  -- Neutralise les retours à la ligne Windows (copier-coller) : la base n'en contient pas ici
  old_cron := replace(old_cron, E'\r', ''); new_cron := replace(new_cron, E'\r', '');
  old_emb  := replace(old_emb,  E'\r', ''); new_emb  := replace(new_emb,  E'\r', '');
  IF position(old_cron in d) = 0 THEN RAISE EXCEPTION 'STOP: bloc cron introuvable dans compute_site_health'; END IF;
  IF position(old_emb in d) = 0 THEN RAISE EXCEPTION 'STOP: bloc embeddings introuvable dans compute_site_health'; END IF;
  d := replace(d, old_cron, new_cron);
  d := replace(d, old_emb, new_emb);
  IF d = d0 THEN RAISE EXCEPTION 'STOP: aucune modification'; END IF;
  EXECUTE d;
END $$;
