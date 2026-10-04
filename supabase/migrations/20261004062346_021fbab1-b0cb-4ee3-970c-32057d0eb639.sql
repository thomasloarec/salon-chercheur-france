-- Assistant salons, lot 3d ter (serveur) : demandes de Thomas du 03/10 sur le parcours /agenda/creer.
-- 1. Plusieurs rôles possibles (role_codes) et un rôle saisi à la main (« Autre », role_other).
--    role_code reste rempli avec le premier rôle choisi, pour tout ce qui le lit déjà.
-- 2. Les rôles saisis à la main sont journalisés (assistant_role_other_entries) : l'admin les voit dans
--    /admin/assistant-apercu et reçoit un email dès qu'il y en a assez de nouveaux (edge function
--    assistant-roles-digest, chaque matin).
-- 3. Jusqu'à 12 centres d'intérêt (au lieu de 8), puisque l'écran 3 peut maintenant en proposer d'autres.
-- 4. La recherche tient compte de tous les rôles choisis.
-- Les fonctions existantes sont modifiées par remplacement de texte vérifié : si un texte attendu manque,
-- la migration s'arrête et rien n'est appliqué.

-- ---------------------------------------------------------------------------------------------
-- 1. Colonnes et journal
-- ---------------------------------------------------------------------------------------------
alter table public.assistant_profiles
  add column if not exists role_codes text[] not null default '{}'::text[],
  add column if not exists role_other text;

update public.assistant_profiles
   set role_codes = array[role_code]
 where role_code is not null and cardinality(role_codes) = 0;

-- Une ligne par assistant (la dernière saisie) ; notified_at = déjà signalé à l'admin.
create table if not exists public.assistant_role_other_entries (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null unique references public.assistant_profiles(id) on delete cascade,
  label       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.assistant_role_other_entries enable row level security;
revoke all on table public.assistant_role_other_entries from anon, authenticated;
grant all on table public.assistant_role_other_entries to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Régler ses rôles (écran 2 du parcours)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_set_my_roles(p_role_codes text[], p_role_other text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_pid   uuid := public.assistant_my_profile_id();
  v_codes text[];
  v_other text := nullif(left(regexp_replace(btrim(coalesce(p_role_other, '')), '\s+', ' ', 'g'), 80), '');
begin
  if v_pid is null then
    raise exception 'Assistant introuvable';
  end if;

  -- Rôles connus, dans l'ordre choisi, sans doublon, 4 au plus
  select coalesce(array_agg(t.c order by t.o), '{}'::text[]) into v_codes
  from (
    select x.c, min(x.o) as o
    from unnest(coalesce(p_role_codes, '{}'::text[])) with ordinality as x(c, o)
    where exists (select 1 from public.assistant_roles r where r.code = x.c)
    group by x.c
    order by min(x.o)
    limit 4
  ) t;

  if cardinality(v_codes) = 0 and v_other is null then
    raise exception 'Au moins un rôle est nécessaire';
  end if;

  update public.assistant_profiles
     set role_codes = v_codes,
         role_code = v_codes[1],
         role_other = v_other,
         updated_at = now()
   where id = v_pid;

  if v_other is null then
    delete from public.assistant_role_other_entries where profile_id = v_pid;
  else
    insert into public.assistant_role_other_entries as e (profile_id, label)
    values (v_pid, v_other)
    on conflict (profile_id) do update
      set label = excluded.label,
          updated_at = now(),
          -- une saisie modifiée redevient « nouvelle » pour l'admin
          notified_at = case when e.label is distinct from excluded.label then null else e.notified_at end;
  end if;

  return jsonb_build_object('ok', true, 'role_codes', v_codes, 'role_other', v_other);
end
$$;

-- Liste pour l'admin (/admin/assistant-apercu) : rôles saisis à la main, regroupés, avec leur nombre.
create or replace function public.assistant_admin_role_others()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'label', g.label, 'count', g.n, 'last_at', g.last_at, 'new_count', g.n_new)
           order by g.n desc, g.last_at desc)
    from (
      select min(e.label) as label, count(*) as n, max(e.updated_at) as last_at,
             count(*) filter (where e.notified_at is null) as n_new
      from public.assistant_role_other_entries e
      join public.assistant_profiles ap on ap.id = e.profile_id and not ap.is_test
      group by lower(e.label)
    ) g), '[]'::jsonb);
