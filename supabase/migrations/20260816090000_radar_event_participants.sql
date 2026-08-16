-- =====================================================================
-- Lot 1 : participation d'equipe a un salon (Radar CRM)
-- Applique en prod le 16/08/2026 via Supabase MCP.
-- A committer dans supabase/migrations/ pour que Lovable reste aligne.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table de participation, source de verite dediee.
--    Independante de public.favorites, qui reste l'agenda visiteur public.
-- ---------------------------------------------------------------------
create table if not exists public.radar_event_participants (
  id uuid primary key default gen_random_uuid(),
  radar_account_id uuid not null references public.radar_accounts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (radar_account_id, event_id, user_id)
);

create index if not exists idx_radar_event_participants_account_event
  on public.radar_event_participants (radar_account_id, event_id);

create index if not exists idx_radar_event_participants_user
  on public.radar_event_participants (user_id);

alter table public.radar_event_participants enable row level security;

drop policy if exists radar_event_participants_member_select on public.radar_event_participants;
create policy radar_event_participants_member_select
  on public.radar_event_participants for select
  using (public.is_radar_member(radar_account_id, auth.uid()) or public.is_admin());

drop policy if exists radar_event_participants_self_insert on public.radar_event_participants;
create policy radar_event_participants_self_insert
  on public.radar_event_participants for insert
  with check (
    user_id = auth.uid()
    and public.is_radar_member(radar_account_id, auth.uid())
  );

drop policy if exists radar_event_participants_self_delete on public.radar_event_participants;
create policy radar_event_participants_self_delete
  on public.radar_event_participants for delete
  using (user_id = auth.uid() or public.is_admin());

-- Aucune policy UPDATE : une ligne de participation n'a rien de modifiable.

comment on table public.radar_event_participants is
  'Participation declarative d''un membre Radar a un salon. Un membre ne peut declarer que lui-meme (RLS). Distinct de public.favorites qui reste l''agenda visiteur du site public.';

-- ---------------------------------------------------------------------
-- 2. Avatar d'un membre, meme patron que radar_member_display_name.
-- ---------------------------------------------------------------------
create or replace function public.radar_member_avatar_url(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select nullif(btrim(coalesce(p.avatar_url, '')), '')
  from public.profiles p
  where p.user_id = p_user_id
  limit 1;
$function$;

-- ---------------------------------------------------------------------
-- 3. Declaration de participation. Toujours pour auth.uid(), jamais pour un tiers.
-- ---------------------------------------------------------------------
create or replace function public.set_radar_event_participation(
  p_event_id uuid,
  p_participating boolean
)
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
  if v_account_id is null or not public.has_radar_access(v_uid) then
    raise exception 'no_access';
  end if;

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  if p_participating then
    insert into public.radar_event_participants (radar_account_id, event_id, user_id)
    values (v_account_id, p_event_id, v_uid)
    on conflict (radar_account_id, event_id, user_id) do nothing;

    -- Consequence : le salon apparait dans l'agenda personnel du membre.
    -- Jamais l'inverse : un favori pose depuis le site public ne cree pas de participation.
    insert into public.favorites (user_id, event_id, event_uuid)
    values (v_uid, p_event_id, p_event_id)
    on conflict (user_id, event_id) do nothing;
  else
    delete from public.radar_event_participants
    where radar_account_id = v_account_id
      and event_id = p_event_id
      and user_id = v_uid;
    -- Le favori n'est volontairement PAS supprime : il peut avoir ete pose
    -- independamment depuis le site public.
  end if;

  return jsonb_build_object(
    'event_id', p_event_id,
    'participating', p_participating,
    'participant_count', (
      select count(*) from public.radar_event_participants
      where radar_account_id = v_account_id and event_id = p_event_id
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- 4. Liste des participants de l'espace pour un salon.
-- ---------------------------------------------------------------------
create or replace function public.get_radar_event_participants(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  v_account_id := public.radar_current_account_id(v_uid);
  if v_account_id is null or not public.has_radar_access(v_uid) then
    raise exception 'no_access';
  end if;

  return jsonb_build_object(
    'event_id', p_event_id,
    'account_id', v_account_id,
    'active_member_count', (
      select count(*) from public.radar_members
      where radar_account_id = v_account_id and status = 'active'
    ),
    'i_participate', exists (
      select 1 from public.radar_event_participants
      where radar_account_id = v_account_id and event_id = p_event_id and user_id = v_uid
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pa.user_id,
        'display_name', public.radar_member_display_name(pa.user_id),
        'avatar_url', public.radar_member_avatar_url(pa.user_id),
        'role', m.role,
        'is_me', (pa.user_id = v_uid),
        'created_at', pa.created_at
      ) order by (pa.user_id = v_uid) desc, pa.created_at)
      from public.radar_event_participants pa
      join public.radar_members m
        on m.radar_account_id = pa.radar_account_id
       and m.user_id = pa.user_id
       and m.status = 'active'
      where pa.radar_account_id = v_account_id
        and pa.event_id = p_event_id
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.set_radar_event_participation(uuid, boolean) to authenticated;
grant execute on function public.get_radar_event_participants(uuid) to authenticated;
grant execute on function public.radar_member_avatar_url(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. get_my_radar_team : ajout de avatar_url.
--    Le type de retour reste jsonb, aucun DROP FUNCTION requis.
-- ---------------------------------------------------------------------
create or replace function public.get_my_radar_team()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_my_role text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_account_id := public.radar_current_account_id(v_uid);
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  select role into v_my_role from public.radar_members
  where radar_account_id = v_account_id and user_id = v_uid and status = 'active';

  return jsonb_build_object(
    'account_id', v_account_id,
    'org_name', (select org_name from public.radar_accounts where id = v_account_id),
    'my_role', v_my_role,
    'active_member_count', (select count(*) from public.radar_members
                            where radar_account_id = v_account_id and status = 'active'),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'display_name', public.radar_member_display_name(m.user_id),
        'avatar_url', public.radar_member_avatar_url(m.user_id),
        'email', (select u.email from auth.users u where u.id = m.user_id),
        'role', m.role,
        'is_me', (m.user_id = v_uid),
        'last_seen_at', m.last_seen_at
      ) order by (m.role = 'owner') desc, public.radar_member_display_name(m.user_id))
      from public.radar_members m
      where m.radar_account_id = v_account_id and m.status = 'active'
    ), '[]'::jsonb)
  );
end;
$function$;
