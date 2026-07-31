alter table public.exposant_merge_log add column if not exists airtable_done boolean not null default false;
alter table public.exposant_merge_log add column if not exists airtable_done_at timestamptz;
alter table public.exposant_merge_log add column if not exists airtable_done_by uuid;
create index if not exists idx_merge_log_airtable_done on public.exposant_merge_log(airtable_done) where reverted = false;

drop view if exists public.v_exposant_cleanup_actions;
create view public.v_exposant_cleanup_actions
with (security_invoker = on, security_barrier = on) as
select
  l.id, l.created_at, l.origin, l.airtable_action,
  l.merged_id_exposant     as id_exposant_a_corriger,
  l.merged_nom             as nom_actuel,
  l.airtable_current_value as valeur_actuelle,
  l.airtable_target_value  as valeur_cible,
  l.canonical_id_exposant  as id_exposant_canonique,
  l.canonical_nom          as nom_canonique,
  l.merge_reason, l.confidence, l.participations_moved,
  l.airtable_done, l.airtable_done_at
from public.exposant_merge_log l
where l.reverted = false and l.applied = true
  and l.origin = 'airtable' and l.airtable_action <> 'none'
order by l.airtable_done asc, l.canonical_nom asc;
revoke all on public.v_exposant_cleanup_actions from anon;
grant select on public.v_exposant_cleanup_actions to authenticated;
grant all on public.v_exposant_cleanup_actions to service_role;

create or replace function public.mark_exposant_correction_done(p_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'mark_exposant_correction_done: admin uniquement';
  end if;
  update public.exposant_merge_log
    set airtable_done = p_done,
        airtable_done_at = case when p_done then now() else null end,
        airtable_done_by = case when p_done then auth.uid() else null end
  where id = p_id;
end $$;
revoke all on function public.mark_exposant_correction_done(uuid, boolean) from public, anon;
grant execute on function public.mark_exposant_correction_done(uuid, boolean) to authenticated, service_role;