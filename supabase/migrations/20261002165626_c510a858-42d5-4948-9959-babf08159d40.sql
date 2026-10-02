-- 20261002170500_assistant_lot1_crons.sql
-- Assistant « Pépites », lot 1 : planification nocturne.
-- À appliquer UNIQUEMENT après :
--   1) la migration 20261002170000_assistant_lot1_lecture_programmes.sql,
--   2) le déploiement de l'Edge Function enrich-program-sessions (version vérifiée via get_edge_function),
--   3) un premier passage réel de 80 sessions relu par Thomas (02/10/2026).

-- Enrichissement IA : toutes les 15 minutes entre 1 h et 4 h 59 (UTC), 80 sessions par passage (16 passages, jusqu'à 1 280 sessions par nuit).
-- Une nuit sans nouveauté ne coûte rien : la RPC ne renvoie aucune session.
select cron.unschedule('enrich-program-sessions-nightly')
where exists (select 1 from cron.job where jobname = 'enrich-program-sessions-nightly');

select cron.schedule(
  'enrich-program-sessions-nightly',
  '*/15 1-4 * * *',
  $cron$
  select net.http_post(
    url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/enrich-program-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1
      )
    ),
    body := jsonb_build_object(),
    timeout_milliseconds := 300000
  );
  $cron$
);

-- Vecteurs : après l'enrichissement, à 5 h 40 (UTC).
select cron.unschedule('embed-pending-sessions')
where exists (select 1 from cron.job where jobname = 'embed-pending-sessions');

select cron.schedule(
  'embed-pending-sessions',
  '40 5 * * *',
  $cron$ SET statement_timeout = 0; SELECT public.embed_pending_sessions(6); $cron$
);