-- =====================================================================
-- Lot B (5/5) : liste des comptes en veille d'un import, consommee par
-- radar-crm-rematch-cron dans sa branche de reconciliation (qui relit
-- crm_company_event_matches directement et ne dispose donc pas du drapeau
-- `notifiable` produit par crm_run_matching).
-- Meme source de verite que ce drapeau : radar_company_in_veille.
-- Applique en prod le 08/09/2026 via Supabase MCP.
-- =====================================================================
create or replace function public.radar_veille_company_ids(p_import_id uuid)
returns table (crm_company_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id
  from public.crm_companies c
  where c.import_id = p_import_id
    and public.radar_company_in_veille(
          c.radar_account_id,
          c.import_id,
          public.radar_company_key(c.normalized_domain, c.company_name)
        );
$$;

revoke execute on function public.radar_veille_company_ids(uuid) from public, anon, authenticated;
grant execute on function public.radar_veille_company_ids(uuid) to service_role;
