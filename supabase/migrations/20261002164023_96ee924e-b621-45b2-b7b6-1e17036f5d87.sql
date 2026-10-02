-- 20261002170000_assistant_lot1_lecture_programmes.sql
-- Assistant « Pépites », lot 1 : lecture des programmes.
-- Crée les référentiels (thèmes transversaux, rôles), la table d'enrichissement des sessions,
-- la table de vecteurs des sessions, la RPC de sélection pour l'Edge Function
-- enrich-program-sessions et la fonction d'embedding nocturne (même modèle que
-- embed_pending_novelties). Les crons sont dans un fichier séparé, à appliquer
-- seulement après déploiement et vérification de l'Edge Function.
-- Aucune table existante n'est modifiée.

-- 1. Référentiel des thèmes transversaux ------------------------------------
create table if not exists public.assistant_themes (
  code        text primary key,
  label       text not null,
  description text not null,
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.assistant_themes (code, label, description, position) values
  ('ia_data',              'IA et données',                         'Intelligence artificielle, IA générative, exploitation des données, algorithmes, jumeaux numériques', 1),
  ('cybersecurite',        'Cybersécurité',                         'Protection des systèmes et des données, menaces, conformité cyber', 2),
  ('numerique',            'Transformation numérique',              'Digitalisation des processus, logiciels métier, objets connectés, outils collaboratifs', 3),
  ('automatisation',       'Automatisation et robotique',           'Robots, cobots, automatisation des tâches, des lignes et des équipements', 4),
  ('decarbonation',        'Décarbonation et énergie',              'Réduction des émissions, efficacité énergétique, énergies renouvelables, bilan carbone', 5),
  ('economie_circulaire',  'Économie circulaire et ressources',     'Recyclage, réemploi, sobriété matière, gestion de l''eau et des déchets', 6),
  ('rse',                  'RSE et impact',                         'Responsabilité sociétale, achats responsables, reporting extra-financier, impact social', 7),
  ('reglementation',       'Réglementation et normes',              'Nouvelles obligations légales, normes, certifications, conformité', 8),
  ('financement',          'Financement et aides',                  'Subventions, aides publiques, investissement, levée de fonds', 9),
  ('international',        'Export et international',               'Marchés étrangers, développement à l''export, partenariats internationaux', 10),
  ('innovation_rd',        'Innovation et R&D',                     'Recherche, prototypes, transfert de technologie, propriété intellectuelle', 11),
  ('competences',          'Recrutement et compétences',            'Attractivité, formation, pénurie de main-d''œuvre, management des équipes', 12),
  ('supply_chain',         'Supply chain et achats',                'Approvisionnement, logistique, relocalisation, gestion des fournisseurs', 13),
  ('qualite_securite',     'Qualité, sécurité et santé au travail', 'Qualité produit, sécurité des personnes, prévention des risques', 14),
  ('commercial_marketing', 'Vente, marketing et relation client',   'Prospection, distribution, marque, expérience client', 15),
  ('strategie',            'Stratégie et prospective',              'Tendances de marché, modèles économiques, croissance, transmission', 16)
on conflict (code) do update
  set label = excluded.label, description = excluded.description, position = excluded.position;

-- 2. Référentiel des rôles ---------------------------------------------------
create table if not exists public.assistant_roles (
  code        text primary key,
  label       text not null,
  description text not null,
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.assistant_roles (code, label, description, position) values
  ('direction',               'Direction',                         'Dirigeants, direction générale, direction de site ou de business unit', 1),
  ('rd_conception',           'R&D et bureau d''études',           'Recherche et développement, conception produit, ingénierie', 2),
  ('production',              'Production et méthodes',            'Production, industrialisation, méthodes, exploitation d''usine', 3),
  ('maintenance_travaux',     'Maintenance et travaux',            'Maintenance, travaux, services techniques, installation', 4),
  ('qualite_hse',             'Qualité, sécurité, environnement',  'Qualité, HSE, prévention, conformité', 5),
  ('achats_logistique',       'Achats et logistique',              'Achats, approvisionnement, supply chain, logistique', 6),
  ('commercial',              'Commercial et export',              'Vente, développement commercial, grands comptes, export', 7),
  ('marketing_communication', 'Marketing et communication',        'Marketing, communication, produit, événementiel', 8),
  ('rh_formation',            'RH et formation',                   'Ressources humaines, recrutement, formation', 9),
  ('it_data',                 'Informatique et data',              'Systèmes d''information, data, cybersécurité', 10),
  ('finance_juridique',       'Finance et juridique',              'Finance, juridique, administration, contrôle de gestion', 11),
  ('terrain',                 'Professionnel de terrain',          'Exploitant agricole, praticien de santé, artisan, installateur, commerçant', 12),
  ('secteur_public',          'Collectivités et secteur public',   'Élus, agents publics, développeurs économiques', 13),
  ('recherche_enseignement',  'Recherche et enseignement',         'Chercheurs, enseignants, laboratoires, écoles', 14)
on conflict (code) do update
  set label = excluded.label, description = excluded.description, position = excluded.position;

-- 3. Enrichissement des sessions ---------------------------------------------
create table if not exists public.session_enrichment (
  session_id           uuid primary key references public.event_program_sessions(id) on delete cascade,
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
  constraint session_enrichment_reason_chk
    check (unsuggestible_reason is null
           or unsuggestible_reason in ('type_non_contenu','logistique','protocolaire','titre_vague','contenu_insuffisant')),
  constraint session_enrichment_reason_required_chk
    check (is_suggestible or unsuggestible_reason is not null),
  constraint session_enrichment_level_chk
    check (level is null or level in ('decouverte','approfondi','tous'))
);

create index if not exists session_enrichment_event_idx   on public.session_enrichment (event_id);
create index if not exists session_enrichment_themes_idx  on public.session_enrichment using gin (theme_codes);
create index if not exists session_enrichment_subsec_idx  on public.session_enrichment using gin (sub_sector_ids);
create index if not exists session_enrichment_roles_idx   on public.session_enrichment using gin (role_codes);

-- 4. Vecteurs des sessions ---------------------------------------------------
create table if not exists public.session_embeddings (
  session_id  uuid primary key references public.event_program_sessions(id) on delete cascade,
  embedding   public.vector(1024) not null,
  embedded_at timestamptz not null default now()
);

create index if not exists idx_session_embeddings_hnsw
  on public.session_embeddings using hnsw (embedding vector_cosine_ops);

grant select on public.assistant_themes, public.assistant_roles to anon, authenticated;
grant all on public.assistant_themes, public.assistant_roles,
  public.session_enrichment, public.session_embeddings to service_role;

-- 5. Sécurité : lecture publique des référentiels, le reste réservé au service --
alter table public.assistant_themes    enable row level security;
alter table public.assistant_roles     enable row level security;
alter table public.session_enrichment  enable row level security;
alter table public.session_embeddings  enable row level security;

drop policy if exists assistant_themes_read on public.assistant_themes;
create policy assistant_themes_read on public.assistant_themes for select to anon, authenticated using (true);
drop policy if exists assistant_roles_read on public.assistant_roles;
create policy assistant_roles_read on public.assistant_roles for select to anon, authenticated using (true);
-- session_enrichment et session_embeddings : aucune policy (service_role uniquement).
-- Le lot 2 exposera les résultats via des RPC dédiées.

-- 6. Sélection des sessions à enrichir (appelée par l'Edge Function) --------
create or replace function public.select_sessions_to_enrich(
  p_limit int default 80,
  p_prompt_version text default 'v1'
)
returns table (
  session_id uuid, event_id uuid, content_hash text, nom_event text, event_secteurs jsonb,
  session_type text, title text, description text, track text, speakers jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with base as (
    select s.id, s.event_id, s.session_type, s.title, s.description, s.track,
           e.nom_event, e.secteur, e.date_debut,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'nom', sp.full_name, 'fonction', sp.job_title, 'organisation', sp.company)
                    order by ss.position nulls last, sp.full_name)
             from public.event_program_session_speakers ss
             join public.event_program_speakers sp on sp.id = ss.speaker_id
             where ss.session_id = s.id
           ), '[]'::jsonb) as speakers
    from public.event_program_sessions s
    join public.events e on e.id = s.event_id
    where e.visible = true
      and coalesce(e.is_test, false) = false
      and s.status = 'published'
      and coalesce(e.date_fin, e.date_debut) >= current_date
  ), hashed as (
    select b.*,
           md5(concat_ws('|', b.title, coalesce(b.description, ''), coalesce(b.session_type, ''),
                         coalesce(b.track, ''), b.speakers::text)) as h
    from base b
  )
  select h.id, h.event_id, h.h, h.nom_event, h.secteur, h.session_type, h.title, h.description, h.track, h.speakers
  from hashed h
  left join public.session_enrichment se on se.session_id = h.id
  where se.session_id is null
     or se.content_hash <> h.h
     or se.prompt_version <> p_prompt_version
  order by h.date_debut, h.id
  limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.select_sessions_to_enrich(int, text) from public;
