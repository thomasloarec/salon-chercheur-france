-- Assistant « Pépites », lot 3a : la couche serveur de l'onboarding et de Mon Agenda.
-- Cadrage : page Notion 18, validé par Thomas le 03/10/2026.
-- Tout passe par des fonctions qui vérifient l'appelant ; aucune table n'est ouverte au site.

-- ---------------------------------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------------------------------
alter table public.assistant_pistes
  add column if not exists short_label text;

alter table public.assistant_profiles
  add column if not exists claim_token uuid not null default gen_random_uuid(),
  add column if not exists company_ref text,
  add column if not exists onboarded_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- 2. Quotas (coût de l'IA) : journal des appels faits par les utilisateurs eux-mêmes
-- ---------------------------------------------------------------------------------------------
create table if not exists public.assistant_engine_runs (
  id           bigserial primary key,
  user_id      uuid not null,
  profile_id   uuid,
  is_anonymous boolean not null default false,
  mode         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists assistant_engine_runs_user_idx
  on public.assistant_engine_runs (user_id, created_at desc);
alter table public.assistant_engine_runs enable row level security;

-- Limites sur 24 h : recherche (moteur, modes « engine_… ») 3 pour un visiteur anonyme, 10 pour un compte ;
-- aides de l'onboarding (propositions de centres d'intérêt, pistes seules) 30.
create or replace function public.assistant_engine_run_allowed(
  p_user_id uuid, p_is_anonymous boolean, p_mode text, p_profile_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_kind  text := case when p_mode like 'engine%' then 'engine' else 'onboarding' end;
  v_limit integer;
  v_used  integer;
begin
  v_limit := case
    when v_kind = 'onboarding' then 30
    when coalesce(p_is_anonymous, false) then 3
    else 10
  end;
  select count(*) into v_used
  from public.assistant_engine_runs r
  where r.user_id = p_user_id
    and r.created_at > now() - interval '24 hours'
    and (case when r.mode like 'engine%' then 'engine' else 'onboarding' end) = v_kind;
  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'limit', v_limit, 'used', v_used);
  end if;
  insert into public.assistant_engine_runs (user_id, profile_id, is_anonymous, mode)
  values (p_user_id, p_profile_id, coalesce(p_is_anonymous, false), p_mode);
  return jsonb_build_object('allowed', true, 'limit', v_limit, 'used', v_used + 1);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Aides : profil de l'appelant, droit d'accès, secteur nommé d'une pépite
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_my_profile_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select ap.id from public.assistant_profiles ap where ap.user_id = auth.uid()
$$;

create or replace function public.assistant_can_access_profile(p_profile_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  return session_user::text <> 'authenticator'
      or coalesce(auth.role(), '') = 'service_role'
      or (v_uid is not null and exists (
            select 1 from public.assistant_profiles ap where ap.id = p_profile_id and ap.user_id = v_uid))
      or (v_uid is not null and public.has_role(v_uid, 'admin'));
end
$$;

-- Le secteur à nommer sur « Pas mon secteur (…) » : le premier secteur de la pépite (dans l'ordre de
-- ses sous-secteurs) que le profil n'a pas déclaré. Null si la pépite est dans un secteur déclaré.
create or replace function public.assistant_named_sector(p_profile_id uuid, p_item_type text, p_item_id uuid)
returns uuid
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_prof     public.assistant_profiles%rowtype;
  v_subs     uuid[];
  v_declared uuid[];
  v_sector   uuid;
begin
  select * into v_prof from public.assistant_profiles ap where ap.id = p_profile_id;
  if not found then
    return null;
  end if;
  select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_declared
  from (
    select unnest(v_prof.sector_ids) as s
    union
    select ss.sector_id from public.sub_sectors ss where ss.id = any(v_prof.sub_sector_ids)
  ) t;
  v_subs := case when p_item_type = 'session'
                 then (select se.sub_sector_ids from public.session_enrichment se where se.session_id = p_item_id)
                 else (select ne.sub_sector_ids from public.novelty_enrichment ne where ne.novelty_id = p_item_id)
            end;
  select ss.sector_id into v_sector
  from unnest(coalesce(v_subs, '{}'::uuid[])) with ordinality as u(sid, ord)
  join public.sub_sectors ss on ss.id = u.sid
  where not (ss.sector_id = any(v_declared))
  order by u.ord
  limit 1;
  return v_sector;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Enregistrer un retour : « Pas mon secteur » ne vise plus que le secteur nommé sur le bouton
--    (nouveau paramètre p_sector_id). Le reste est identique au lot 4.
-- ---------------------------------------------------------------------------------------------
drop function if exists public.assistant_record_feedback(uuid, text, text, text, uuid, uuid, text);

create or replace function public.assistant_record_feedback(
  p_profile_id uuid,
  p_signal     text,
  p_reason     text default null,
  p_item_type  text default null,
  p_item_id    uuid default null,
  p_event_id   uuid default null,
  p_source     text default 'app',
  p_sector_id  uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c_threshold constant double precision := 1.5;
  v_prof     public.assistant_profiles%rowtype;
  v_event    uuid;
  v_series   uuid;
  v_piste    uuid;
  v_label    text;
  v_sectors  uuid[] := '{}'::uuid[];
  v_named    uuid;
  v_id       uuid;
  v_sum      double precision;
  v_names    text;
  v_msg      text;
  v_general  text := null;
  v_distance boolean := false;
  v_refresh  boolean := false;
begin
  select * into v_prof from public.assistant_profiles ap where ap.id = p_profile_id;
  if not found then
    raise exception 'Profil introuvable';
  end if;
  if not public.assistant_can_access_profile(p_profile_id) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if p_signal is null or p_signal not in ('agenda', 'inscription', 'rdv', 'pas_pour_moi', 'je_n_irai_pas') then
    raise exception 'Signal inconnu : %', p_signal;
  end if;

  if p_signal = 'je_n_irai_pas' then
    v_event := p_event_id;
    if v_event is null then
      raise exception 'Salon manquant';
    end if;
  else
    if p_item_type is null or p_item_type not in ('session', 'novelty') or p_item_id is null then
      raise exception 'Élément manquant';
    end if;
    select m.piste_id, m.event_id into v_piste, v_event
    from public.assistant_matches m
    where m.profile_id = p_profile_id and m.item_type = p_item_type and m.item_id = p_item_id;
    if v_event is null then
      if p_item_type = 'session' then
        select s.event_id into v_event from public.event_program_sessions s where s.id = p_item_id;
      else
        select n.event_id into v_event from public.novelties n where n.id = p_item_id;
      end if;
    end if;
    if v_event is null then
      raise exception 'Élément introuvable';
    end if;
    select p.label into v_label from public.assistant_pistes p where p.id = v_piste;

    if p_signal = 'pas_pour_moi' and p_reason = 'secteur' then
      -- Seul le secteur nommé sur le bouton est visé.
      v_named := coalesce(
        (select sc.id from public.sectors sc where sc.id = p_sector_id),
        public.assistant_named_sector(p_profile_id, p_item_type, p_item_id));
      v_sectors := case when v_named is null then '{}'::uuid[] else array[v_named] end;
    else
      select coalesce(array_agg(distinct ss.sector_id), '{}'::uuid[]) into v_sectors
      from public.sub_sectors ss
      where ss.id = any(coalesce(
        case when p_item_type = 'session'
             then (select se.sub_sector_ids from public.session_enrichment se where se.session_id = p_item_id)
             else (select ne.sub_sector_ids from public.novelty_enrichment ne where ne.novelty_id = p_item_id)
        end, '{}'::uuid[]));
    end if;
  end if;

  select e.series_id into v_series from public.events e where e.id = v_event;

  -- Un nouveau retour remplace le précédent sur le même élément (ou le même salon).
  if p_signal = 'je_n_irai_pas' then
    update public.assistant_feedback set undone_at = now()
     where profile_id = p_profile_id and signal = 'je_n_irai_pas' and event_id = v_event and undone_at is null;
  else
    update public.assistant_feedback set undone_at = now()
     where profile_id = p_profile_id and item_type = p_item_type and item_id = p_item_id and undone_at is null
       and (signal = p_signal
            or (p_signal = 'pas_pour_moi' and signal in ('agenda', 'inscription', 'rdv'))
            or (p_signal in ('agenda', 'inscription', 'rdv') and signal = 'pas_pour_moi'));
  end if;

  insert into public.assistant_feedback
    (profile_id, signal, reason, item_type, item_id, event_id, series_id,
     piste_id, piste_label, item_sector_ids, source)
  values
    (p_profile_id, p_signal, p_reason,
     case when p_signal = 'je_n_irai_pas' then null else p_item_type end,
     case when p_signal = 'je_n_irai_pas' then null else p_item_id end,
     v_event, v_series, v_piste, v_label, v_sectors, coalesce(p_source, 'app'))
  returning id into v_id;

  -- Effets immédiats (sans attendre le moteur)
  if p_signal = 'pas_pour_moi' then
    update public.assistant_matches set status = 'rejected'
     where profile_id = p_profile_id and item_type = p_item_type and item_id = p_item_id;
    perform public.assistant_recount_suggestion(p_profile_id, v_event);
  elsif p_signal in ('agenda', 'inscription', 'rdv') then
    update public.assistant_suggestions set status = 'added'
     where profile_id = p_profile_id and event_id = v_event and status in ('pending', 'notified', 'seen');
  else
    update public.assistant_suggestions set status = 'dismissed'
     where profile_id = p_profile_id and status in ('pending', 'notified', 'seen')
       and (event_id = v_event
            or (p_reason = 'pas_interesse' and v_series is not null
                and event_id in (select e.id from public.events e where e.series_id = v_series)));
  end if;

  -- Message de confirmation ; la généralisation n'est annoncée que lorsqu'elle a lieu.
  if p_signal = 'pas_pour_moi' then
    v_refresh := true;
    v_msg := 'Compris : cette pépite ne reviendra pas.';
    if p_reason = 'sujet' and v_piste is not null then
      select sum(public.assistant_feedback_weight(f.created_at)) into v_sum
      from public.assistant_feedback f
      where f.profile_id = p_profile_id and f.piste_id = v_piste and f.signal = 'pas_pour_moi'
        and f.reason = 'sujet' and f.undone_at is null;
      if v_sum >= c_threshold then
        v_general := 'piste_remplacee';
        v_msg := 'Compris : je cherche désormais sous un autre angle.';
      end if;
    elsif p_reason is null and v_piste is not null then
      select sum(public.assistant_feedback_weight(f.created_at)) into v_sum
      from public.assistant_feedback f
      where f.profile_id = p_profile_id and f.piste_id = v_piste and f.signal = 'pas_pour_moi'
        and f.reason is null and f.undone_at is null;
      if v_sum >= c_threshold then
        v_general := 'piste_affaiblie';
        v_msg := 'Compris : moins de pépites de ce type.';
      end if;
    elsif p_reason = 'secteur' and v_named is not null then
      select sum(public.assistant_feedback_weight(f.created_at)) into v_sum
      from public.assistant_feedback f
      where f.profile_id = p_profile_id and f.signal = 'pas_pour_moi' and f.reason = 'secteur'
        and f.undone_at is null and v_named = any(f.item_sector_ids);
      if v_sum >= c_threshold then
        select sc.name into v_names from public.sectors sc where sc.id = v_named;
        v_general := 'secteur_bloque';
        v_msg := format('Compris : moins de %s.', v_names);
      end if;
    elsif p_reason = 'trop_general' then
      select sum(public.assistant_feedback_weight(f.created_at)) into v_sum
      from public.assistant_feedback f
      where f.profile_id = p_profile_id and f.signal = 'pas_pour_moi' and f.reason = 'trop_general'
        and f.undone_at is null;
      if v_sum >= c_threshold then
        v_general := 'secteur_exige';
        v_msg := 'Compris : uniquement des sujets liés à votre secteur.';
      end if;
    end if;
  elsif p_signal = 'agenda' then
    v_refresh := true;
    v_msg := 'Ajouté. Je chercherai davantage dans cette direction.';
  elsif p_signal in ('inscription', 'rdv') then
    v_refresh := true;
    v_msg := 'Noté. Je chercherai davantage dans cette direction.';
  else
    -- « Je n'irai pas » : rien n'est appris sur le contenu.
    if p_reason = 'pas_interesse' then
      v_msg := 'Compris : ce salon ne vous sera plus suggéré.';
    else
      v_msg := 'Compris : je ne vous en parle plus pour cette édition.';
      if p_reason = 'trop_loin' and v_prof.radius_km is null then
        select sum(public.assistant_feedback_weight(f.created_at)) into v_sum
        from public.assistant_feedback f
        where f.profile_id = p_profile_id and f.signal = 'je_n_irai_pas' and f.reason = 'trop_loin'
          and f.undone_at is null;
        if v_sum >= c_threshold then
          v_distance := true;
          v_msg := 'Compris. Voulez-vous limiter la distance des salons que je vous propose ?';
        end if;
      end if;
    end if;
  end if;

  -- Le recalcul en tâche de fond attend qu'une session anonyme soit rattachée à un compte (coût de l'IA).
  if v_refresh and not exists (select 1 from auth.users u where u.id = v_prof.user_id and u.is_anonymous) then
    update public.assistant_profiles set refresh_requested_at = now(), refresh_attempts = 0
     where id = p_profile_id;
  end if;

  return jsonb_build_object(
    'feedback_id', v_id, 'message', v_msg, 'generalisation', v_general,
    'propose_distance', v_distance, 'refresh', v_refresh);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Créer ou mettre à jour l'assistant de l'appelant (y compris une session anonyme)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_upsert_my_profile(
  p_label               text,
  p_company_name        text,
  p_company_description text,
  p_company_ref         text,
  p_sub_sector_ids      uuid[],
  p_role_code           text,
  p_interests           text[],
  p_goals               text[],
  p_city                text default null,
  p_radius_km           integer default null,
  p_onboarded           boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_subs      uuid[];
  v_sectors   uuid[];
  v_interests text[];
  v_goals     text[];
  v_role      text;
  v_row       public.assistant_profiles%rowtype;
  v_existed   boolean;
begin
  if v_uid is null then
    raise exception 'Session requise' using errcode = '42501';
  end if;

  select coalesce(array_agg(ss.id), '{}'::uuid[]), coalesce(array_agg(distinct ss.sector_id), '{}'::uuid[])
    into v_subs, v_sectors
  from public.sub_sectors ss where ss.id = any(coalesce(p_sub_sector_ids, '{}'::uuid[]));

  select coalesce(array_agg(t.x), '{}'::text[]) into v_interests
  from (
    select left(btrim(i), 200) as x
    from unnest(coalesce(p_interests, '{}'::text[])) as i
    where btrim(i) <> ''
    limit 8
  ) t;

  select coalesce(array_agg(distinct g), '{}'::text[]) into v_goals
  from unnest(coalesce(p_goals, '{}'::text[])) as g
  where g in ('fournisseurs', 'clients', 'veille', 'formation', 'partenaires');

  select r.code into v_role from public.assistant_roles r where r.code = p_role_code;

  if cardinality(v_interests) = 0 then
    raise exception 'Au moins un centre d''intérêt est nécessaire';
  end if;

  v_existed := exists (select 1 from public.assistant_profiles ap where ap.user_id = v_uid);

  insert into public.assistant_profiles as ap
    (user_id, is_test, label, company_name, company_description, company_ref,
     sector_ids, sub_sector_ids, role_code, interests, goals, city, radius_km,
     onboarded_at, updated_at)
  values
    (v_uid, false, left(btrim(coalesce(p_label, '')), 120), left(btrim(coalesce(p_company_name, '')), 160),
     nullif(left(btrim(coalesce(p_company_description, '')), 600), ''), nullif(btrim(coalesce(p_company_ref, '')), ''),
     v_sectors, v_subs, v_role, v_interests, v_goals,
     nullif(btrim(coalesce(p_city, '')), ''), case when p_radius_km between 10 and 2000 then p_radius_km end,
     case when p_onboarded then now() end, now())
  on conflict (user_id) do update set
    label = excluded.label,
    company_name = excluded.company_name,
    company_description = excluded.company_description,
    company_ref = excluded.company_ref,
    sector_ids = excluded.sector_ids,
    sub_sector_ids = excluded.sub_sector_ids,
    role_code = excluded.role_code,
    interests = excluded.interests,
    goals = excluded.goals,
    city = excluded.city,
    radius_km = excluded.radius_km,
    onboarded_at = coalesce(ap.onboarded_at, excluded.onboarded_at),
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object('profile_id', v_row.id, 'claim_token', v_row.claim_token, 'is_new', not v_existed);
end
$$;

-- Régler seulement la distance (écran 6, ou après deux « Trop loin »)
create or replace function public.assistant_set_my_distance(p_city text, p_radius_km integer)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid uuid := public.assistant_my_profile_id();
begin
  if v_pid is null then
    raise exception 'Assistant introuvable';
  end if;
  update public.assistant_profiles
     set city = nullif(btrim(coalesce(p_city, '')), ''),
         radius_km = case when p_radius_km between 10 and 2000 then p_radius_km end,
         updated_at = now()
   where id = v_pid;
  return jsonb_build_object('ok', true);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Rattacher, après connexion, un assistant créé sous une session anonyme
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_claim_profile(p_profile_id uuid, p_claim_token uuid)
returns jsonb
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_uid  uuid := auth.uid();
  v_new  public.assistant_profiles%rowtype;
  v_old  uuid;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Compte requis' using errcode = '42501';
  end if;

  select * into v_new from public.assistant_profiles ap
  where ap.id = p_profile_id and ap.claim_token = p_claim_token;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Assistant introuvable.');
  end if;
  if v_new.user_id = v_uid then
    return jsonb_build_object('ok', true, 'profile_id', v_new.id, 'replaced', false);
  end if;
  -- Seul un assistant créé par une session anonyme peut être rattaché.
  if v_new.is_test or not exists (select 1 from auth.users u where u.id = v_new.user_id and u.is_anonymous) then
    return jsonb_build_object('ok', false, 'message', 'Cet assistant appartient déjà à un compte.');
  end if;

  select ap.id into v_old from public.assistant_profiles ap where ap.user_id = v_uid;

  if v_old is null then
    update public.assistant_profiles
       set user_id = v_uid, claim_token = gen_random_uuid(),
           refresh_requested_at = now(), refresh_attempts = 0, updated_at = now()
     where id = v_new.id;
    return jsonb_build_object('ok', true, 'profile_id', v_new.id, 'replaced', false);
  end if;

  -- Le compte a déjà un assistant : le nouveau remplace l'ancien (entreprise, rôle, intérêts, pistes),
  -- mais l'ancien garde ses retours.
  delete from public.assistant_matches where profile_id = v_old;
  delete from public.assistant_suggestions where profile_id = v_old;
  update public.assistant_pistes set active = false where profile_id = v_old;
  update public.assistant_pistes set profile_id = v_old where profile_id = v_new.id;
  update public.assistant_matches set profile_id = v_old where profile_id = v_new.id;
  update public.assistant_suggestions set profile_id = v_old where profile_id = v_new.id;
  -- Un retour récent remplace l'ancien retour actif sur le même élément (ou le même salon).
  update public.assistant_feedback o set undone_at = now()
   where o.profile_id = v_old and o.undone_at is null
     and exists (select 1 from public.assistant_feedback f
                 where f.profile_id = v_new.id and f.undone_at is null
                   and ((f.item_id is not null and f.item_type = o.item_type and f.item_id = o.item_id and f.signal = o.signal)
                        or (f.signal = 'je_n_irai_pas' and o.signal = 'je_n_irai_pas' and f.event_id = o.event_id)));
  update public.assistant_feedback set profile_id = v_old where profile_id = v_new.id;
  update public.assistant_profiles o
     set label = v_new.label, company_name = v_new.company_name,
         company_description = v_new.company_description, company_ref = v_new.company_ref,
         sector_ids = v_new.sector_ids, sub_sector_ids = v_new.sub_sector_ids,
         role_code = v_new.role_code, interests = v_new.interests, goals = v_new.goals,
         city = v_new.city, radius_km = v_new.radius_km,
         onboarded_at = coalesce(v_new.onboarded_at, o.onboarded_at),
         refresh_requested_at = now(), refresh_attempts = 0, updated_at = now()
   where o.id = v_old;
  delete from public.assistant_profiles where id = v_new.id;
  return jsonb_build_object('ok', true, 'profile_id', v_old, 'replaced', true);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Écran 1 : ce que Lotexpo sait d'une entreprise choisie dans l'autocomplétion
--    (l'autocomplétion elle-même réutilise leadmagnet_resolve_candidates)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_company_context(p_company_ref text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_ex public.exposants%rowtype;
begin
  select * into v_ex from public.exposants x
  where x.id_exposant = p_company_ref
  order by coalesce(x.is_canonical, false) desc
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'company_ref', v_ex.id_exposant,
    'name', v_ex.nom_exposant,
    'description', left(coalesce(v_ex.exposant_description, ''), 300),
    'website', v_ex.website_exposant,
    'sub_sectors', coalesce((
      select jsonb_agg(jsonb_build_object('id', ss.id, 'name', ss.name, 'sector_id', sc.id, 'sector_name', sc.name)
                       order by coalesce(x.is_primary, false) desc, x.position nulls last, ss.name)
      from public.exhibitor_sub_sectors x
      join public.sub_sectors ss on ss.id = x.sub_sector_id
      join public.sectors sc on sc.id = ss.sector_id
      where x.exhibitor_id = v_ex.id_exposant), '[]'::jsonb),
    'upcoming_events', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.nom_event, 'slug', t.slug, 'date_debut', t.date_debut) order by t.date_debut)
      from (
        select distinct e.nom_event, e.slug, e.date_debut
        from public.participation p
        join public.events e on e.id = p.id_event
        where p.id_exposant = v_ex.id_exposant
          and e.visible = true and coalesce(e.is_test, false) = false
          and e.date_fin >= current_date
        order by e.date_debut
        limit 5
      ) t), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Pistes : les modifier ou les supprimer (écran 5 et « Modifier »)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_update_my_piste(p_piste_id uuid, p_label text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid   uuid;
  v_label text := left(btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g')), 160);
begin
  select p.profile_id into v_pid from public.assistant_pistes p where p.id = p_piste_id and p.active;
  if v_pid is null or not public.assistant_can_access_profile(v_pid) then
    raise exception 'Piste introuvable' using errcode = '42501';
  end if;
  if length(v_label) < 5 then
    raise exception 'Piste trop courte';
  end if;
  update public.assistant_pistes
     set label = v_label, short_label = null, embedding = null, embedding_tuned = null, tuned_at = null
   where id = p_piste_id;
  return jsonb_build_object('ok', true, 'profile_id', v_pid);
end
$$;

create or replace function public.assistant_delete_my_piste(p_piste_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid uuid;
begin
  select p.profile_id into v_pid from public.assistant_pistes p where p.id = p_piste_id and p.active;
  if v_pid is null or not public.assistant_can_access_profile(v_pid) then
    raise exception 'Piste introuvable' using errcode = '42501';
  end if;
  if (select count(*) from public.assistant_pistes p where p.profile_id = v_pid and p.active) <= 1 then
    return jsonb_build_object('ok', false, 'message', 'Gardez au moins une piste.');
  end if;
  update public.assistant_pistes set active = false where id = p_piste_id;
  delete from public.assistant_matches where profile_id = v_pid and piste_id = p_piste_id and status <> 'retained';
  return jsonb_build_object('ok', true, 'profile_id', v_pid);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Mon Agenda : tout ce qu'il affiche, en une lecture
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_pepite_json(p_profile_id uuid, m public.assistant_matches)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'match_id', m.id,
    'item_type', m.item_type,
    'item_id', m.item_id,
    'event_id', m.event_id,
    'score', m.score,
    'reason', m.reason,
    'title', coalesce(s.title, n.title),
    'promise', coalesce(se.promise, ne.promise),
    'kept', exists (
      select 1 from public.assistant_feedback f
      where f.profile_id = p_profile_id and f.item_type = m.item_type and f.item_id = m.item_id
        and f.undone_at is null and f.signal in ('agenda', 'inscription', 'rdv')),
    'subject_label', coalesce(p.short_label, p.label),
    'sector', (
      select jsonb_build_object('id', sc.id, 'name', sc.name)
      from public.sectors sc
      where sc.id = public.assistant_named_sector(p_profile_id, m.item_type, m.item_id)),
    'session', case when m.item_type = 'session' then jsonb_build_object(
      'day_date', s.day_date, 'start_time', s.start_time, 'end_time', s.end_time,
      'location', s.location, 'registration_url', s.registration_url) end,
    'novelty', case when m.item_type = 'novelty' then jsonb_build_object(
      'slug', n.slug, 'stand_info', n.stand_info, 'exhibitor_id', n.exhibitor_id,
      'exhibitor_name', ex.name, 'image_url', n.media_urls[1]) end
  )
  from (select 1) one
  left join public.event_program_sessions s on m.item_type = 'session' and s.id = m.item_id
  left join public.session_enrichment se on m.item_type = 'session' and se.session_id = m.item_id
  left join public.novelties n on m.item_type = 'novelty' and n.id = m.item_id
  left join public.novelty_enrichment ne on m.item_type = 'novelty' and ne.novelty_id = m.item_id
  left join public.exhibitors ex on ex.id = n.exhibitor_id
  left join public.assistant_pistes p on p.id = m.piste_id
$$;

create or replace function public.assistant_my_feed(p_profile_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_pid  uuid := coalesce(p_profile_id, public.assistant_my_profile_id());
  v_prof public.assistant_profiles%rowtype;
begin
  if v_pid is null then
    return jsonb_build_object('has_profile', false);
  end if;
  if not public.assistant_can_access_profile(v_pid) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select * into v_prof from public.assistant_profiles ap where ap.id = v_pid;
  if not found then
    return jsonb_build_object('has_profile', false);
  end if;

  return jsonb_build_object(
    'has_profile', true,
    'profile', jsonb_build_object(
      'id', v_prof.id, 'label', v_prof.label, 'company_name', v_prof.company_name,
      'company_ref', v_prof.company_ref, 'sub_sector_ids', v_prof.sub_sector_ids,
      'role_code', v_prof.role_code, 'interests', v_prof.interests, 'goals', v_prof.goals,
      'city', v_prof.city, 'radius_km', v_prof.radius_km, 'onboarded_at', v_prof.onboarded_at),
    'status', jsonb_build_object(
      'refreshing', v_prof.refresh_requested_at is not null
                    and (v_prof.refreshed_at is null or v_prof.refreshed_at < v_prof.refresh_requested_at),
      'refreshed_at', v_prof.refreshed_at),
    'pistes', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'short_label', coalesce(p.short_label, p.label))
                       order by p.position, p.created_at)
      from public.assistant_pistes p where p.profile_id = v_pid and p.active), '[]'::jsonb),
    'suggestions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'event', jsonb_build_object('id', e.id, 'slug', e.slug, 'nom_event', e.nom_event,
                 'date_debut', e.date_debut, 'date_fin', e.date_fin, 'ville', e.ville,
                 'nom_lieu', e.nom_lieu, 'url_image', e.url_image),
               'status', s.status, 'pepite_count', s.pepite_count, 'best_score', s.best_score,
               'pepites', coalesce((
                 select jsonb_agg(public.assistant_pepite_json(v_pid, m) order by m.score desc nulls last)
                 from public.assistant_matches m
                 where m.profile_id = v_pid and m.event_id = s.event_id and m.status = 'retained'), '[]'::jsonb))
             order by e.date_debut)
      from public.assistant_suggestions s
      join public.events e on e.id = s.event_id
      where s.profile_id = v_pid and s.status in ('pending', 'notified', 'seen')
        and e.date_fin >= current_date), '[]'::jsonb),
    'kept_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'feedback_id', f.id, 'event_id', f.event_id, 'session_id', s.id, 'title', s.title,
               'promise', se.promise, 'day_date', s.day_date, 'start_time', s.start_time,
               'end_time', s.end_time, 'location', s.location, 'registration_url', s.registration_url)
             order by s.day_date nulls last, s.start_time nulls last)
      from public.assistant_feedback f
      join public.event_program_sessions s on s.id = f.item_id
      join public.events e on e.id = f.event_id
      left join public.session_enrichment se on se.session_id = s.id
      where f.profile_id = v_pid and f.item_type = 'session' and f.undone_at is null
        and f.signal in ('agenda', 'inscription', 'rdv')
        and e.date_fin >= current_date - 1), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 10. Ajouter à l'agenda : une action, trois écritures (compte requis)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_add_to_agenda(p_item_type text, p_item_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_pid   uuid := public.assistant_my_profile_id();
  v_event uuid;
  v_like  boolean := false;
  v_fb    jsonb;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Compte requis' using errcode = '42501';
  end if;
  if v_pid is null then
    raise exception 'Assistant introuvable';
  end if;
  if p_item_type = 'session' then
    select s.event_id into v_event from public.event_program_sessions s where s.id = p_item_id;
  elsif p_item_type = 'novelty' then
    select n.event_id into v_event from public.novelties n where n.id = p_item_id;
  end if;
  if v_event is null then
    raise exception 'Élément introuvable';
  end if;

  if not exists (select 1 from public.favorites f
                 where f.user_id = v_uid and (f.event_uuid = v_event or f.event_id = v_event)) then
    insert into public.favorites (user_id, event_id, event_uuid) values (v_uid, v_event, v_event);
  end if;

  if p_item_type = 'novelty'
     and not exists (select 1 from public.novelty_likes l where l.user_id = v_uid and l.novelty_id = p_item_id) then
    insert into public.novelty_likes (user_id, novelty_id) values (v_uid, p_item_id);
    v_like := true;
    -- même suite qu'un « like » sur le site : contrôle des paliers de visiteurs (sans attendre)
    perform net.http_post(
      url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/novelty-milestone-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1)),
      body := jsonb_build_object('novelty_id', p_item_id),
      timeout_milliseconds := 30000);
  end if;

  v_fb := public.assistant_record_feedback(v_pid, 'agenda', null, p_item_type, p_item_id, null, 'app', null);
  return v_fb || jsonb_build_object('novelty_liked', v_like, 'event_id', v_event);
