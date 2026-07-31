-- Journal réversible
create table if not exists public.participation_dedup_log (
  id uuid primary key default gen_random_uuid(),
  id_exposant text not null,
  id_event_text text,
  kept_participation_id uuid not null,
  deleted_row jsonb not null,
  reverted boolean not null default false,
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.participation_dedup_log to authenticated;
grant all on public.participation_dedup_log to service_role;

alter table public.participation_dedup_log enable row level security;
drop policy if exists "admin manage participation_dedup_log" on public.participation_dedup_log;
create policy "admin manage participation_dedup_log" on public.participation_dedup_log
  for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "service_role participation_dedup_log" on public.participation_dedup_log;
create policy "service_role participation_dedup_log" on public.participation_dedup_log
  for all to service_role using (true) with check (true);

-- Déduplication
create or replace function public.dedup_participations_same_event()
returns table(groupes int, lignes_supprimees int)
language plpgsql security definer set search_path = public as $$
declare rec record; v_keep uuid; g int := 0; total_del int := 0; this_del int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'dedup_participations_same_event: admin uniquement';
  end if;

  for rec in
    select p.id_exposant, p.id_event_text
    from public.participation p
    where p.id_event_text is not null
    group by p.id_exposant, p.id_event_text having count(*) > 1
  loop
    select p.id_participation into v_keep
    from public.participation p
    where p.id_exposant = rec.id_exposant and p.id_event_text = rec.id_event_text
    order by (p.stand_exposant is not null)::int desc,
             (p.urlexpo_event is not null)::int desc,
             (p.website_exposant is not null)::int desc,
             p.id_participation asc
    limit 1;

    insert into public.participation_dedup_log(id_exposant, id_event_text, kept_participation_id, deleted_row)
    select rec.id_exposant, rec.id_event_text, v_keep, to_jsonb(p)
    from public.participation p
    where p.id_exposant = rec.id_exposant and p.id_event_text = rec.id_event_text
      and p.id_participation <> v_keep;

    with del as (
      delete from public.participation p
      where p.id_exposant = rec.id_exposant and p.id_event_text = rec.id_event_text
        and p.id_participation <> v_keep
      returning 1
    ) select count(*) into this_del from del;

    g := g + 1;
    total_del := total_del + this_del;
  end loop;

  return query select g, total_del;
end $$;
revoke all on function public.dedup_participations_same_event() from public, anon;
grant execute on function public.dedup_participations_same_event() to authenticated, service_role;

-- Annulation
create or replace function public.revert_participation_dedup(p_log_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'revert_participation_dedup: admin uniquement';
  end if;
  select * into rec from public.participation_dedup_log where id = p_log_id and reverted = false;
  if not found then raise exception 'introuvable ou deja reverte'; end if;
  insert into public.participation
  select * from jsonb_populate_recordset(null::public.participation, jsonb_build_array(rec.deleted_row));
  update public.participation_dedup_log set reverted = true, reverted_at = now() where id = p_log_id;
end $$;
revoke all on function public.revert_participation_dedup(uuid) from public, anon;
grant execute on function public.revert_participation_dedup(uuid) to authenticated, service_role;