revoke all on function public.select_sessions_to_enrich(int, text) from anon;
revoke all on function public.select_sessions_to_enrich(int, text) from authenticated;
grant execute on function public.select_sessions_to_enrich(int, text) to service_role;

-- 7. Embedding des sessions suggérables (même modèle que embed_pending_novelties) --
create or replace function public.embed_pending_sessions(p_max_batches integer default 4)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_texts jsonb; v_ids uuid[]; v_status int; v_content text; v_emb jsonb; i int;
  n_batches int := 0; v_total int := 0;
begin
  -- Nettoyage : vecteurs dont la session n'est plus suggérable ou n'a plus d'enrichissement
  delete from public.session_embeddings x
  where not exists (
    select 1 from public.session_enrichment se
    where se.session_id = x.session_id and se.is_suggestible = true
  );

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '120');

  loop
    exit when n_batches >= p_max_batches;

    select array_agg(id order by id), jsonb_agg(haystack order by id)
    into v_ids, v_texts
    from (
      select se.session_id as id,
        trim(
          coalesce(s.title, '') || '. ' ||
          coalesce(se.summary, '') || ' ' ||
          left(coalesce(s.description, ''), 1500) || ' ' ||
          coalesce(array_to_string(se.problems, ' '), '') || ' ' ||
          coalesce(array_to_string(se.keywords, ' '), '') || ' ' ||
          coalesce((select string_agg(t.label, ' ') from public.assistant_themes t
                    where t.code = any(se.theme_codes)), '') || ' ' ||
          coalesce((select string_agg(ss.name, ' ') from public.sub_sectors ss
                    where ss.id = any(se.sub_sector_ids)), '')
        ) as haystack
      from public.session_enrichment se
      join public.event_program_sessions s on s.id = se.session_id
      left join public.session_embeddings x on x.session_id = se.session_id
      where se.is_suggestible = true
        and (x.session_id is null or se.enriched_at > x.embedded_at)
      order by se.session_id
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
        'input_type', 'search_document',
        'embedding_types', jsonb_build_array('float'),
        'output_dimension', 1024,
        'texts', v_texts
      )::text
    )::extensions.http_request) r;

    if v_status <> 200 then
      raise warning 'embed_pending_sessions: Cohere status % : %', v_status, left(v_content, 200);
      exit;
    end if;

    v_emb := v_content::jsonb -> 'embeddings' -> 'float';

    for i in 1 .. array_length(v_ids, 1) loop
      insert into public.session_embeddings (session_id, embedding, embedded_at)
      values (v_ids[i], ((v_emb -> (i - 1))::text)::public.vector, now())
      on conflict (session_id) do update
        set embedding = excluded.embedding, embedded_at = now();
    end loop;

    v_total := v_total + array_length(v_ids, 1);
    n_batches := n_batches + 1;
  end loop;

  return v_total;
end
$function$;

revoke all on function public.embed_pending_sessions(integer) from public;
revoke all on function public.embed_pending_sessions(integer) from anon;
revoke all on function public.embed_pending_sessions(integer) from authenticated;

notify pgrst, 'reload schema';