end
$$;

-- Retirer une conférence (ou une Nouveauté) gardée : annule le retour positif, et le « like » d'une Nouveauté.
create or replace function public.assistant_remove_from_agenda(p_item_type text, p_item_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid := public.assistant_my_profile_id();
  r     record;
  n     integer := 0;
begin
  if v_uid is null or v_pid is null then
    raise exception 'Assistant introuvable' using errcode = '42501';
  end if;
  for r in
    select f.id from public.assistant_feedback f
    where f.profile_id = v_pid and f.item_type = p_item_type and f.item_id = p_item_id
      and f.undone_at is null and f.signal in ('agenda', 'inscription', 'rdv')
  loop
    perform public.assistant_undo_feedback(r.id);
    n := n + 1;
  end loop;
  if p_item_type = 'novelty' then
    delete from public.novelty_likes l where l.user_id = v_uid and l.novelty_id = p_item_id;
  end if;
  return jsonb_build_object('ok', true, 'removed', n, 'message', 'Retiré de votre agenda.');
end
$$;

-- Carte de salon : « Ajouter le salon à mon agenda »
create or replace function public.assistant_add_event_to_agenda(p_event_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid := public.assistant_my_profile_id();
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Compte requis' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'Salon introuvable';
  end if;
  if not exists (select 1 from public.favorites f
                 where f.user_id = v_uid and (f.event_uuid = p_event_id or f.event_id = p_event_id)) then
    insert into public.favorites (user_id, event_id, event_uuid) values (v_uid, p_event_id, p_event_id);
  end if;
  if v_pid is not null then
    update public.assistant_suggestions set status = 'added'
     where profile_id = v_pid and event_id = p_event_id and status in ('pending', 'notified', 'seen');
  end if;
  return jsonb_build_object('ok', true, 'message', 'Salon ajouté à votre agenda.');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 11. Page non connectée : un exemple réel et figé (profil test « machines agricoles »)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_public_demo()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'label', 'Ingénieur bureau d''études chez un fabricant de machines agricoles',
      'interests', ap.interests),
    'pistes', coalesce((
      select jsonb_agg(coalesce(p.short_label, p.label) order by p.position)
      from public.assistant_pistes p where p.profile_id = ap.id and p.active), '[]'::jsonb),
    'pepites', coalesce((
      select jsonb_agg(x.j order by x.score desc)
      from (
        select m.score,
               jsonb_build_object(
                 'item_type', m.item_type,
                 'title', coalesce(s.title, n.title),
                 'promise', coalesce(se.promise, ne.promise),
                 'reason', m.reason,
                 'company', ex.name,
                 'event', jsonb_build_object('nom_event', e.nom_event, 'slug', e.slug,
                                             'date_debut', e.date_debut, 'ville', e.ville)) as j
        from public.assistant_matches m
        join public.events e on e.id = m.event_id and e.date_fin >= current_date
        left join public.event_program_sessions s on m.item_type = 'session' and s.id = m.item_id
        left join public.session_enrichment se on m.item_type = 'session' and se.session_id = m.item_id
        left join public.novelties n on m.item_type = 'novelty' and n.id = m.item_id
        left join public.novelty_enrichment ne on m.item_type = 'novelty' and ne.novelty_id = m.item_id
        left join public.exhibitors ex on ex.id = n.exhibitor_id
        where m.profile_id = ap.id and m.status = 'retained' and m.reason is not null
        order by m.score desc
        limit 3
      ) x), '[]'::jsonb)
  )
  from public.assistant_profiles ap
  where ap.id = '2516e7a1-0cc0-4aa6-9d0e-75893e8739ca'
