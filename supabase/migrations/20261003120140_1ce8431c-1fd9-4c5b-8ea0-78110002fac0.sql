-- 20261003150000_assistant_lot2_moteur_pepites.sql
-- Assistant « Pépites », lot 2a : profils, pistes, pépites, salons suggérés, lecture des Nouveautés.
-- Aucune table existante n'est modifiée. Tout est réservé au serveur (aucune policy).

-- 1. Lecture des Nouveautés (même structure que session_enrichment) -------------
create table if not exists public.novelty_enrichment (
  novelty_id           uuid primary key references public.novelties(id) on delete cascade,
  event_id             uuid not null,
  content_hash         text not null,
  is_suggestible       boolean not null,
  unsuggestible_reason text,
  summary              text,
  theme_codes          text[] not null default '{}',
  sub_sector_ids       uuid[] not null default '{}',
  role_codes           text[] not null default '{}',
  level                text,
  problems             text[] not null default '{}',
  keywords             text[] not null default '{}',
  model                text,
  prompt_version       text not null,
  enriched_at          timestamptz not null default now(),
  constraint novelty_enrichment_reason_chk
    check (unsuggestible_reason is null or unsuggestible_reason in ('titre_vague','contenu_insuffisant')),
  constraint novelty_enrichment_reason_required_chk
    check (is_suggestible or unsuggestible_reason is not null),
  constraint novelty_enrichment_level_chk
    check (level is null or level in ('decouverte','approfondi','tous'))
);
create index if not exists novelty_enrichment_event_idx  on public.novelty_enrichment (event_id);
create index if not exists novelty_enrichment_themes_idx on public.novelty_enrichment using gin (theme_codes);
create index if not exists novelty_enrichment_subsec_idx on public.novelty_enrichment using gin (sub_sector_ids);

-- 2. Profils de l'assistant ---------------------------------------------------
create table if not exists public.assistant_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references auth.users(id) on delete cascade,
  is_test             boolean not null default false,
  label               text,
  company_name        text,
  company_description text,
  sector_ids          uuid[] not null default '{}',
  sub_sector_ids      uuid[] not null default '{}',
  role_code           text references public.assistant_roles(code),
  interests           text[] not null default '{}',
  goals               text[] not null default '{}',
  city                text,
  radius_km           integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint assistant_profiles_owner_chk check (is_test or user_id is not null),
  constraint assistant_profiles_goals_chk
    check (goals <@ array['fournisseurs','clients','veille','formation','partenaires']::text[])
);

-- 3. Pistes (ce que l'assistant cherche pour un profil) -------------------------
create table if not exists public.assistant_pistes (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.assistant_profiles(id) on delete cascade,
  position       smallint not null default 0,
  label          text not null,
  theme_codes    text[] not null default '{}',
  sector_ids     uuid[] not null default '{}',
  sub_sector_ids uuid[] not null default '{}',
  role_codes     text[] not null default '{}',
  is_generic     boolean not null default false,
  embedding      public.vector(1024),
  active         boolean not null default true,
  model          text,
  created_at     timestamptz not null default now()
);
create index if not exists assistant_pistes_profile_idx on public.assistant_pistes (profile_id);

-- 4. Pépites candidates et retenues -------------------------------------------
create table if not exists public.assistant_matches (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.assistant_profiles(id) on delete cascade,
  piste_id     uuid references public.assistant_pistes(id) on delete set null,
  item_type    text not null check (item_type in ('session','novelty')),
  item_id      uuid not null,
  event_id     uuid not null,
  similarity   real,
  sector_match boolean not null default false,
  role_match   boolean not null default false,
  theme_match  boolean not null default false,
  score        smallint check (score between 0 and 100),
  reason       text,
  status       text not null default 'candidate' check (status in ('candidate','retained','rejected')),
  model        text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (profile_id, item_type, item_id)
);
create index if not exists assistant_matches_profile_idx on public.assistant_matches (profile_id);
create index if not exists assistant_matches_event_idx   on public.assistant_matches (event_id);

-- 5. Salons suggérés (regroupement des pépites) ---------------------------------
create table if not exists public.assistant_suggestions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.assistant_profiles(id) on delete cascade,
  event_id     uuid not null references public.events(id) on delete cascade,
  match_ids    uuid[] not null default '{}',
  pepite_count smallint not null default 0,
  best_score   smallint,
  status       text not null default 'pending' check (status in ('pending','notified','seen','added','dismissed')),
  computed_at  timestamptz not null default now(),
  unique (profile_id, event_id)
);
create index if not exists assistant_suggestions_profile_idx on public.assistant_suggestions (profile_id);

