-- =====================================================================
-- Lot B (complement) : la recherche d'exposants ne masque plus les
-- entreprises ecartees. Applique en prod le 08/09/2026 via Supabase MCP.
--
-- Cas reel : BARINGS, exposant d'IPEM GLOBAL 2026, etait introuvable dans
-- la recherche parce qu'elle figure dans radar_company_prefs avec
-- status = 'ignored' (ecartee lors d'une suggestion d'entreprises
-- similaires). En Mode Salon, avoir physiquement rencontre quelqu'un prime
-- sur un tri fait en amont : masquer le resultat produit une impasse.
--
-- Les ignorees sont desormais retournees, en fin de liste, avec un
-- drapeau `ignored` que le front affiche comme un badge. Les autres types
-- de resultats sont inchanges. La regle d'or est passee a la branche
-- import manuel (Lot A).
-- =====================================================================
create or replace function public.search_radar_salon_exposants(p_event_id uuid, p_query text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid; v_import_id uuid; v_manual_import_id uuid; v_q text; v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select a.id into v_account_id from public.radar_members m join public.radar_accounts a on a.id=m.radar_account_id
  where m.user_id=v_uid and m.status='active' and a.deleted_at is null order by m.is_primary desc, a.created_at asc limit 1;
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;
  v_import_id := public.radar_active_import_id(v_account_id); v_manual_import_id := public.radar_manual_import_id(v_account_id);

  v_q := btrim(coalesce(p_query, ''));
  if length(v_q) < 2 then return jsonb_build_object('query', v_q, 'results', '[]'::jsonb); end if;

  with my_matches as (
    select distinct m.id_exposant from public.crm_company_event_matches m
    join public.crm_companies c on c.id = m.crm_company_id
    where m.radar_account_id = v_account_id and m.event_id = p_event_id
      and (c.import_id = v_import_id or c.import_id = v_manual_import_id)
  ),
  my_domains as (
    select distinct lower(btrim(normalized_domain)) d from public.crm_companies
    where radar_account_id = v_account_id and normalized_domain is not null and btrim(normalized_domain) <> ''
      and (import_id = v_import_id or import_id = v_manual_import_id)
  ),
  ignored as (
    select company_key from public.radar_company_prefs where radar_account_id = v_account_id and status = 'ignored'
  ),
  own as (
    select c.id as crm_company_id, c.company_name
    from public.crm_companies c
    where c.radar_account_id = v_account_id
      and (c.import_id = v_import_id or c.import_id = v_manual_import_id)
      and c.company_name ilike '%' || v_q || '%'
      and ( exists (select 1 from public.crm_company_event_matches m
                    where m.crm_company_id=c.id and m.event_id=p_event_id and m.radar_account_id=v_account_id)
         or exists (select 1 from public.radar_missions ms
                    where ms.crm_company_id=c.id and ms.event_id=p_event_id and ms.radar_account_id=v_account_id) )
  ),
  addable as (
    select distinct on (v.normalized_domain)
      v.id_exposant, v.nom_exposant, v.website_exposant, v.normalized_domain, v.stand_exposants_list,
      (public.radar_company_key(v.normalized_domain, v.nom_exposant) in (select company_key from ignored)) as is_ignored
    from public.crm_radar_participations_view v
    where v.event_id = p_event_id
      and v.nom_exposant ilike '%' || v_q || '%'
      and v.id_exposant not in (select id_exposant from my_matches)
      and lower(btrim(v.normalized_domain)) not in (select d from my_domains)
    order by v.normalized_domain
  ),
  combined as (
    select 0 as ord, own.company_name as nom,
      jsonb_build_object('type','in_list','crm_company_id',own.crm_company_id,'nom',own.company_name) as r
    from own
    union all
    select case when a.is_ignored then 2 else 1 end as ord, a.nom_exposant as nom,
      jsonb_build_object('type','addable','id_exposant',a.id_exposant,'nom',a.nom_exposant,
        'website',a.website_exposant,'normalized_domain',a.normalized_domain,'stands',a.stand_exposants_list,
        'ignored',a.is_ignored,
        'secteur',(select nullif(btrim(ai.secteur_principal),'') from public.exhibitor_ai ai where ai.exhibitor_id=a.id_exposant limit 1)) as r
    from (select * from addable order by is_ignored asc, nom_exposant asc limit 15) a
  )
  select jsonb_build_object('query', v_q,
    'results', coalesce((select jsonb_agg(r order by ord, nom) from combined), '[]'::jsonb)) into v_result;
  return v_result;
end; $function$;

revoke execute on function public.search_radar_salon_exposants(uuid, text) from public, anon;
grant execute on function public.search_radar_salon_exposants(uuid, text) to authenticated;
