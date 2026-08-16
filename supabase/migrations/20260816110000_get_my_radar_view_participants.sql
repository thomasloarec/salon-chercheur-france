-- =====================================================================
-- Participation d'equipe injectee dans get_my_radar_view.
-- Applique en prod le 16/08/2026 via Supabase MCP, verifie empiriquement.
-- A committer dans supabase/migrations/.
--
-- Ajout strictement additif : chaque evenement de la cle "events" porte
-- desormais deux champs supplementaires :
--   - participants     : jsonb[] { user_id, display_name, avatar_url, is_me }
--                        trie avec le membre courant en premier, puis anciennete
--   - participant_count: int
-- La branche sans acces renvoie participants=[] et participant_count=0
-- (aucune donnee de participation exposee en teaser).
--
-- Choix d'architecture : injection ici plutot qu'un appel par salon a
-- get_radar_event_participants, pour eviter N requetes reseau sur la liste.
-- Le reste de la fonction (summary, scoping import actif, gating) est INCHANGE.
-- =====================================================================
create or replace function public.get_my_radar_view(p_import_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid; v_plan text; v_trial_ends_at timestamptz;
  v_has_access boolean; v_status text; v_days_left int;
  v_import_id uuid := p_import_id;
  v_summary jsonb; v_events jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select a.id, a.plan, a.trial_ends_at into v_account_id, v_plan, v_trial_ends_at
  from public.radar_members m join public.radar_accounts a on a.id = m.radar_account_id
  where m.user_id = v_uid and m.status='active' and a.deleted_at is null
  order by m.is_primary desc, a.created_at asc limit 1;

  if v_account_id is null then
    return jsonb_build_object('has_access', false, 'status','none','days_left',null,'import_id',null,
      'summary', jsonb_build_object('companies_analyzed',0,'companies_detected',0,'future_companies',0,'future_salons',0,'future_participations',0,'starred',0,'ignored',0),
      'events','[]'::jsonb);
  end if;

  v_has_access := (v_plan in ('paid','beta')) or (v_plan='trial' and v_trial_ends_at is not null and v_trial_ends_at > now());
  v_status := case when v_plan in ('paid','beta') then v_plan
                   when v_plan='trial' and v_trial_ends_at > now() then 'trial_active'
                   when v_plan='trial' then 'trial_expired' else v_plan end;
  v_days_left := case when v_plan='trial' and v_trial_ends_at is not null
                  then greatest(0, ceil(extract(epoch from (v_trial_ends_at - now()))/86400)::int) else null end;

  if v_import_id is null then
    select i.id into v_import_id from public.crm_imports i
    where i.radar_account_id = v_account_id
      and exists (select 1 from public.crm_companies c where c.import_id = i.id)
    order by i.created_at desc limit 1;
  end if;

  with comp as (
    select id, normalized_domain, company_name
    from public.crm_companies where radar_account_id = v_account_id and (import_id = v_import_id or import_id is null)
  ),
  det as (
    select m.crm_company_id, m.event_id, v.is_future_event, pr.status as pref_status
    from public.crm_company_event_matches m
    join comp c on c.id = m.crm_company_id
    left join public.crm_radar_participations_view v on v.event_id=m.event_id and v.id_exposant=m.id_exposant
    left join public.radar_company_prefs pr
      on pr.radar_account_id = v_account_id
     and pr.company_key = public.radar_company_key(c.normalized_domain, c.company_name)
    where m.radar_account_id = v_account_id
  )
  select jsonb_build_object(
    'companies_analyzed', (select count(*) from comp),
    'companies_detected', (select count(distinct crm_company_id) from det),
    'future_companies',   (select count(distinct crm_company_id) from det where is_future_event),
    'future_salons',      (select count(distinct event_id) from det where is_future_event),
    'future_participations', (select count(*) from det where is_future_event),
    'starred',            (select count(distinct crm_company_id) from det where pref_status='starred'),
    'ignored',            (select count(distinct crm_company_id) from det where pref_status='ignored')
  ) into v_summary;

  if v_has_access then
    with comp as (
      select id, company_name, website_raw, normalized_domain
      from public.crm_companies where radar_account_id = v_account_id and (import_id = v_import_id or import_id is null)
    ),
    det as (
      select m.crm_company_id, m.id_exposant, m.event_id, m.needs_review, m.name_similarity,
             c.company_name, c.website_raw, c.normalized_domain,
             pr.status as pref_status,
             v.nom_exposant, v.nom_event, v.slug, v.url_image, v.type_event,
             v.date_debut, v.date_fin, v.ville, v.nom_lieu,
             v.stand_exposants_list, v.is_future_event, v.days_until_event
      from public.crm_company_event_matches m
      join comp c on c.id = m.crm_company_id
      left join public.crm_radar_participations_view v on v.event_id=m.event_id and v.id_exposant=m.id_exposant
      left join public.radar_company_prefs pr
        on pr.radar_account_id = v_account_id
       and pr.company_key = public.radar_company_key(c.normalized_domain, c.company_name)
      where m.radar_account_id = v_account_id
    ),
    part as (
      select pa.event_id,
             jsonb_agg(jsonb_build_object(
               'user_id', pa.user_id,
               'display_name', public.radar_member_display_name(pa.user_id),
               'avatar_url', public.radar_member_avatar_url(pa.user_id),
               'is_me', (pa.user_id = v_uid)
             ) order by (pa.user_id = v_uid) desc, pa.created_at) as participants,
             count(*) as participant_count
      from public.radar_event_participants pa
      join public.radar_members rm
        on rm.radar_account_id = pa.radar_account_id and rm.user_id = pa.user_id and rm.status='active'
      where pa.radar_account_id = v_account_id
      group by pa.event_id
    )
    select coalesce(jsonb_agg(ev order by duk nulls last), '[]'::jsonb) into v_events
    from (
      select max(days_until_event) as duk,
        jsonb_build_object(
          'event_id', d.event_id, 'nom_event', max(nom_event), 'slug', max(slug),
          'url_image', max(url_image), 'type_event', max(type_event),
          'date_debut', max(date_debut), 'date_fin', max(date_fin),
          'ville', max(ville), 'nom_lieu', max(nom_lieu),
          'days_until_event', max(days_until_event), 'is_future_event', bool_or(is_future_event),
          'company_count', count(distinct crm_company_id),
          'participants', coalesce(max(pt.participants), '[]'::jsonb),
          'participant_count', coalesce(max(pt.participant_count), 0),
          'companies', jsonb_agg(jsonb_build_object(
            'crm_company_id', crm_company_id, 'company_name', company_name,
            'website_raw', website_raw, 'normalized_domain', normalized_domain,
            'id_exposant', id_exposant, 'nom_exposant', nom_exposant,
            'stand_exposants_list', stand_exposants_list,
            'needs_review', needs_review, 'name_similarity', name_similarity,
            'pref_status', pref_status))
        ) as ev
      from det d
      left join part pt on pt.event_id = d.event_id
      group by d.event_id having max(nom_event) is not null
    ) sub;
  else
    with comp as (
      select id from public.crm_companies where radar_account_id = v_account_id and (import_id = v_import_id or import_id is null)
    ),
    det as (
      select m.crm_company_id, m.event_id,
             v.nom_event, v.slug, v.url_image, v.date_debut, v.ville, v.days_until_event
      from public.crm_company_event_matches m
      join comp c on c.id = m.crm_company_id
      left join public.crm_radar_participations_view v on v.event_id=m.event_id and v.id_exposant=m.id_exposant
      where m.radar_account_id = v_account_id and v.is_future_event = true
    )
    select coalesce(jsonb_agg(ev order by duk asc), '[]'::jsonb) into v_events
    from (
      select max(days_until_event) as duk,
        jsonb_build_object(
          'event_id', event_id, 'nom_event', max(nom_event), 'slug', max(slug),
          'url_image', max(url_image), 'date_debut', max(date_debut), 'ville', max(ville),
          'days_until_event', max(days_until_event), 'is_future_event', true,
          'company_count', null, 'companies', '[]'::jsonb,
          'participants', '[]'::jsonb, 'participant_count', 0
        ) as ev
      from det group by event_id having max(nom_event) is not null
      order by max(days_until_event) asc limit 3
    ) sub;
  end if;

  return jsonb_build_object('has_access', v_has_access, 'status', v_status, 'days_left', v_days_left,
    'import_id', v_import_id, 'summary', v_summary, 'events', v_events);
end;
$function$;