-- 6. Sécurité : tout réservé au serveur ---------------------------------------
alter table public.novelty_enrichment    enable row level security;
alter table public.assistant_profiles    enable row level security;
alter table public.assistant_pistes      enable row level security;
alter table public.assistant_matches     enable row level security;
alter table public.assistant_suggestions enable row level security;
grant all on public.novelty_enrichment, public.assistant_profiles, public.assistant_pistes,
  public.assistant_matches, public.assistant_suggestions to service_role;

-- 7. Nouveautés à lire (appelée par l'edge function enrich-novelties) ---------------
create or replace function public.select_novelties_to_enrich(
  p_limit int default 60,
  p_prompt_version text default 'v1'
)
returns table (
  novelty_id uuid, event_id uuid, content_hash text, nom_event text, event_secteurs jsonb,
  exhibitor_name text, novelty_type text, title text, summary text, reason_1 text, reason_2 text,
  reason_3 text, details text, audience_tags text[], stand_info text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with base as (
    select n.id, n.event_id, e.nom_event, e.secteur, e.date_debut, x.name as exhibitor_name,
           n.type, n.title, n.summary, n.reason_1, n.reason_2, n.reason_3, n.details,
           n.audience_tags, n.stand_info
    from public.novelties n
    join public.events e on e.id = n.event_id
    left join public.exhibitors x on x.id = n.exhibitor_id
    where n.status = 'published'
      and coalesce(n.is_test, false) = false
      and e.visible = true
      and coalesce(e.is_test, false) = false
      and coalesce(e.date_fin, e.date_debut) >= current_date
  ), hashed as (
    select b.*,
           md5(concat_ws('|', b.title, coalesce(b.summary, ''), coalesce(b.reason_1, ''),
                         coalesce(b.reason_2, ''), coalesce(b.reason_3, ''), coalesce(b.details, ''),
                         coalesce(array_to_string(b.audience_tags, ','), ''), coalesce(b.type, ''),
                         coalesce(b.exhibitor_name, ''))) as h
    from base b
  )
  select h.id, h.event_id, h.h, h.nom_event, h.secteur, h.exhibitor_name, h.type, h.title, h.summary,
         h.reason_1, h.reason_2, h.reason_3, h.details, h.audience_tags, h.stand_info
  from hashed h
  left join public.novelty_enrichment ne on ne.novelty_id = h.id
  where ne.novelty_id is null
     or ne.content_hash <> h.h
     or ne.prompt_version <> p_prompt_version
  order by h.date_debut, h.id
  limit greatest(1, least(p_limit, 500));
$$;

-- 8. Présélection et croisement pour un profil -------------------------------------
-- Pour chaque piste active : les p_k conférences et les p_k Nouveautés les plus proches par le sens,
-- dans les salons dont la date de début est entre J+p_days_from et J+p_days_to.
-- passes = similarité suffisante ET croisement :
--   piste générique (thème transversal) : thème commun ET (secteur commun OU rôle commun)
--   autre piste : secteur commun OU rôle commun
-- Le secteur est comparé au niveau des 17 secteurs (parents des sous-secteurs) ; secteurs acceptés :
-- ceux du profil et ceux de la piste. Le rôle comparé est celui du profil.
create or replace function public.assistant_candidates(
  p_profile_id uuid,
  p_k int default 25,
  p_min_similarity real default 0.30,
  p_days_from int default 0,
  p_days_to int default 120
)
returns table (
  piste_id uuid, item_type text, item_id uuid, event_id uuid, similarity real,
  sector_match boolean, role_match boolean, theme_match boolean, passes boolean
)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_prof    public.assistant_profiles%rowtype;
  v_sectors uuid[];
  v_role    text[];
  v_psect   uuid[];
  r         record;
begin
  select * into v_prof from public.assistant_profiles ap where ap.id = p_profile_id;
  if not found then
    return;
  end if;

  select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_sectors
  from (
    select unnest(v_prof.sector_ids) as s
    union
    select ss.sector_id from public.sub_sectors ss where ss.id = any(v_prof.sub_sector_ids)
  ) t;

  v_role := case when v_prof.role_code is null then '{}'::text[] else array[v_prof.role_code] end;

  for r in
    select p.id, p.embedding, p.theme_codes, p.is_generic, p.sector_ids, p.sub_sector_ids
    from public.assistant_pistes p
    where p.profile_id = p_profile_id and p.active and p.embedding is not null
    order by p.position
  loop
    -- Secteurs acceptés pour cette piste : ceux du profil, plus ceux de la piste
    -- (par exemple les secteurs clients d'un fournisseur).
    select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_psect
    from (
      select unnest(v_sectors) as s
      union
      select unnest(r.sector_ids)
      union
      select ss.sector_id from public.sub_sectors ss where ss.id = any(r.sub_sector_ids)
    ) t;

    -- Calcul exact (sans index HNSW) : le volume est faible et un filtre après index
    -- renverrait moins de p_k résultats.
    return query
    with sess_pool as materialized (
      select se.session_id as iid, se.event_id as eid, e.secteur as esect,
             (1 - (x.embedding <=> r.embedding))::real as sim,
             se.sub_sector_ids as subs, se.role_codes as roles, se.theme_codes as themes
      from public.session_embeddings x
      join public.session_enrichment se on se.session_id = x.session_id and se.is_suggestible
      join public.events e on e.id = se.event_id
      where e.visible = true
        and coalesce(e.is_test, false) = false
        and e.date_debut between current_date + p_days_from and current_date + p_days_to
    ), sess as (
      select 'session'::text as it, sp.iid, sp.eid, sp.esect, sp.sim, sp.subs, sp.roles, sp.themes
      from sess_pool sp
      order by sp.sim desc
      limit p_k
    ), nov_pool as materialized (
      select ne.novelty_id as iid, n.event_id as eid, e.secteur as esect,
             (1 - (x.embedding <=> r.embedding))::real as sim,
             ne.sub_sector_ids as subs, ne.role_codes as roles, ne.theme_codes as themes
      from public.novelty_embeddings x
      join public.novelties n on n.id = x.novelty_id
        and n.status = 'published' and coalesce(n.is_test, false) = false
      join public.novelty_enrichment ne on ne.novelty_id = n.id and ne.is_suggestible
      join public.events e on e.id = n.event_id
      where e.visible = true
        and coalesce(e.is_test, false) = false
        and e.date_debut between current_date + p_days_from and current_date + p_days_to
    ), nov as (
      select 'novelty'::text as it, np.iid, np.eid, np.esect, np.sim, np.subs, np.roles, np.themes
      from nov_pool np
      order by np.sim desc
      limit p_k
    ), cand as (
      select * from sess
      union all
      select * from nov
    ), flags as (
      select c.*,
             case
               when cardinality(c.subs) > 0 then
                 exists (select 1 from public.sub_sectors ss
                         where ss.id = any(c.subs) and ss.sector_id = any(v_psect))
               else
                 -- repli : secteurs du salon quand l'élément n'a aucun sous-secteur
                 exists (select 1 from public.sectors sc
                         where sc.id = any(v_psect)
                           and jsonb_typeof(c.esect) = 'array'
                           and c.esect ? sc.name)
             end as f_sector,
             (c.roles && v_role) as f_role,
             (c.themes && r.theme_codes) as f_theme
      from cand c
    )
    select r.id, f.it, f.iid, f.eid, f.sim, f.f_sector, f.f_role, f.f_theme,
           (f.sim >= p_min_similarity) and
           case when r.is_generic
                then f.f_theme and (f.f_sector or f.f_role)
                else (f.f_sector or f.f_role)
           end
    from flags f;
  end loop;
end
$function$;

-- 8 bis. Vecteurs des pistes (Cohere, type « requête », même modèle que le reste du site) ----
create or replace function public.embed_assistant_pistes(p_profile_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_texts jsonb; v_ids uuid[]; v_status int; v_content text; v_emb jsonb; i int;
  v_total int := 0; n_batches int := 0;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');

  loop
    exit when n_batches >= 5;

    select array_agg(q.id order by q.id), jsonb_agg(q.txt order by q.id)
    into v_ids, v_texts
    from (
      select p.id,
        trim(
          p.label || '. ' ||
          coalesce((select string_agg(t.label, ', ') from public.assistant_themes t
                    where t.code = any(p.theme_codes)), '') || ' ' ||
          coalesce((select string_agg(ss.name, ', ') from public.sub_sectors ss
                    where ss.id = any(p.sub_sector_ids)), '')
        ) as txt
      from public.assistant_pistes p
      where p.embedding is null
        and p.active
        and (p_profile_id is null or p.profile_id = p_profile_id)
      order by p.id
      limit 96
    ) q;

    exit when v_ids is null;

    select r.status, r.content into v_status, v_content
    from extensions.http((
      'POST', 'https://api.cohere.com/v2/embed',
      array[extensions.http_header('Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'COHERE_KEY'))],
      'application/json',
      jsonb_build_object(
        'model', 'embed-v4.0',
        'input_type', 'search_query',
        'embedding_types', jsonb_build_array('float'),
        'output_dimension', 1024,
        'texts', v_texts
      )::text
    )::extensions.http_request) r;

    if v_status <> 200 then
      raise warning 'embed_assistant_pistes: Cohere status % : %', v_status, left(v_content, 200);
      exit;
    end if;

    v_emb := v_content::jsonb -> 'embeddings' -> 'float';

    for i in 1 .. array_length(v_ids, 1) loop
      update public.assistant_pistes
         set embedding = ((v_emb -> (i - 1))::text)::public.vector
       where id = v_ids[i];
    end loop;

    v_total := v_total + array_length(v_ids, 1);
    n_batches := n_batches + 1;
  end loop;

  return v_total;
end
$function$;

revoke all on function public.embed_assistant_pistes(uuid) from public, anon, authenticated;
grant execute on function public.embed_assistant_pistes(uuid) to service_role;

revoke all on function public.select_novelties_to_enrich(int, text) from public, anon, authenticated;
grant execute on function public.select_novelties_to_enrich(int, text) to service_role;
revoke all on function public.assistant_candidates(uuid, int, real, int, int) from public, anon, authenticated;
grant execute on function public.assistant_candidates(uuid, int, real, int, int) to service_role;

notify pgrst, 'reload schema';

-- 9. Tâche planifiée : lecture des Nouveautés toutes les heures (à la minute 25) -------
-- Une heure sans Nouveauté nouvelle ou modifiée ne coûte rien : la RPC ne renvoie rien.
select cron.unschedule('enrich-novelties-hourly')
where exists (select 1 from cron.job where jobname = 'enrich-novelties-hourly');

select cron.schedule(
  'enrich-novelties-hourly',
  '25 * * * *',
  $cron$
  select net.http_post(
    url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/enrich-novelties',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1
      )
    ),
    body := jsonb_build_object(),
    timeout_milliseconds := 300000
  );
  $cron$
);