create or replace function public.get_event_card_stats(_event_ids uuid[])
returns table(event_id uuid, exhibitor_count bigint, novelty_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.id as event_id,
    (
      select count(distinct coalesce(p.exhibitor_id::text, p.id_exposant))
      from participation p
      where p.id_event = e.id
    ) as exhibitor_count,
    (
      select count(*)
      from novelties n
      where n.event_id = e.id
        and n.status = 'published'
        and coalesce(n.is_test, false) = false
    ) as novelty_count
  from events e
  where e.id = any(_event_ids)
    and coalesce(e.visible, false) = true
    and coalesce(e.is_test, false) = false
$$;

grant execute on function public.get_event_card_stats(uuid[]) to anon, authenticated, service_role;

create index if not exists idx_participation_event_exhib_exposant
  on public.participation(id_event, exhibitor_id, id_exposant);
create index if not exists idx_novelties_event_status_test
  on public.novelties(event_id, status, is_test);