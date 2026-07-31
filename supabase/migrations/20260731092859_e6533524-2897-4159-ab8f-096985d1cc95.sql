alter table public.exposant_merge_log
  add column if not exists deleted_participations jsonb not null default '[]'::jsonb;

create or replace function public.apply_exposant_merge_plan(p_canonical text default null)
returns table(variantes_appliquees int, participations_repointees int, participations_dedupliquees int)
language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_moved uuid[];
  v_deleted jsonb;
  n_var int := 0; n_moved int := 0; n_del int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'apply_exposant_merge_plan: admin uniquement';
  end if;

  for rec in
    select id, canonical_id_exposant, merged_id_exposant, canonical_id, merged_id
    from public.exposant_merge_log
    where applied = false and reverted = false
      and (p_canonical is null or canonical_id_exposant = p_canonical)
    order by canonical_id_exposant, merged_id_exposant
  loop
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_deleted
    from public.participation p
    where p.id_exposant = rec.merged_id_exposant
      and p.id_event_text is not null
      and exists (select 1 from public.participation q
                  where q.id_exposant = rec.canonical_id_exposant
                    and q.id_event_text = p.id_event_text);

    delete from public.participation p
    where p.id_exposant = rec.merged_id_exposant
      and p.id_event_text is not null
      and exists (select 1 from public.participation q
                  where q.id_exposant = rec.canonical_id_exposant
                    and q.id_event_text = p.id_event_text);

    v_moved := '{}';
    with moved as (
      update public.participation p set id_exposant = rec.canonical_id_exposant
      where p.id_exposant = rec.merged_id_exposant
      returning p.id_participation
    )
    select coalesce(array_agg(id_participation), '{}') into v_moved from moved;

    update public.exposants
      set is_canonical = false, canonical_id = rec.canonical_id,
          dedup_status = 'merged', merged_at = now()
    where id = rec.merged_id;

    update public.exposant_merge_log
      set applied = true,
          participations_moved = coalesce(array_length(v_moved,1),0),
          moved_participation_ids = v_moved,
          deleted_participations = v_deleted,
          applied_by = auth.uid()
    where id = rec.id;

    n_var := n_var + 1;
    n_moved := n_moved + coalesce(array_length(v_moved,1),0);
    n_del := n_del + coalesce(jsonb_array_length(v_deleted),0);
  end loop;

  update public.exposants set dedup_status = 'canonical'
  where id_exposant in (
    select distinct canonical_id_exposant from public.exposant_merge_log
    where applied = true and reverted = false
      and (p_canonical is null or canonical_id_exposant = p_canonical))
    and dedup_status <> 'canonical';

  return query select n_var, n_moved, n_del;
end $$;

revoke all on function public.apply_exposant_merge_plan(text) from public, anon;
grant execute on function public.apply_exposant_merge_plan(text) to authenticated, service_role;

create or replace function public.revert_exposant_merge(p_log_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'revert_exposant_merge: admin uniquement';
  end if;

  select * into rec from public.exposant_merge_log
  where id = p_log_id and applied = true and reverted = false;
  if not found then raise exception 'log introuvable ou deja reverte'; end if;

  update public.participation set id_exposant = rec.merged_id_exposant
  where id_participation = any(rec.moved_participation_ids);

  if jsonb_array_length(rec.deleted_participations) > 0 then
    insert into public.participation
    select * from jsonb_populate_recordset(null::public.participation, rec.deleted_participations);
  end if;

  update public.exposants
    set is_canonical = true, canonical_id = null, dedup_status = 'unprocessed', merged_at = null
  where id = rec.merged_id;

  delete from public.exposant_merge_log where id = p_log_id;
end $$;

revoke all on function public.revert_exposant_merge(uuid) from public, anon;
grant execute on function public.revert_exposant_merge(uuid) to authenticated, service_role;