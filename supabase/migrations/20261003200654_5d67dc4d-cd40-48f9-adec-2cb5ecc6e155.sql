-- Assistant salons, lot 3d (serveur) : la distance se règle par régions choisies (décision de Thomas du 03/10).
-- 1. La région d'un salon se déduit de son code postal (assistant_region_of), sans service externe.
-- 2. Chaque assistant porte la liste des régions acceptées (region_codes ; vide = partout en France).
-- 3. La recherche (assistant_candidates) et « À découvrir » (assistant_my_feed) ignorent les salons hors de
--    ces régions. Un salon dont la région est inconnue reste proposé.
-- 4. Après deux « Trop loin », la question devient « Voulez-vous choisir les régions… ».
-- 5. L'accord pour les alertes par email (écran 7) est enregistré sur l'assistant.
-- Les fonctions existantes sont modifiées par remplacement de texte vérifié : si un texte attendu manque,
-- la migration s'arrête et rien n'est appliqué.

-- ---------------------------------------------------------------------------------------------
-- 1. Régions
-- ---------------------------------------------------------------------------------------------
alter table public.assistant_profiles
  add column if not exists region_codes text[] not null default '{}'::text[];

create or replace function public.assistant_region_of(p_code_postal text)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_code_postal is null or btrim(p_code_postal) !~ '^\d{5}$' then null
    when left(btrim(p_code_postal), 3) in ('971', '972', '973', '974', '976') then 'OM'
    when left(btrim(p_code_postal), 2) in ('97', '98', '00') then null
    when left(btrim(p_code_postal), 2) = any('{01,03,07,15,26,38,42,43,63,69,73,74}'::text[]) then 'ARA'
    when left(btrim(p_code_postal), 2) = any('{21,25,39,58,70,71,89,90}'::text[]) then 'BFC'
    when left(btrim(p_code_postal), 2) = any('{22,29,35,56}'::text[]) then 'BRE'
    when left(btrim(p_code_postal), 2) = any('{18,28,36,37,41,45}'::text[]) then 'CVL'
    when left(btrim(p_code_postal), 2) = '20' then 'COR'
    when left(btrim(p_code_postal), 2) = any('{08,10,51,52,54,55,57,67,68,88}'::text[]) then 'GES'
    when left(btrim(p_code_postal), 2) = any('{02,59,60,62,80}'::text[]) then 'HDF'
    when left(btrim(p_code_postal), 2) = any('{75,77,78,91,92,93,94,95}'::text[]) then 'IDF'
    when left(btrim(p_code_postal), 2) = any('{14,27,50,61,76}'::text[]) then 'NOR'
    when left(btrim(p_code_postal), 2) = any('{16,17,19,23,24,33,40,47,64,79,86,87}'::text[]) then 'NAQ'
    when left(btrim(p_code_postal), 2) = any('{09,11,12,30,31,32,34,46,48,65,66,81,82}'::text[]) then 'OCC'
    when left(btrim(p_code_postal), 2) = any('{44,49,53,72,85}'::text[]) then 'PDL'
    when left(btrim(p_code_postal), 2) = any('{04,05,06,13,83,84}'::text[]) then 'PAC'
  end
$$;

-- Liste affichée à l'écran « Où êtes-vous prêt à aller ? », avec le nombre de salons à venir par région.
create or replace function public.assistant_regions_list()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  with r(code, name, pos) as (
    values ('ARA', 'Auvergne-Rhône-Alpes', 1), ('BFC', 'Bourgogne-Franche-Comté', 2), ('BRE', 'Bretagne', 3),
           ('CVL', 'Centre-Val de Loire', 4), ('COR', 'Corse', 5), ('GES', 'Grand Est', 6),
           ('HDF', 'Hauts-de-France', 7), ('IDF', 'Île-de-France', 8), ('NOR', 'Normandie', 9),
           ('NAQ', 'Nouvelle-Aquitaine', 10), ('OCC', 'Occitanie', 11), ('PDL', 'Pays de la Loire', 12),
           ('PAC', 'Provence-Alpes-Côte d''Azur', 13), ('OM', 'Outre-mer', 14)
  ), c as (
    select public.assistant_region_of(e.code_postal) as code, count(*) as n
    from public.events e
    where e.visible = true and coalesce(e.is_test, false) = false
      and e.date_fin >= current_date and e.date_debut <= current_date + 365
    group by 1
  )
  select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name, 'upcoming_events', coalesce(c.n, 0))
                   order by r.pos)
  from r left join c on c.code = r.code
$$;

