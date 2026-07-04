CREATE OR REPLACE FUNCTION public.get_radar_salon_missions(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid; v_import_id uuid;
  v_event jsonb; v_companies jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select a.id into v_account_id
  from public.radar_members m join public.radar_accounts a on a.id = m.radar_account_id
  where m.user_id = v_uid and m.status = 'active' and a.deleted_at is null
  order by a.created_at asc limit 1;

  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  v_import_id := public.radar_active_import_id(v_account_id);

  select jsonb_build_object(
    'event_id', e.id, 'nom_event', e.nom_event, 'slug', e.slug,
    'date_debut', e.date_debut, 'date_fin', e.date_fin,
    'ville', e.ville, 'nom_lieu', e.nom_lieu,
    'is_future', (e.date_debut >= current_date)
  ) into v_event
  from public.events e where e.id = p_event_id;

  with company_set as (
    select mt.crm_company_id,
           max(mt.id_exposant) as id_exposant,
           bool_or(mt.needs_review) as needs_review,
           max(mt.name_similarity) as name_similarity
    from public.crm_company_event_matches mt
    join public.crm_companies cc on cc.id = mt.crm_company_id
    where mt.radar_account_id = v_account_id and mt.event_id = p_event_id
      and (cc.import_id = v_import_id or cc.import_id is null)
    group by mt.crm_company_id
    union
    select ms.crm_company_id, ms.id_exposant, null::boolean, null::numeric
    from public.radar_missions ms
    join public.crm_companies cc2 on cc2.id = ms.crm_company_id
    where ms.radar_account_id = v_account_id and ms.event_id = p_event_id
      and ms.crm_company_id is not null
      and (cc2.import_id = v_import_id or cc2.import_id is null)
      and not exists (
        select 1 from public.crm_company_event_matches mt2
        where mt2.crm_company_id = ms.crm_company_id and mt2.event_id = p_event_id
          and mt2.radar_account_id = v_account_id
      )
  )
  select coalesce(jsonb_agg(comp order by comp->>'company_name'), '[]'::jsonb) into v_companies
  from (
    select jsonb_build_object(
      'crm_company_id', c.id,
      'company_name', c.company_name,
      'website', c.website_raw,
      'normalized_domain', c.normalized_domain,
      'description', coalesce(
        (select nullif(btrim(ai.resume_court), '') from public.exhibitor_ai ai where ai.exhibitor_id = cs.id_exposant limit 1),
        (select nullif(btrim(ex2.exposant_description), '') from public.exposants ex2 where ex2.id_exposant = cs.id_exposant limit 1)
      ),
      'id_exposant', cs.id_exposant,
      'nom_exposant', (select ex.nom_exposant from public.exposants ex where ex.id_exposant = cs.id_exposant limit 1),
      'stands', (select coalesce(jsonb_agg(distinct pp.stand_exposant) filter (where pp.stand_exposant is not null), '[]'::jsonb)
                 from public.participation pp where pp.id_exposant = cs.id_exposant and pp.id_event = p_event_id),
      'needs_review', cs.needs_review,
      'name_similarity', cs.name_similarity,
      'crm_status_raw', c.crm_status,
      'pref_status', pr.status,
      'relationship_status', rel.relationship_status,
      'mission_id', ms.id,
      'objective', ms.objective,
      'opening_line', ms.opening_line,
      'top_q1', ms.top_q1, 'top_q2', ms.top_q2, 'top_q3', ms.top_q3,
      'origin', ms.origin,
      'visited', coalesce(ms.visited, false),
      'visited_at', ms.visited_at,
      'notes', case when ms.id is null then '[]'::jsonb else coalesce(
        (select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'source', n.source, 'created_at', n.created_at) order by n.created_at desc)
         from public.radar_mission_notes n where n.mission_id = ms.id), '[]'::jsonb) end,
      'tasks', case when ms.id is null then '[]'::jsonb else coalesce(
        (select jsonb_agg(jsonb_build_object('id', t.id, 'body', t.body, 'due_at', t.due_at, 'done', t.done, 'source', t.source) order by t.created_at desc)
         from public.radar_mission_tasks t where t.mission_id = ms.id), '[]'::jsonb) end
    ) as comp
    from company_set cs
    join public.crm_companies c on c.id = cs.crm_company_id
    left join lateral (select public.radar_company_key(c.normalized_domain, c.company_name) as k) k on true
    left join public.radar_company_prefs pr on pr.radar_account_id = v_account_id and pr.company_key = k.k
    left join public.radar_company_relationship rel on rel.radar_account_id = v_account_id and rel.company_key = k.k
    left join public.radar_missions ms on ms.radar_account_id = v_account_id and ms.company_key = k.k and ms.event_id = p_event_id
  ) sub;

  return jsonb_build_object('event', v_event, 'companies', coalesce(v_companies, '[]'::jsonb));
end; $function$