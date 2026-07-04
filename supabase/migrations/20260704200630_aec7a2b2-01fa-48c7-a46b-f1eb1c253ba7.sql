-- ============================================================
-- 1) Colonnes additives
-- ============================================================
alter table public.radar_offer_profile
  add column if not exists profile_v2 jsonb;

alter table public.radar_missions
  add column if not exists ai_meta jsonb;
alter table public.radar_missions
  add column if not exists ai_generated_at timestamptz;
alter table public.radar_missions
  add column if not exists ai_field_sources jsonb not null default '{}'::jsonb;

-- ============================================================
-- 2) upsert_radar_offer_profile : +p_profile_v2 (rétro-compatible)
-- ============================================================
drop function if exists public.upsert_radar_offer_profile(text, text, text, text);

create or replace function public.upsert_radar_offer_profile(
  p_sells text,
  p_target text,
  p_problem text,
  p_qualifies text,
  p_profile_v2 jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select a.id into v_account_id
  from public.radar_members m join public.radar_accounts a on a.id = m.radar_account_id
  where m.user_id = v_uid and m.status = 'active' and a.deleted_at is null
  order by a.created_at asc limit 1;
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  insert into public.radar_offer_profile (radar_account_id, sells, target, problem, qualifies, profile_v2, updated_by, updated_at)
  values (v_account_id, p_sells, p_target, p_problem, p_qualifies, p_profile_v2, v_uid, now())
  on conflict (radar_account_id) do update set
      sells = excluded.sells,
      target = excluded.target,
      problem = excluded.problem,
      qualifies = excluded.qualifies,
      profile_v2 = coalesce(excluded.profile_v2, radar_offer_profile.profile_v2),
      updated_by = v_uid,
      updated_at = now();
  return v_account_id;
end; $function$;

-- ============================================================
-- 3) upsert_radar_mission : stamp 'user_edited' (signature INCHANGÉE)
-- ============================================================
create or replace function public.upsert_radar_mission(
  p_crm_company_id uuid,
  p_event_id uuid,
  p_objective text default null,
  p_opening_line text default null,
  p_top_q1 text default null,
  p_top_q2 text default null,
  p_top_q3 text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_key text;
  v_id_exposant text;
  v_mission_id uuid;
  v_src_ins jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select a.id into v_account_id
  from public.radar_members m join public.radar_accounts a on a.id = m.radar_account_id
  where m.user_id = v_uid and m.status = 'active' and a.deleted_at is null
  order by a.created_at asc limit 1;
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  select public.radar_company_key(c.normalized_domain, c.company_name) into v_key
  from public.crm_companies c
  where c.id = p_crm_company_id and c.radar_account_id = v_account_id;
  if v_key is null then raise exception 'company_not_found'; end if;

  select m.id_exposant into v_id_exposant
  from public.crm_company_event_matches m
  where m.crm_company_id = p_crm_company_id and m.event_id = p_event_id and m.radar_account_id = v_account_id
  limit 1;

  v_src_ins := '{}'::jsonb
    || case when p_objective    is not null then jsonb_build_object('objective','user_edited')    else '{}'::jsonb end
    || case when p_opening_line is not null then jsonb_build_object('opening_line','user_edited') else '{}'::jsonb end
    || case when p_top_q1       is not null then jsonb_build_object('top_q1','user_edited')       else '{}'::jsonb end
    || case when p_top_q2       is not null then jsonb_build_object('top_q2','user_edited')       else '{}'::jsonb end
    || case when p_top_q3       is not null then jsonb_build_object('top_q3','user_edited')       else '{}'::jsonb end;

  insert into public.radar_missions (radar_account_id, company_key, crm_company_id, event_id, id_exposant,
                                     objective, opening_line, top_q1, top_q2, top_q3, ai_field_sources, created_by, updated_at)
  values (v_account_id, v_key, p_crm_company_id, p_event_id, v_id_exposant,
          p_objective, p_opening_line, p_top_q1, p_top_q2, p_top_q3, v_src_ins, v_uid, now())
  on conflict (radar_account_id, company_key, event_id) do update set
      crm_company_id = excluded.crm_company_id,
      id_exposant  = coalesce(excluded.id_exposant, radar_missions.id_exposant),
      objective    = coalesce(excluded.objective, radar_missions.objective),
      opening_line = coalesce(excluded.opening_line, radar_missions.opening_line),
      top_q1 = coalesce(excluded.top_q1, radar_missions.top_q1),
      top_q2 = coalesce(excluded.top_q2, radar_missions.top_q2),
      top_q3 = coalesce(excluded.top_q3, radar_missions.top_q3),
      ai_field_sources = radar_missions.ai_field_sources || excluded.ai_field_sources,
      updated_at = now()
  returning id into v_mission_id;
  return v_mission_id;
end; $function$;

-- ============================================================
-- 4) get_radar_mission_context : contexte complet (scopé import actif)
-- ============================================================
create or replace function public.get_radar_mission_context(
  p_crm_company_id uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_import_id uuid;
  v_key text;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select a.id into v_account_id
  from public.radar_members m join public.radar_accounts a on a.id = m.radar_account_id
  where m.user_id = v_uid and m.status = 'active' and a.deleted_at is null
  order by a.created_at asc limit 1;
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  v_import_id := public.radar_active_import_id(v_account_id);

  select public.radar_company_key(c.normalized_domain, c.company_name) into v_key
  from public.crm_companies c
  where c.id = p_crm_company_id
    and c.radar_account_id = v_account_id
    and (c.import_id = v_import_id or c.import_id is null);
  if v_key is null then raise exception 'company_not_found_or_out_of_scope'; end if;

  select jsonb_build_object(
    'offer_profile', (
      select jsonb_build_object(
        'sells', op.sells, 'target', op.target, 'problem', op.problem, 'qualifies', op.qualifies,
        'profile_v2', op.profile_v2
      ) from public.radar_offer_profile op where op.radar_account_id = v_account_id
    ),
    'company', (
      select jsonb_build_object(
        'crm_company_id', c.id,
        'company_name', c.company_name,
        'website', c.website_raw,
        'normalized_domain', c.normalized_domain,
        'crm_status_raw', c.crm_status,
        'id_exposant', cem.id_exposant,
        'nom_exposant', (select ex.nom_exposant from public.exposants ex where ex.id_exposant = cem.id_exposant limit 1),
        'description', coalesce(
          (select nullif(btrim(ai.resume_court), '') from public.exhibitor_ai ai where ai.exhibitor_id = cem.id_exposant limit 1),
          (select nullif(btrim(ex2.exposant_description), '') from public.exposants ex2 where ex2.id_exposant = cem.id_exposant limit 1)
        ),
        'stands', (select coalesce(jsonb_agg(distinct pp.stand_exposant) filter (where pp.stand_exposant is not null), '[]'::jsonb)
                   from public.participation pp where pp.id_exposant = cem.id_exposant and pp.id_event = p_event_id)
      )
      from public.crm_companies c
      left join lateral (
        select m.id_exposant from public.crm_company_event_matches m
        where m.crm_company_id = c.id and m.event_id = p_event_id and m.radar_account_id = v_account_id
        limit 1
      ) cem on true
      where c.id = p_crm_company_id
    ),
    'event', (
      select jsonb_build_object(
        'event_id', e.id, 'nom_event', e.nom_event, 'secteur', e.secteur,
        'date_debut', e.date_debut, 'date_fin', e.date_fin, 'ville', e.ville,
        'is_future', (e.date_debut >= current_date)
      ) from public.events e where e.id = p_event_id
    ),
    'relationship_status', (
      select rel.relationship_status from public.radar_company_relationship rel
      where rel.radar_account_id = v_account_id and rel.company_key = v_key
    ),
    'mission', (
      select jsonb_build_object(
        'mission_id', ms.id,
        'objective', ms.objective, 'opening_line', ms.opening_line,
        'top_q1', ms.top_q1, 'top_q2', ms.top_q2, 'top_q3', ms.top_q3,
        'ai_field_sources', coalesce(ms.ai_field_sources, '{}'::jsonb),
        'ai_generated_at', ms.ai_generated_at
      )
      from public.radar_missions ms
      where ms.radar_account_id = v_account_id and ms.company_key = v_key and ms.event_id = p_event_id
    )
  ) into v_result;

  return v_result;
end; $function$;

-- ============================================================
-- 5) apply_radar_mission_strategy : écrit la sortie IA, source-aware
-- ============================================================
create or replace function public.apply_radar_mission_strategy(
  p_crm_company_id uuid,
  p_event_id uuid,
  p_objective text,
  p_opening_line text,
  p_top_q1 text,
  p_top_q2 text,
  p_top_q3 text,
  p_ai_meta jsonb,
  p_force boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_import_id uuid;
  v_key text;
  v_id_exposant text;
  v_sources jsonb;
  v_mission_id uuid;
  v_w_obj boolean; v_w_open boolean; v_w_q1 boolean; v_w_q2 boolean; v_w_q3 boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select a.id into v_account_id
  from public.radar_members m join public.radar_accounts a on a.id = m.radar_account_id
  where m.user_id = v_uid and m.status = 'active' and a.deleted_at is null
  order by a.created_at asc limit 1;
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  v_import_id := public.radar_active_import_id(v_account_id);

  select public.radar_company_key(c.normalized_domain, c.company_name) into v_key
  from public.crm_companies c
  where c.id = p_crm_company_id
    and c.radar_account_id = v_account_id
    and (c.import_id = v_import_id or c.import_id is null);
  if v_key is null then raise exception 'company_not_found_or_out_of_scope'; end if;

  select m.id_exposant into v_id_exposant
  from public.crm_company_event_matches m
  where m.crm_company_id = p_crm_company_id and m.event_id = p_event_id and m.radar_account_id = v_account_id
  limit 1;

  insert into public.radar_missions (radar_account_id, company_key, crm_company_id, event_id, id_exposant, created_by, updated_at)
  values (v_account_id, v_key, p_crm_company_id, p_event_id, v_id_exposant, v_uid, now())
  on conflict (radar_account_id, company_key, event_id) do nothing;

  select coalesce(ai_field_sources, '{}'::jsonb) into v_sources
  from public.radar_missions
  where radar_account_id = v_account_id and company_key = v_key and event_id = p_event_id;

  v_w_obj  := p_force or coalesce(v_sources->>'objective','')    <> 'user_edited';
  v_w_open := p_force or coalesce(v_sources->>'opening_line','') <> 'user_edited';
  v_w_q1   := p_force or coalesce(v_sources->>'top_q1','')       <> 'user_edited';
  v_w_q2   := p_force or coalesce(v_sources->>'top_q2','')       <> 'user_edited';
  v_w_q3   := p_force or coalesce(v_sources->>'top_q3','')       <> 'user_edited';

  v_sources := v_sources
    || case when v_w_obj  and p_objective    is not null then jsonb_build_object('objective','ai')    else '{}'::jsonb end
    || case when v_w_open and p_opening_line is not null then jsonb_build_object('opening_line','ai') else '{}'::jsonb end
    || case when v_w_q1   and p_top_q1       is not null then jsonb_build_object('top_q1','ai')       else '{}'::jsonb end
    || case when v_w_q2   and p_top_q2       is not null then jsonb_build_object('top_q2','ai')       else '{}'::jsonb end
    || case when v_w_q3   and p_top_q3       is not null then jsonb_build_object('top_q3','ai')       else '{}'::jsonb end;

  update public.radar_missions m set
    objective    = case when v_w_obj  then coalesce(p_objective, m.objective)       else m.objective end,
    opening_line = case when v_w_open then coalesce(p_opening_line, m.opening_line) else m.opening_line end,
    top_q1       = case when v_w_q1   then coalesce(p_top_q1, m.top_q1)             else m.top_q1 end,
    top_q2       = case when v_w_q2   then coalesce(p_top_q2, m.top_q2)             else m.top_q2 end,
    top_q3       = case when v_w_q3   then coalesce(p_top_q3, m.top_q3)             else m.top_q3 end,
    ai_meta          = coalesce(p_ai_meta, m.ai_meta),
    ai_field_sources = v_sources,
    ai_generated_at  = now(),
    updated_at       = now()
  where m.radar_account_id = v_account_id and m.company_key = v_key and m.event_id = p_event_id
  returning m.id into v_mission_id;

  return v_mission_id;
end; $function$;

-- ============================================================
-- 6) Grants : aligner EXACTEMENT sur les RPC sœurs
--    (siblings accordent anon + authenticated + service_role)
-- ============================================================
grant execute on function public.upsert_radar_offer_profile(text, text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.get_radar_mission_context(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.apply_radar_mission_strategy(uuid, uuid, text, text, text, text, text, jsonb, boolean) to anon, authenticated, service_role;

-- ============================================================
-- 6bis) get_radar_salon_missions : +3 clés (ai_meta, ai_generated_at, ai_field_sources)
--       Définition reprise à l'identique, seuls ces 3 champs ajoutés.
-- ============================================================
create or replace function public.get_radar_salon_missions(p_event_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
      'ai_meta', ms.ai_meta,
      'ai_generated_at', ms.ai_generated_at,
      'ai_field_sources', coalesce(ms.ai_field_sources, '{}'::jsonb),
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
end; $function$;