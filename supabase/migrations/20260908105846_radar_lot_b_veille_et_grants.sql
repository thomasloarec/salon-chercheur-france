-- =====================================================================
-- Lot B (2/5) : regle de veille + assainissement des droits.
-- Applique en prod le 08/09/2026 via Supabase MCP.
--
-- Veille : un compte de l'import manuel dont le statut relationnel est
-- NULL ou 'a_qualifier' reste visible partout dans l'interface, mais ne
-- declenche aucune notification. La condition sur l'import manuel est
-- indispensable : les comptes issus d'un import CSV sont eux aussi non
-- qualifies par defaut et doivent continuer a notifier comme avant.
-- =====================================================================

create or replace function public.radar_company_in_veille(
  p_account_id uuid,
  p_import_id uuid,
  p_company_key text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_import_id is not null
     and p_import_id = public.radar_manual_import_id(p_account_id)
     and not exists (
       select 1 from public.radar_company_relationship r
       where r.radar_account_id = p_account_id
         and r.company_key = p_company_key
         and r.relationship_status is not null
         and r.relationship_status <> 'a_qualifier'
     );
$$;

comment on function public.radar_company_in_veille(uuid, uuid, text) is
  'Vrai si le compte provient de l''import manuel et n''a pas encore ete qualifie. Un compte en veille reste visible dans l''interface mais ne declenche aucune notification.';

grant execute on function public.radar_company_in_veille(uuid, uuid, text) to authenticated, service_role;

-- Remise en service de la recherche d'exposants du salon (revoquee le
-- 16/08 quand plus aucun front ne l'appelait ; le Mode Salon la rebranche).
grant execute on function public.search_radar_salon_exposants(uuid, text) to authenticated;

-- La revocation du 16/08 etait inoperante : ces fonctions conservaient
-- EXECUTE pour PUBLIC (=X dans proacl). Ce sont des stubs qui levent
-- 'manual_add_disabled', mais l'ACL doit refleter l'intention.
revoke execute on function public.add_radar_manual_company(uuid, text, text) from public;
revoke execute on function public.add_radar_company_from_exposant(text, uuid) from public;
revoke execute on function public.get_user_crm_matches(uuid) from public;
