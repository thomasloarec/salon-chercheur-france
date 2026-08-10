-- Recherche IA : recharge glissante des credits pour les comptes inscrits.
-- Anonyme : 5 requetes a vie (le mur d'inscription reste un mur).
-- Inscrit  : 10 requetes par fenetre glissante de 24h.
-- Admin    : illimite (999999).

DROP FUNCTION IF EXISTS public.check_ai_credits(uuid, boolean);

CREATE FUNCTION public.check_ai_credits(p_user_id uuid, p_is_anonymous boolean)
RETURNS TABLE(used integer, allowed integer, remaining integer, wall_type text, reset_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT CASE
             WHEN has_role(p_user_id, 'admin'::app_role) THEN 999999
             WHEN p_is_anonymous THEN 5
             ELSE 10
           END AS allw
  ),
  u AS (
    SELECT
      count(*) FILTER (
        WHERE p_is_anonymous OR s.created_at >= now() - interval '24 hours'
      )::integer AS used,
      min(s.created_at) FILTER (
        WHERE s.created_at >= now() - interval '24 hours'
      ) AS oldest_in_window
    FROM public.ai_search_usage s
    WHERE s.user_id = p_user_id
  )
  SELECT
    u.used,
    cfg.allw,
    GREATEST(cfg.allw - u.used, 0),
    CASE WHEN u.used < cfg.allw THEN NULL
         WHEN p_is_anonymous THEN 'signup'
         ELSE 'daily_limit' END,
    CASE WHEN u.used >= cfg.allw AND NOT p_is_anonymous
         THEN u.oldest_in_window + interval '24 hours'
         ELSE NULL END
  FROM u, cfg;
$function$;

CREATE INDEX IF NOT EXISTS idx_ai_search_usage_user_created
  ON public.ai_search_usage (user_id, created_at);

ALTER TABLE public.ai_funnel_events
  DROP CONSTRAINT IF EXISTS ai_funnel_events_event_type_check;

ALTER TABLE public.ai_funnel_events
  ADD CONSTRAINT ai_funnel_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'anon_wall_shown'::text,
    'account_created'::text,
    'paid_wall_shown'::text,
    'paid_intent_clicked'::text,
    'daily_wall_shown'::text
  ]));