end
$$;

revoke all on function public.assistant_set_my_roles(text[], text) from public, anon;
grant execute on function public.assistant_set_my_roles(text[], text) to authenticated, service_role;
revoke all on function public.assistant_admin_role_others() from public, anon;
grant execute on function public.assistant_admin_role_others() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Fonctions existantes (remplacements vérifiés)
-- ---------------------------------------------------------------------------------------------
create or replace function pg_temp.lotexpo_patch(p_fn regprocedure, p_old text, p_new text)
returns void
language plpgsql
as $$
declare
  v_def text := pg_get_functiondef(p_fn);
begin
  if position(p_old in v_def) = 0 then
    raise exception 'Lot 3d ter : texte attendu introuvable dans % : %', p_fn, left(p_old, 80);
  end if;
  execute replace(v_def, p_old, p_new);
end
$$;

-- 3a. 12 centres d'intérêt au plus
select pg_temp.lotexpo_patch(
  'public.assistant_upsert_my_profile(text,text,text,text,uuid[],text,text[],text[],text,integer,boolean)'::regprocedure,
  'limit 8',
  'limit 12');

-- 3b. La recherche croise tous les rôles choisis
select pg_temp.lotexpo_patch('public.assistant_candidates(uuid,integer,real,integer,integer)'::regprocedure,
  'v_role := case when v_prof.role_code is null then ''{}''::text[] else array[v_prof.role_code] end;',
  'v_role := case when cardinality(coalesce(v_prof.role_codes, ''{}''::text[])) > 0 then v_prof.role_codes when v_prof.role_code is null then ''{}''::text[] else array[v_prof.role_code] end;');

-- 3c. Le fil renvoie les rôles
select pg_temp.lotexpo_patch('public.assistant_my_feed(uuid)'::regprocedure,
  '''role_code'', v_prof.role_code,',
  '''role_code'', v_prof.role_code, ''role_codes'', coalesce(v_prof.role_codes, ''{}''::text[]), ''role_other'', v_prof.role_other,');

-- 3d. Rattachement à un compte qui avait déjà un assistant : les rôles et la saisie « Autre » suivent
select pg_temp.lotexpo_patch('public.assistant_claim_profile(uuid,uuid)'::regprocedure,
  'region_codes = v_new.region_codes,',
  'region_codes = v_new.region_codes, role_codes = v_new.role_codes, role_other = v_new.role_other,');
select pg_temp.lotexpo_patch('public.assistant_claim_profile(uuid,uuid)'::regprocedure,
  'delete from public.assistant_profiles where id = v_new.id;',
  E'if exists (select 1 from public.assistant_role_other_entries where profile_id = v_new.id) then\n    delete from public.assistant_role_other_entries where profile_id = v_old;\n    update public.assistant_role_other_entries set profile_id = v_old where profile_id = v_new.id;\n  end if;\n  delete from public.assistant_profiles where id = v_new.id;');

-- ---------------------------------------------------------------------------------------------
-- 4. Email à l'admin : chaque matin à 7 h 47 (heure de Paris en été), si assez de nouvelles saisies
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'assistant-roles-digest') then
    perform cron.unschedule('assistant-roles-digest');
  end if;
  perform cron.schedule('assistant-roles-digest', '47 5 * * *', $job$
    select net.http_post(
      url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/assistant-roles-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1)),
      body := jsonb_build_object(),
      timeout_milliseconds := 60000);
  $job$);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Contrôles
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if position('limit 12' in pg_get_functiondef('public.assistant_upsert_my_profile(text,text,text,text,uuid[],text,text[],text[],text,integer,boolean)'::regprocedure)) = 0
     or position('v_prof.role_codes' in pg_get_functiondef('public.assistant_candidates(uuid,integer,real,integer,integer)'::regprocedure)) = 0
     or position('role_other' in pg_get_functiondef('public.assistant_my_feed(uuid)'::regprocedure)) = 0
     or position('assistant_role_other_entries' in pg_get_functiondef('public.assistant_claim_profile(uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'Contrôle : une fonction n''a pas été modifiée';
  end if;
  if exists (select 1 from public.assistant_profiles where role_code is not null and cardinality(role_codes) = 0) then
    raise exception 'Contrôle : des assistants n''ont pas reçu leur rôle dans role_codes';
  end if;
end
$$;

notify pgrst, 'reload schema';