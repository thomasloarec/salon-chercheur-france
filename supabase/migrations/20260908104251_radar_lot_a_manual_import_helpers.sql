-- =====================================================================
-- Lot A (1/3) : socle de visibilite de l'import manuel Radar CRM.
-- Applique en prod le 08/09/2026 via Supabase MCP.
-- Aucun changement fonctionnel : tant qu'aucun import 'manual' n'existe,
-- radar_manual_import_id() renvoie NULL et la seconde branche de la
-- regle d'or n'ajoute aucune ligne. Non-regression verifiee avant/apres
-- (get_radar_salon_missions, get_radar_onboarding_progress,
--  get_radar_similar_counts, get_my_radar_view : valeurs identiques).
-- =====================================================================

-- Un seul import manuel par espace Radar.
create unique index if not exists ux_crm_imports_one_manual_per_account
  on public.crm_imports (radar_account_id)
  where source_type = 'manual';

-- Import manuel d'un espace, NULL s'il n'existe pas encore.
create or replace function public.radar_manual_import_id(p_account_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.id
  from public.crm_imports i
  where i.radar_account_id = p_account_id
    and i.source_type = 'manual'
  order by i.created_at asc
  limit 1;
$$;

comment on function public.radar_manual_import_id(uuid) is
  'Import portant les comptes crees a la main (rencontres terrain). Exclu du calcul de l''import actif, inclus dans la regle de visibilite.';

-- Creation paresseuse de l'import manuel.
create or replace function public.radar_ensure_manual_import(p_account_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_user uuid;
begin
  if p_account_id is null then raise exception 'account_required'; end if;

  v_id := public.radar_manual_import_id(p_account_id);
  if v_id is not null then return v_id; end if;

  -- Le user_id doit etre celui des imports existants : crm_run_matching
  -- filtre sur (import_id, user_id) et l'unicite crm_companies porte sur
  -- (user_id, normalized_domain).
  select i.user_id into v_user
  from public.crm_imports i
  where i.radar_account_id = p_account_id
  order by i.created_at desc
  limit 1;

  if v_user is null then
    select a.seed_user_id into v_user
    from public.radar_accounts a
    where a.id = p_account_id;
  end if;

  if v_user is null then
    select m.user_id into v_user
    from public.radar_members m
    where m.radar_account_id = p_account_id and m.status = 'active'
    order by m.is_primary desc
    limit 1;
  end if;

  if v_user is null then raise exception 'no_owner_for_account'; end if;

  insert into public.crm_imports
    (user_id, radar_account_id, source_type, status, file_name, total_rows)
  values
    (v_user, p_account_id, 'manual', 'completed', 'Ajouts manuels', 0)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    v_id := public.radar_manual_import_id(p_account_id);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.radar_ensure_manual_import(uuid) from public, anon, authenticated;

-- L'import manuel ne doit JAMAIS devenir l'import actif : il masquerait
-- l'import CRM courant dans les onze fonctions appliquant la regle d'or.
create or replace function public.radar_active_import_id(p_account_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.id
  from public.crm_imports i
  where i.radar_account_id = p_account_id
    and i.source_type <> 'manual'
    and exists (select 1 from public.crm_companies c where c.import_id = i.id)
  order by i.created_at desc
  limit 1;
$$;
