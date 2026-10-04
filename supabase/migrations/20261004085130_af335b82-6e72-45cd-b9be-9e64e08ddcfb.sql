-- Assistant salons, lot 5 : la veille automatique et les alertes (décisions de Thomas du 04/10/2026).
-- 1. Historique : la date à laquelle chaque conférence, stand ou salon est apparu pour la première fois
--    dans l'agenda d'un visiteur (le moteur réécrit ses résultats à chaque passage, il faut donc garder
--    cette date à part). Rempli par deux déclencheurs, sans toucher au moteur.
-- 2. Veille : chaque nuit, l'assistant de chaque visiteur relance sa recherche (tâche assistant-veille-nightly).
-- 3. Alertes : chaque matin, la fonction assistant-alerts collecte ce qui est nouveau
--    (assistant_alerts_collect), écrit l'email et la notification de la cloche, puis marque ce qui a été
--    signalé (assistant_alerts_mark).
--    Le mardi : récapitulatif de la semaine. Les autres jours : seulement l'urgent (suggestion très forte
--    sur un salon à moins de 3 semaines). Au plus 2 emails par 7 jours, jamais d'email vide.
--    La cloche reçoit la même chose, y compris pour ceux qui ont refusé les emails.
-- 4. Désinscription en un clic : jeton dans email_unsubscribe_tokens (nouvelle portée assistant_alerts).

-- ---------------------------------------------------------------------------------------------
-- 1. Historique d'apparition
-- ---------------------------------------------------------------------------------------------
create table if not exists public.assistant_item_history (
  profile_id        uuid not null references public.assistant_profiles(id) on delete cascade,
  item_type         text not null check (item_type in ('session', 'novelty', 'event')),
  item_id           uuid not null,
  event_id          uuid not null,
  first_retained_at timestamptz not null default now(),
  notified_at       timestamptz,
  notified_mode     text check (notified_mode in ('weekly', 'urgent', 'baseline')),
  primary key (profile_id, item_type, item_id)
);
create index if not exists assistant_item_history_pending_idx
  on public.assistant_item_history (profile_id) where notified_at is null;
alter table public.assistant_item_history enable row level security;
revoke all on table public.assistant_item_history from anon, authenticated;
grant all on table public.assistant_item_history to service_role;

create or replace function public.assistant_history_on_match()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'retained' then
    insert into public.assistant_item_history (profile_id, item_type, item_id, event_id)
    values (new.profile_id, new.item_type, new.item_id, new.event_id)
    on conflict do nothing;
  end if;
  return null;
end
$$;

create or replace function public.assistant_history_on_suggestion()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.assistant_item_history (profile_id, item_type, item_id, event_id)
  values (new.profile_id, 'event', new.event_id, new.event_id)
  on conflict do nothing;
  return null;
end
$$;

drop trigger if exists assistant_history_on_match on public.assistant_matches;
create trigger assistant_history_on_match
  after insert on public.assistant_matches
  for each row execute function public.assistant_history_on_match();

drop trigger if exists assistant_history_on_suggestion on public.assistant_suggestions;
create trigger assistant_history_on_suggestion
  after insert on public.assistant_suggestions
  for each row execute function public.assistant_history_on_suggestion();

-- Point de départ : tout ce qui est déjà dans les agendas est considéré comme déjà vu.
insert into public.assistant_item_history (profile_id, item_type, item_id, event_id, first_retained_at, notified_at, notified_mode)
select m.profile_id, m.item_type, m.item_id, m.event_id, m.created_at, now(), 'baseline'
from public.assistant_matches m
where m.status = 'retained'
on conflict do nothing;

