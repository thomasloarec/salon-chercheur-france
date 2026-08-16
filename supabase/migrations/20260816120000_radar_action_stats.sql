-- =====================================================================
-- Compteurs d'action de la Vue d'ensemble Radar CRM + objectif de salons.
-- Applique en prod le 16/08/2026 via Supabase MCP, verifie empiriquement
-- sur donnees reelles (chosen 2/26, prepared 5/31, met 1/23, followups 3 dont 1 retard).
-- A committer dans supabase/migrations/.
-- =====================================================================

-- 1. Objectif de salons par trimestre. NULL = denominateur calcule automatiquement.
alter table public.radar_accounts
  add column if not exists goal_events_per_quarter integer default null
  check (goal_events_per_quarter is null or goal_events_per_quarter between 0 and 100);

comment on column public.radar_accounts.goal_events_per_quarter is
  'Objectif de salons a visiter par trimestre, fixe par l''owner. NULL = pas d''objectif, le denominateur du compteur "salons choisis" reste calcule automatiquement.';

-- 2. Reglage de l'objectif, reserve a l'owner (verifie en base via is_radar_owner).
create or replace function public.set_radar_events_goal(p_goal integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_account_id := public.radar_current_account_id(v_uid);
  if v_account_id is null then raise exception 'no_access'; end if;
  if not public.is_radar_owner(v_account_id, v_uid) then raise exception 'not_owner'; end if;
  if p_goal is not null and (p_goal < 0 or p_goal > 100) then raise exception 'goal_out_of_range'; end if;

  update public.radar_accounts set goal_events_per_quarter = p_goal, updated_at = now()
  where id = v_account_id;

  return jsonb_build_object('goal', p_goal);
end;
$function$;

grant execute on function public.set_radar_events_goal(integer) to authenticated;

-- 3. Compteurs d'action. Fenetre 90 jours glissants. Un seul appel, calcul cote base.
create or replace function public.get_radar_action_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_goal integer;
  v_active_members integer;
  v_is_owner boolean;
  v_chosen_events integer;
  v_available_future_events integer;
  v_prepared integer;
  v_preparable integer;
  v_met integer;
  v_meetable integer;
  v_tasks_open integer;
  v_tasks_overdue integer;
  v_members_engaged integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_account_id := public.radar_current_account_id(v_uid);
  if v_account_id is null then raise exception 'no_access'; end if;

  select goal_events_per_quarter into v_goal from public.radar_accounts where id = v_account_id;
  v_active_members := (select count(*) from public.radar_members where radar_account_id = v_account_id and status='active');
  v_is_owner := public.is_radar_owner(v_account_id, v_uid);

  with future_events as (
    select distinct m.event_id
    from public.crm_company_event_matches m
    join public.events e on e.id = m.event_id
    where m.radar_account_id = v_account_id
      and e.date_debut is not null
      and e.date_debut::date >= current_date
      and e.date_debut::date <= current_date + 90
  ),
  chosen as (
    select distinct pa.event_id
    from public.radar_event_participants pa
    join future_events fe on fe.event_id = pa.event_id
    where pa.radar_account_id = v_account_id
  )
  select (select count(*) from future_events), (select count(*) from chosen)
  into v_available_future_events, v_chosen_events;

  with chosen_events as (
    select distinct pa.event_id
    from public.radar_event_participants pa
    join public.events e on e.id = pa.event_id
    where pa.radar_account_id = v_account_id
      and e.date_debut::date >= current_date
      and e.date_debut::date <= current_date + 90
  ),
  preparable as (
    select distinct m.crm_company_id, m.event_id
    from public.crm_company_event_matches m
    join chosen_events ce on ce.event_id = m.event_id
    where m.radar_account_id = v_account_id and m.crm_company_id is not null
  ),
  prepared as (
    select distinct mi.crm_company_id, mi.event_id
    from public.radar_missions mi
    join chosen_events ce on ce.event_id = mi.event_id
    where mi.radar_account_id = v_account_id
      and mi.crm_company_id is not null
      and coalesce(btrim(mi.objective), '') <> ''
  )
  select (select count(*) from preparable), (select count(*) from prepared)
  into v_preparable, v_prepared;

  with met as (
    select distinct mi.crm_company_id, mi.event_id
    from public.radar_missions mi
    where mi.radar_account_id = v_account_id
      and mi.visited = true and mi.visited_at is not null
      and mi.visited_at::date >= current_date - 90
      and mi.crm_company_id is not null
  ),
  meetable as (
    select distinct m.crm_company_id, m.event_id
    from public.crm_company_event_matches m
    join public.events e on e.id = m.event_id
    where m.radar_account_id = v_account_id
      and e.date_debut is not null
      and e.date_debut::date >= current_date - 90
      and e.date_debut::date < current_date
      and m.crm_company_id is not null
  )
  select (select count(*) from met), (select count(*) from meetable)
  into v_met, v_meetable;

  select
    count(*) filter (where t.done = false),
    count(*) filter (where t.done = false and t.due_at is not null and t.due_at < now())
  into v_tasks_open, v_tasks_overdue
  from public.radar_mission_tasks t
  where t.radar_account_id = v_account_id;

  select count(distinct pa.user_id) into v_members_engaged
  from public.radar_event_participants pa
  join public.radar_members rm
    on rm.radar_account_id = pa.radar_account_id and rm.user_id = pa.user_id and rm.status='active'
  where pa.radar_account_id = v_account_id;

  return jsonb_build_object(
    'goal', v_goal,
    'active_member_count', v_active_members,
    'is_owner', v_is_owner,
    'chosen_events', jsonb_build_object(
      'value', v_chosen_events,
      'target', coalesce(v_goal, v_available_future_events),
      'available', v_available_future_events,
      'goal_is_set', (v_goal is not null)
    ),
    'prepared_accounts', jsonb_build_object('value', v_prepared, 'target', v_preparable),
    'met_accounts', jsonb_build_object('value', v_met, 'target', v_meetable),
    'pending_followups', jsonb_build_object('open', v_tasks_open, 'overdue', v_tasks_overdue),
    'members_engaged', jsonb_build_object('value', v_members_engaged, 'target', v_active_members)
  );
end;
$function$;

grant execute on function public.get_radar_action_stats() to authenticated;