$$;

-- Recalcul hebdomadaire de l'exemple (lundi 05:12)
do $$
begin
  perform cron.unschedule('assistant-demo-weekly');
exception when others then
  null;
end
$$;

select cron.schedule(
  'assistant-demo-weekly',
  '12 5 * * 1',
  $cron$
  select net.http_post(
    url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/assistant-pepites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1)),
    body := jsonb_build_object('profile_id', '2516e7a1-0cc0-4aa6-9d0e-75893e8739ca', 'step', 'match'),
    timeout_milliseconds := 300000
  );
  $cron$
);

-- ---------------------------------------------------------------------------------------------
-- 12. Droits
-- ---------------------------------------------------------------------------------------------
revoke all on public.assistant_engine_runs from anon, authenticated;
grant all on public.assistant_engine_runs to service_role;
grant usage, select on sequence public.assistant_engine_runs_id_seq to service_role;

-- internes (serveur seulement)
revoke all on function public.assistant_engine_run_allowed(uuid, boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.assistant_named_sector(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.assistant_pepite_json(uuid, public.assistant_matches) from public, anon, authenticated;
revoke all on function public.assistant_can_access_profile(uuid) from public, anon, authenticated;
grant execute on function public.assistant_engine_run_allowed(uuid, boolean, text, uuid) to service_role;
grant execute on function public.assistant_named_sector(uuid, text, uuid) to service_role;
grant execute on function public.assistant_pepite_json(uuid, public.assistant_matches) to service_role;
grant execute on function public.assistant_can_access_profile(uuid) to service_role;

-- appelables par une personne connectée (y compris une session anonyme), qui ne voit que son assistant
revoke all on function public.assistant_my_profile_id() from public, anon;
revoke all on function public.assistant_record_feedback(uuid, text, text, text, uuid, uuid, text, uuid) from public, anon;
revoke all on function public.assistant_upsert_my_profile(text, text, text, text, uuid[], text, text[], text[], text, integer, boolean) from public, anon;
revoke all on function public.assistant_set_my_distance(text, integer) from public, anon;
revoke all on function public.assistant_claim_profile(uuid, uuid) from public, anon;
revoke all on function public.assistant_update_my_piste(uuid, text) from public, anon;
revoke all on function public.assistant_delete_my_piste(uuid) from public, anon;
revoke all on function public.assistant_my_feed(uuid) from public, anon;
revoke all on function public.assistant_add_to_agenda(text, uuid) from public, anon;
revoke all on function public.assistant_remove_from_agenda(text, uuid) from public, anon;
revoke all on function public.assistant_add_event_to_agenda(uuid) from public, anon;
grant execute on function public.assistant_my_profile_id() to authenticated, service_role;
grant execute on function public.assistant_record_feedback(uuid, text, text, text, uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function public.assistant_upsert_my_profile(text, text, text, text, uuid[], text, text[], text[], text, integer, boolean) to authenticated, service_role;
grant execute on function public.assistant_set_my_distance(text, integer) to authenticated, service_role;
grant execute on function public.assistant_claim_profile(uuid, uuid) to authenticated, service_role;
grant execute on function public.assistant_update_my_piste(uuid, text) to authenticated, service_role;
grant execute on function public.assistant_delete_my_piste(uuid) to authenticated, service_role;
grant execute on function public.assistant_my_feed(uuid) to authenticated, service_role;
grant execute on function public.assistant_add_to_agenda(text, uuid) to authenticated, service_role;
grant execute on function public.assistant_remove_from_agenda(text, uuid) to authenticated, service_role;
grant execute on function public.assistant_add_event_to_agenda(uuid) to authenticated, service_role;

-- données publiques (aucune donnée personnelle)
revoke all on function public.assistant_company_context(text) from public;
revoke all on function public.assistant_public_demo() from public;
grant execute on function public.assistant_company_context(text) to anon, authenticated, service_role;
grant execute on function public.assistant_public_demo() to anon, authenticated, service_role;

notify pgrst, 'reload schema';