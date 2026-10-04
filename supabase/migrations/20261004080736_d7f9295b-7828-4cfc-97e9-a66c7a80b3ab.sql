-- Vue d'ensemble admin : section « Visiteurs – 7 jours » (demande de Thomas du 04/10/2026).
-- Une seule lecture, réservée aux admins, qui renvoie des nombres (aucune donnée personnelle).
-- Comptes visiteurs = comptes réels (non anonymes), hors comptes admin.
-- Chaque indicateur est donné pour les 7 derniers jours et pour les 7 jours d'avant (évolution).
create or replace function public.admin_visitor_activity_stats()
returns jsonb
language plpgsql stable security definer
set search_path = public, auth
as $$
declare
  v_now  timestamptz := now();
  v_d7   timestamptz := now() - interval '7 days';
  v_d14  timestamptz := now() - interval '14 days';
  v_out  jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  with real_users as (
    select u.id, u.created_at, u.last_sign_in_at
    from auth.users u
    where coalesce(u.is_anonymous, false) = false
      and not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
  ),
  -- Toute action d'un visiteur sur le site, datée
  actions as (
    select f.user_id, f.created_at from public.favorites f
    union all select l.user_id, l.created_at from public.novelty_likes l
    union all select v.user_id, v.created_at from public.visit_plans v
    union all select ap.user_id, fb.created_at
      from public.assistant_feedback fb join public.assistant_profiles ap on ap.id = fb.profile_id
    union all select ld.user_id, ld.created_at from public.leads ld where ld.user_id is not null
  ),
  active as (
    select r.id,
           (r.last_sign_in_at >= v_d7 or exists (select 1 from actions a where a.user_id = r.id and a.created_at >= v_d7)) as cur,
           ((r.last_sign_in_at >= v_d14 and r.last_sign_in_at < v_d7)
             or exists (select 1 from actions a where a.user_id = r.id and a.created_at >= v_d14 and a.created_at < v_d7)) as prev
    from real_users r
  ),
  -- Intentions de visite : salons ajoutés, conférences et Nouveautés gardées, demandes de contact ou de rendez-vous
  intents as (
    select 'salons' as kind, f.created_at from public.favorites f join real_users r on r.id = f.user_id
    union all
    select 'selections', l.created_at from public.novelty_likes l join real_users r on r.id = l.user_id
    union all
    select 'selections', fb.created_at
      from public.assistant_feedback fb
      join public.assistant_profiles ap on ap.id = fb.profile_id and not ap.is_test
      join real_users r on r.id = ap.user_id
     where fb.item_type = 'session' and fb.signal in ('agenda', 'inscription') and fb.undone_at is null
    union all
    select 'contacts', ld.created_at from public.leads ld
  )
  select jsonb_build_object(
    'generated_at', v_now,
    'accounts', jsonb_build_object(
      'total', (select count(*) from real_users),
      'new_7d', (select count(*) from real_users where created_at >= v_d7),
      'new_prev_7d', (select count(*) from real_users where created_at >= v_d14 and created_at < v_d7)),
    'active', jsonb_build_object(
      'current', (select count(*) from active where cur),
      'previous', (select count(*) from active where prev)),
    'assistant', jsonb_build_object(
      -- assistants rattachés à un compte visiteur, tous temps confondus
      'total', (select count(*) from public.assistant_profiles ap join real_users r on r.id = ap.user_id
                where ap.onboarded_at is not null and not ap.is_test),
      -- parcours /agenda/creer commencés (assistant créé, avec ou sans compte)
      'started_7d', (select count(*) from public.assistant_profiles ap
                     where not ap.is_test and ap.created_at >= v_d7),
      'started_prev_7d', (select count(*) from public.assistant_profiles ap
                          where not ap.is_test and ap.created_at >= v_d14 and ap.created_at < v_d7),
      -- parcours terminés : assistant rattaché à un compte visiteur
      'completed_7d', (select count(*) from public.assistant_profiles ap join real_users r on r.id = ap.user_id
                       where not ap.is_test and ap.onboarded_at >= v_d7),
      'completed_prev_7d', (select count(*) from public.assistant_profiles ap join real_users r on r.id = ap.user_id
                            where not ap.is_test and ap.onboarded_at >= v_d14 and ap.onboarded_at < v_d7)),
    'intents', jsonb_build_object(
      'salons_7d', (select count(*) from intents where kind = 'salons' and created_at >= v_d7),
      'selections_7d', (select count(*) from intents where kind = 'selections' and created_at >= v_d7),
      'contacts_7d', (select count(*) from intents where kind = 'contacts' and created_at >= v_d7),
      'total_7d', (select count(*) from intents where created_at >= v_d7),
      'total_prev_7d', (select count(*) from intents where created_at >= v_d14 and created_at < v_d7))
  ) into v_out;

  return v_out;
end
$$;

revoke all on function public.admin_visitor_activity_stats() from public, anon;
grant execute on function public.admin_visitor_activity_stats() to authenticated, service_role;