-- Régler les régions de son assistant (écran 5 de l'onboarding, ou plus tard depuis Mon Agenda)
create or replace function public.assistant_set_my_regions(p_region_codes text[])
returns jsonb
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_pid   uuid := public.assistant_my_profile_id();
  v_codes text[];
  v_old   text[];
  v_done  timestamptz;
  v_anon  boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_redo  boolean;
begin
  if v_pid is null then
    raise exception 'Assistant introuvable';
  end if;
  select coalesce(array_agg(distinct c order by c), '{}'::text[]) into v_codes
  from unnest(coalesce(p_region_codes, '{}'::text[])) as c
  where c = any('{ARA,BFC,BRE,CVL,COR,GES,HDF,IDF,NOR,NAQ,OCC,PDL,PAC,OM}'::text[]);

  select ap.region_codes, ap.onboarded_at into v_old, v_done
  from public.assistant_profiles ap where ap.id = v_pid;
  -- Un compte déjà en place relance sa recherche ; une session anonyme attend d'être rattachée (coût de l'IA).
  v_redo := not v_anon and v_done is not null and v_codes is distinct from v_old;

  update public.assistant_profiles
     set region_codes = v_codes,
         updated_at = now(),
         refresh_requested_at = case when v_redo then now() else refresh_requested_at end,
         refresh_attempts = case when v_redo then 0 else refresh_attempts end
   where id = v_pid;
  return jsonb_build_object('ok', true, 'region_codes', v_codes, 'refresh', v_redo);
end
$$;

-- Accord pour recevoir par email les alertes de l'assistant (case de l'écran « Pour que je puisse vous
-- prévenir »). Il suit l'assistant lors du rattachement à un compte.
alter table public.assistant_profiles
  add column if not exists email_alerts_opt_in boolean not null default false,
  add column if not exists email_alerts_opt_in_at timestamptz;

create or replace function public.assistant_set_email_alerts(p_opt_in boolean)
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
     set email_alerts_opt_in = coalesce(p_opt_in, false),
         email_alerts_opt_in_at = case when coalesce(p_opt_in, false) then now() end,
         updated_at = now()
   where id = v_pid;
  return jsonb_build_object('ok', true, 'email_alerts_opt_in', coalesce(p_opt_in, false));
end
$$;

revoke all on function public.assistant_set_email_alerts(boolean) from public, anon;
grant execute on function public.assistant_set_email_alerts(boolean) to authenticated, service_role;

