-- Correctif intentions périmées, lot 3 : le dispatcher reconstruit les intentions quand elles sont périmées.
-- Cadrage : claude/Correctif_Pistes_Perimees_Cadrage_04102026.md
-- Prérequis : lot 1 (colonnes pistes_built_at / content_changed_at) et lot 2 (le moteur renseigne pistes_built_at).
--
-- Intentions périmées (« stale ») : assistant rattaché à un compte, onboardé, et
--   pistes_built_at absente ou antérieure à content_changed_at.
-- Règles :
--   A. Rafraîchissement demandé (comportement existant, inchangé).
--   B. Filet de sécurité : un assistant aux intentions périmées est pris en charge même sans demande en attente.
--   Étape envoyée : 'all' si périmées (reconstruction + recherche complète), 'adapt' sinon (inchangé).
--   Délai de 2 minutes après un changement : le navigateur reconstruit d'abord, le dispatcher ne prend
--   le relais qu'en cas d'échec (évite deux reconstructions simultanées).
--   Au plus 3 tentatives (refresh_attempts), remis à zéro par le moteur en cas de succès
--   et par le déclencheur du lot 1 à chaque changement de profil.

create or replace function public.assistant_dispatch_refresh(p_limit integer default 5)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    select s.id, s.stale
      from (
        select ap.id, ap.refresh_requested_at, ap.refresh_fast, ap.refreshed_at, ap.refresh_attempts,
               ap.refresh_dispatched_at, ap.content_changed_at,
               (ap.user_id is not null
                and ap.onboarded_at is not null
                and (ap.pistes_built_at is null
                     or ap.pistes_built_at < coalesce(ap.content_changed_at, '-infinity'::timestamptz))) as stale
          from public.assistant_profiles ap
      ) s
     where s.refresh_attempts < 3
       and (
         -- A. rafraîchissement demandé
         (s.refresh_requested_at is not null
          and (s.refresh_fast or s.refresh_requested_at < now() - interval '5 minutes')
          and (s.refreshed_at is null or s.refreshed_at < s.refresh_requested_at)
          and (s.refresh_dispatched_at is null
               or s.refresh_dispatched_at < s.refresh_requested_at
               or s.refresh_dispatched_at < now() - interval '30 minutes'))
         or
         -- B. filet de sécurité : intentions périmées
         (s.stale
          and (s.refresh_dispatched_at is null
               or s.refresh_dispatched_at < coalesce(s.content_changed_at, '-infinity'::timestamptz)
               or s.refresh_dispatched_at < now() - interval '30 minutes'))
       )
       -- intentions périmées depuis moins de 2 minutes : le navigateur est en train de les reconstruire
       and not (s.stale and coalesce(s.content_changed_at, '-infinity'::timestamptz) > now() - interval '2 minutes')
     order by coalesce(s.refresh_requested_at, s.content_changed_at)
     limit p_limit
  loop
    perform net.http_post(
      url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/assistant-pepites',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1)
      ),
      body := jsonb_build_object('profile_id', r.id, 'step', case when r.stale then 'all' else 'adapt' end),
      timeout_milliseconds := 300000
    );
    update public.assistant_profiles
       set refresh_dispatched_at = now(), refresh_attempts = refresh_attempts + 1, refresh_fast = false
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end
$function$;

revoke all on function public.assistant_dispatch_refresh(integer) from public, anon, authenticated;