insert into public.assistant_item_history (profile_id, item_type, item_id, event_id, first_retained_at, notified_at, notified_mode)
select s.profile_id, 'event', s.event_id, s.event_id, s.computed_at, now(), 'baseline'
from public.assistant_suggestions s
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2. Journal des envois (email et cloche)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.assistant_alert_sends (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.assistant_profiles(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  mode        text not null check (mode in ('weekly', 'urgent', 'test')),
  channel     text not null check (channel in ('email', 'bell')),
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  item_count  integer not null default 0,
  resend_id   text,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists assistant_alert_sends_profile_idx
  on public.assistant_alert_sends (profile_id, channel, created_at desc);
alter table public.assistant_alert_sends enable row level security;
revoke all on table public.assistant_alert_sends from anon, authenticated;
grant all on table public.assistant_alert_sends to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Désinscription : nouvelle portée de jeton
-- ---------------------------------------------------------------------------------------------
alter table public.email_unsubscribe_tokens drop constraint if exists email_unsubscribe_tokens_scope_check;
alter table public.email_unsubscribe_tokens
  add constraint email_unsubscribe_tokens_scope_check
  check (scope = any (array['radar_crm'::text, 'all'::text, 'assistant_alerts'::text]));

-- ---------------------------------------------------------------------------------------------
-- 4. Collecte de ce qui est nouveau (lecture, plus création des jetons de désinscription manquants)
--    p_mode       : 'weekly' (tout ce qui est nouveau) ou 'urgent' (score >= 90 et salon dans 21 jours)
--    p_profile_id : un seul assistant (test admin) ; dans ce cas les comptes de test sont acceptés
--    p_force      : test admin : ignore l'historique et prend les meilleures suggestions actuelles
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_alerts_collect(
  p_mode text default 'weekly', p_profile_id uuid default null, p_force boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_out   jsonb := '[]'::jsonb;
  r       record;
  v_items jsonb;
  v_new_events jsonb;
  v_token uuid;
  v_emails_7d int;
  v_last_email timestamptz;
  v_can_email boolean;
  v_why text;
begin
  if p_mode not in ('weekly', 'urgent') then
    raise exception 'Mode inconnu : %', p_mode;
  end if;

  for r in
    select ap.id, ap.user_id, ap.onboarded_at, ap.region_codes, ap.email_alerts_opt_in, ap.is_test,
           u.email, u.email_confirmed_at
    from public.assistant_profiles ap
    join auth.users u on u.id = ap.user_id
    where ap.user_id is not null
      and coalesce(u.is_anonymous, false) = false
      and ap.onboarded_at is not null
      and (p_profile_id is null and not ap.is_test or ap.id = p_profile_id)
  loop
    -- Conférences et stands nouveaux, toujours retenus, sur un salon toujours suggéré et à venir
    select coalesce(jsonb_agg(x.j order by x.score desc nulls last, x.date_debut), '[]'::jsonb)
      into v_items
    from (
      select public.assistant_pepite_json(r.id, m) || jsonb_build_object('first_retained_at', h.first_retained_at) as j,
             m.score, e.date_debut
      from public.assistant_matches m
      join public.assistant_item_history h
        on h.profile_id = m.profile_id and h.item_type = m.item_type and h.item_id = m.item_id
      join public.assistant_suggestions s
        on s.profile_id = m.profile_id and s.event_id = m.event_id and s.status in ('pending', 'notified', 'seen')
      join public.events e on e.id = m.event_id
      where m.profile_id = r.id
        and m.status = 'retained'
        and e.date_debut >= current_date + 2
        and (cardinality(coalesce(r.region_codes, '{}'::text[])) = 0
             or public.assistant_region_of(e.code_postal) is null
             or public.assistant_region_of(e.code_postal) = any(r.region_codes))
        and not exists (
          select 1 from public.assistant_feedback f
          where f.profile_id = r.id and f.item_type = m.item_type and f.item_id = m.item_id and f.undone_at is null)
        and (p_force or (h.notified_at is null and h.first_retained_at > r.onboarded_at + interval '1 day'))
        and (p_mode = 'weekly' or (coalesce(m.score, 0) >= 90 and e.date_debut <= current_date + 21))
      order by m.score desc nulls last
      limit case when p_force then 6 else 40 end
    ) x;

    -- Salons nouvellement suggérés
    select coalesce(jsonb_agg(jsonb_build_object('event_id', s.event_id, 'best_score', s.best_score,
             'pepite_count', s.pepite_count) order by e.date_debut), '[]'::jsonb)
      into v_new_events
    from public.assistant_suggestions s
    join public.assistant_item_history h
      on h.profile_id = s.profile_id and h.item_type = 'event' and h.item_id = s.event_id
    join public.events e on e.id = s.event_id
    where s.profile_id = r.id
      and s.status in ('pending', 'notified', 'seen')
      and e.date_debut >= current_date + 2
      and (cardinality(coalesce(r.region_codes, '{}'::text[])) = 0
           or public.assistant_region_of(e.code_postal) is null
           or public.assistant_region_of(e.code_postal) = any(r.region_codes))
      and (p_force or (h.notified_at is null and h.first_retained_at > r.onboarded_at + interval '1 day'))
      and (p_mode = 'weekly' or (coalesce(s.best_score, 0) >= 90 and e.date_debut <= current_date + 21));

    continue when jsonb_array_length(v_items) = 0 and jsonb_array_length(v_new_events) = 0;

    -- Email permis ?
    select count(*) filter (where created_at > now() - interval '7 days'), max(created_at)
      into v_emails_7d, v_last_email
    from public.assistant_alert_sends
    where profile_id = r.id and channel = 'email' and status = 'sent';

    v_why := case
      when not coalesce(r.email_alerts_opt_in, false) then 'pas_d_accord'
      when r.email is null or r.email_confirmed_at is null then 'email_non_confirme'
      when public.is_email_blacklisted(r.email) then 'liste_noire'
      when p_force then null
      when p_mode = 'weekly' and v_last_email > now() - interval '20 hours' then 'deja_ecrit'
      when p_mode = 'urgent' and (v_emails_7d >= 2 or v_last_email > now() - interval '3 days') then 'plafond'
      else null end;
    v_can_email := v_why is null;

    v_token := null;
    if v_can_email then
      select t.token into v_token
      from public.email_unsubscribe_tokens t
      where t.user_id = r.user_id and t.scope = 'assistant_alerts' and t.used_at is null
      order by t.created_at desc limit 1;
      if v_token is null then
        insert into public.email_unsubscribe_tokens (user_id, scope)
        values (r.user_id, 'assistant_alerts')
        returning token into v_token;
      end if;
    end if;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'profile_id', r.id,
      'user_id', r.user_id,
      'email', case when v_can_email then r.email end,
      'can_email', v_can_email,
      'email_skip_reason', v_why,
      'unsubscribe_token', v_token,
      'items', v_items,
      'new_events', v_new_events,
      'events', coalesce((
        select jsonb_agg(jsonb_build_object('id', e.id, 'slug', e.slug, 'nom_event', e.nom_event,
                 'date_debut', e.date_debut, 'date_fin', e.date_fin, 'ville', e.ville) order by e.date_debut)
        from public.events e
        where e.id in (
          select (i->>'event_id')::uuid from jsonb_array_elements(v_items) i
          union select (n->>'event_id')::uuid from jsonb_array_elements(v_new_events) n)), '[]'::jsonb)));
  end loop;

  return v_out;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Marquage après envoi : historique, journal, notification de la cloche
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_alerts_mark(
  p_profile_id uuid,
  p_mode text,
  p_keys jsonb,                 -- [{ "item_type": "session"|"novelty"|"event", "item_id": "..." }]
  p_email_status text,          -- 'sent' | 'failed' | 'skipped'
  p_resend_id text default null,
  p_error text default null,
  p_bell_title text default null,
  p_bell_message text default null,
  p_bell_event_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_n int := coalesce(jsonb_array_length(p_keys), 0);
  v_marked int := 0;
begin
  select user_id into v_user from public.assistant_profiles where id = p_profile_id;
  if v_user is null then
    raise exception 'Assistant introuvable';
  end if;

  if p_mode <> 'test' then
    update public.assistant_item_history h
       set notified_at = now(), notified_mode = p_mode
      from jsonb_array_elements(coalesce(p_keys, '[]'::jsonb)) k
     where h.profile_id = p_profile_id
       and h.item_type = k->>'item_type'
       and h.item_id = (k->>'item_id')::uuid
       and h.notified_at is null;
    get diagnostics v_marked = row_count;
  end if;

  insert into public.assistant_alert_sends (profile_id, user_id, mode, channel, status, item_count, resend_id, error)
  values (p_profile_id, v_user, p_mode, 'email', coalesce(p_email_status, 'skipped'), v_n, p_resend_id, left(p_error, 500));

  if p_bell_title is not null then
    insert into public.notifications (user_id, type, category, title, message, icon, event_id, link_url, group_key, metadata)
    values (v_user, 'recommended_event', 'recommendation', left(p_bell_title, 200), left(p_bell_message, 500),
            'sparkles', p_bell_event_id, '/agenda', 'assistant_' || p_mode || '_' || to_char(now(), 'YYYYMMDD'),
            jsonb_build_object('source', 'assistant', 'mode', p_mode, 'count', v_n));
    insert into public.assistant_alert_sends (profile_id, user_id, mode, channel, status, item_count)
    values (p_profile_id, v_user, p_mode, 'bell', 'sent', v_n);
  end if;

  return jsonb_build_object('ok', true, 'marques', v_marked);
end
$$;

revoke all on function public.assistant_alerts_collect(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.assistant_alerts_collect(text, uuid, boolean) to service_role;
revoke all on function public.assistant_alerts_mark(uuid, text, jsonb, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.assistant_alerts_mark(uuid, text, jsonb, text, text, text, text, text, uuid) to service_role;
revoke all on function public.assistant_history_on_match() from public, anon, authenticated;
revoke all on function public.assistant_history_on_suggestion() from public, anon, authenticated;

-- Désinscription par jeton (appelée par la fonction assistant-alerts-unsubscribe, clé de service)
create or replace function public.assistant_alerts_unsubscribe(p_token uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  t record;
begin
  select id, user_id, scope, used_at into t
  from public.email_unsubscribe_tokens where token = p_token;
  if not found or t.scope <> 'assistant_alerts' then
    return jsonb_build_object('ok', false, 'reason', 'invalide');
  end if;
  update public.assistant_profiles
     set email_alerts_opt_in = false, email_alerts_opt_in_at = null, updated_at = now()
   where user_id = t.user_id and email_alerts_opt_in;
  update public.email_unsubscribe_tokens set used_at = coalesce(used_at, now()) where id = t.id;
  return jsonb_build_object('ok', true, 'deja', t.used_at is not null);
end
$$;
revoke all on function public.assistant_alerts_unsubscribe(uuid) from public, anon, authenticated;
grant execute on function public.assistant_alerts_unsubscribe(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. Veille de nuit : chaque assistant relance sa recherche (le dispatch existant, 5 toutes les 5 min)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_request_veille()
returns integer
language plpgsql security definer
set search_path = public, auth
as $$
declare
  n integer;
begin
  update public.assistant_profiles ap
     set refresh_requested_at = now(), refresh_attempts = 0
    from auth.users u
   where u.id = ap.user_id
     and coalesce(u.is_anonymous, false) = false
     and ap.onboarded_at is not null
     and not ap.is_test
     and (ap.refreshed_at is null or ap.refreshed_at < now() - interval '20 hours')
     and not (ap.refresh_requested_at is not null
              and (ap.refreshed_at is null or ap.refreshed_at < ap.refresh_requested_at)
              and ap.refresh_attempts < 3);
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.assistant_request_veille() from public, anon, authenticated;
grant execute on function public.assistant_request_veille() to service_role;

-- ---------------------------------------------------------------------------------------------
-- 7. Tâches planifiées (heures UTC)
--    02:30 : veille (4 h 30 à Paris en été). Les assistants passent ensuite, 5 toutes les 5 minutes.
--    06:05 : alertes (8 h 05 à Paris en été, 7 h 05 en hiver) ; le mardi = récapitulatif de la semaine.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'assistant-veille-nightly') then
    perform cron.unschedule('assistant-veille-nightly');
  end if;
  perform cron.schedule('assistant-veille-nightly', '30 2 * * *', 'select public.assistant_request_veille();');

  if exists (select 1 from cron.job where jobname = 'assistant-alerts-daily') then
    perform cron.unschedule('assistant-alerts-daily');
  end if;
  perform cron.schedule('assistant-alerts-daily', '5 6 * * *', $job$
    select net.http_post(
      url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/assistant-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1)),
      body := jsonb_build_object(),
      timeout_milliseconds := 120000);
  $job$);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Contrôles
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'assistant_history_on_match')
     or not exists (select 1 from pg_trigger where tgname = 'assistant_history_on_suggestion') then
    raise exception 'Contrôle : déclencheurs absents';
  end if;
  if exists (select 1 from public.assistant_matches m where m.status = 'retained'
             and not exists (select 1 from public.assistant_item_history h
                             where h.profile_id = m.profile_id and h.item_type = m.item_type and h.item_id = m.item_id)) then
    raise exception 'Contrôle : historique incomplet';
  end if;
  if (select count(*) from cron.job where jobname in ('assistant-veille-nightly', 'assistant-alerts-daily')) <> 2 then
    raise exception 'Contrôle : tâches planifiées absentes';
  end if;
end
$$;

notify pgrst, 'reload schema';