revoke all on function public.assistant_region_of(text) from public;
revoke all on function public.assistant_regions_list() from public;
revoke all on function public.assistant_set_my_regions(text[]) from public, anon;
grant execute on function public.assistant_region_of(text) to anon, authenticated, service_role;
grant execute on function public.assistant_regions_list() to anon, authenticated, service_role;
grant execute on function public.assistant_set_my_regions(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Les fonctions existantes tiennent compte des régions (remplacements vérifiés)
-- ---------------------------------------------------------------------------------------------
create or replace function pg_temp.lotexpo_patch(p_fn regprocedure, p_old text, p_new text)
returns void
language plpgsql
as $$
declare
  v_def text := pg_get_functiondef(p_fn);
begin
  if position(p_old in v_def) = 0 then
    raise exception 'Lot 3d : texte attendu introuvable dans % : %', p_fn, left(p_old, 80);
  end if;
  execute replace(v_def, p_old, p_new);
end
$$;

-- 2a. Recherche : les salons hors des régions choisies ne sont plus candidats (conférences et Nouveautés)
select pg_temp.lotexpo_patch('public.assistant_candidates(uuid,integer,real,integer,integer)'::regprocedure,
  '  v_req_sector  boolean;',
  E'  v_req_sector  boolean;\n  v_regions     text[];');
select pg_temp.lotexpo_patch('public.assistant_candidates(uuid,integer,real,integer,integer)'::regprocedure,
  'v_req_sector := coalesce((v_adj->>''require_sector'')::boolean, false);',
  E'v_req_sector := coalesce((v_adj->>''require_sector'')::boolean, false);\n  v_regions := coalesce(v_prof.region_codes, ''{}''::text[]);');
select pg_temp.lotexpo_patch('public.assistant_candidates(uuid,integer,real,integer,integer)'::regprocedure,
  'and not (e.id = any(v_excl_events))',
  E'and not (e.id = any(v_excl_events))\n        and (cardinality(v_regions) = 0 or public.assistant_region_of(e.code_postal) is null\n             or public.assistant_region_of(e.code_postal) = any(v_regions))');

-- 2b. « À découvrir » : mêmes régions, effet immédiat (sans attendre la recherche suivante) ;
--     le profil renvoie ses régions.
select pg_temp.lotexpo_patch('public.assistant_my_feed(uuid)'::regprocedure,
  '''city'', v_prof.city, ''radius_km'', v_prof.radius_km,',
  '''city'', v_prof.city, ''radius_km'', v_prof.radius_km, ''region_codes'', coalesce(v_prof.region_codes, ''{}''::text[]), ''email_alerts_opt_in'', v_prof.email_alerts_opt_in,');
select pg_temp.lotexpo_patch('public.assistant_my_feed(uuid)'::regprocedure,
  'where s.profile_id = v_pid and s.status in (''pending'', ''notified'', ''seen'')',
  E'where s.profile_id = v_pid and s.status in (''pending'', ''notified'', ''seen'')\n        and (cardinality(coalesce(v_prof.region_codes, ''{}''::text[])) = 0\n             or public.assistant_region_of(e.code_postal) is null\n             or public.assistant_region_of(e.code_postal) = any(v_prof.region_codes))');

-- 2c. Deux « Trop loin » sans régions choisies : proposer de les choisir
select pg_temp.lotexpo_patch(
  'public.assistant_record_feedback(uuid,text,text,text,uuid,uuid,text,uuid)'::regprocedure,
  'p_reason = ''trop_loin'' and v_prof.radius_km is null',
  'p_reason = ''trop_loin'' and cardinality(coalesce(v_prof.region_codes, ''{}''::text[])) = 0');
select pg_temp.lotexpo_patch(
  'public.assistant_record_feedback(uuid,text,text,text,uuid,uuid,text,uuid)'::regprocedure,
  'Compris. Voulez-vous limiter la distance des salons que je vous propose ?',
  'Compris. Voulez-vous choisir les régions où je cherche pour vous ?');
select pg_temp.lotexpo_patch('public.assistant_profile_adjustments(uuid)'::regprocedure,
  '(v_prof.radius_km is null)',
  '(cardinality(coalesce(v_prof.region_codes, ''{}''::text[])) = 0)');

-- 2d. Rattachement à un compte qui avait déjà un assistant : les régions suivent
select pg_temp.lotexpo_patch('public.assistant_claim_profile(uuid,uuid)'::regprocedure,
  'city = v_new.city, radius_km = v_new.radius_km,',
  E'city = v_new.city, radius_km = v_new.radius_km, region_codes = v_new.region_codes,\n         email_alerts_opt_in = v_new.email_alerts_opt_in, email_alerts_opt_in_at = v_new.email_alerts_opt_in_at,');

-- ---------------------------------------------------------------------------------------------
-- 3. Contrôles : au moindre écart, tout est annulé
-- ---------------------------------------------------------------------------------------------
do $$
declare
  v_n int;
begin
  if public.assistant_region_of('63000') is distinct from 'ARA'
     or public.assistant_region_of('75008') is distinct from 'IDF'
     or public.assistant_region_of('20000') is distinct from 'COR'
     or public.assistant_region_of('97400') is distinct from 'OM'
     or public.assistant_region_of('33300') is distinct from 'NAQ'
     or public.assistant_region_of('98000') is not null
     or public.assistant_region_of('abc') is not null then
    raise exception 'Contrôle : assistant_region_of renvoie une valeur inattendue';
  end if;

  select jsonb_array_length(public.assistant_regions_list()) into v_n;
  if v_n <> 14 then
    raise exception 'Contrôle : 14 régions attendues, % trouvées', v_n;
  end if;

  -- Tous les départements de métropole ont une région (01 à 95, sauf 20 traité à part)
  select count(*) into v_n
  from generate_series(1, 95) d
  where public.assistant_region_of(lpad(d::text, 2, '0') || '000') is null;
  if v_n <> 0 then
    raise exception 'Contrôle : % départements sans région', v_n;
  end if;

  -- Salons à venir sans région connue (attendu : 2 au plus, codes postaux absents ou étrangers)
  select count(*) into v_n
  from public.events e
  where e.visible = true and coalesce(e.is_test, false) = false and e.date_fin >= current_date
    and public.assistant_region_of(e.code_postal) is null;
  raise notice 'Salons à venir sans région connue : %', v_n;

  if position('v_regions' in pg_get_functiondef('public.assistant_candidates(uuid,integer,real,integer,integer)'::regprocedure)) = 0
     or position('region_codes' in pg_get_functiondef('public.assistant_my_feed(uuid)'::regprocedure)) = 0
     or position('region_codes' in pg_get_functiondef('public.assistant_claim_profile(uuid,uuid)'::regprocedure)) = 0
     or position('choisir les régions' in pg_get_functiondef('public.assistant_record_feedback(uuid,text,text,text,uuid,uuid,text,uuid)'::regprocedure)) = 0 then
    raise exception 'Contrôle : une fonction n''a pas été modifiée';
  end if;
end
$$;

notify pgrst, 'reload schema';