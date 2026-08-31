-- ============================================================================
-- LE FIL DU SALON — Lot 1 (backend)
--
-- Applique en production le 31/08/2026 via MCP Supabase.
-- Version enregistree : 20260831190641
--
-- Modele de securite : aucune policy RLS pour anon/authenticated.
-- Toute lecture passe par une RPC SECURITY DEFINER, toute ecriture par
-- l'Edge Function event-update-manage en service_role. L'acces direct
-- PostgREST est ferme par construction.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table principale
-- ---------------------------------------------------------------------------
create table public.event_updates (
  id                     uuid primary key default gen_random_uuid(),
  event_id               uuid not null references public.events(id) on delete cascade,
  message                text not null,
  category               text not null default 'autre',
  status                 text not null default 'draft',
  cta_type               text not null default 'none',
  cta_label              text,
  cta_url                text,

  -- Acteurs : nullables et SANS FK vers auth.users.
  -- Une suppression de compte ne doit jamais detruire ni verrouiller les
  -- annonces publiees d'un salon (meme choix que novelties.created_by).
  created_by_user_id     uuid,
  last_edited_by_user_id uuid,

  source                 text not null default 'organizer',
  published_at           timestamptz,
  expires_at             timestamptz,
  archived_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Message : 1 a 220 caracteres utiles, une seule ligne.
  constraint event_updates_message_len
    check (char_length(btrim(message)) between 1 and 220),

  -- Aucun caractere de controle (dont saut de ligne et tabulation, qui
  -- casseraient la hauteur du bandeau) ni override bidirectionnel Unicode
  -- (U+202A..U+202E, U+2066..U+2069), qui permet de deguiser un texte affiche.
  constraint event_updates_message_no_ctrl
    check (message !~ E'[\u0001-\u001F\u007F\u202A-\u202E\u2066-\u2069]'),

  constraint event_updates_category
    check (category in ('programme','intervenant','exposants','billetterie','exposer','pratique','autre')),
  constraint event_updates_status
    check (status in ('draft','published','archived')),
  constraint event_updates_source
    check (source in ('organizer','admin','automation')),
  constraint event_updates_cta_type
    check (cta_type in ('none','programme','exposants','nouveautes','external')),

  -- CTA : label et URL existent si et seulement si le CTA est externe.
  -- Les CTA internes portent un libelle standard impose par le front, pour
  -- qu'un organisateur ne puisse pas ecrire "Reserver ma place" sur #programme.
  constraint event_updates_cta_label_iff_external
    check ((cta_type = 'external') = (cta_label is not null)),
  constraint event_updates_cta_url_iff_external
    check ((cta_type = 'external') = (cta_url is not null)),

  -- HTTPS strict. http:// est refuse (contenu mixte + credibilite du lien
  -- affiche sous la caution visuelle Lotexpo). javascript:, data:, vbscript:
  -- et les URL sans hote sont exclus par ce motif.
  constraint event_updates_cta_url_https
    check (cta_url is null or cta_url ~ '^https://[A-Za-z0-9][^[:space:]]*$'),
  constraint event_updates_cta_url_len
    check (cta_url is null or char_length(cta_url) <= 2048),

  constraint event_updates_cta_label_len
    check (cta_label is null or char_length(btrim(cta_label)) between 1 and 40),
  constraint event_updates_cta_label_no_ctrl
    check (cta_label is null or cta_label !~ E'[\u0001-\u001F\u007F\u202A-\u202E\u2066-\u2069]'),

  -- Coherence statut / horodatages : une seule source de verite.
  constraint event_updates_archived_coherence
    check ((status = 'archived') = (archived_at is not null)),
  constraint event_updates_published_requires_ts
    check (status <> 'published' or published_at is not null)
);

comment on table public.event_updates is
  'Le Fil du Salon : annonces courtes publiees par l organisateur revendique. Ecriture via event-update-manage (service_role). Lecture via get_public_event_feed / get_event_feed_admin.';
comment on column public.event_updates.expires_at is
  'NULL = annonce permanente (visible jusqu a la fin du salon). Renseigne = annonce ephemere, invisible publiquement des l echeance.';
comment on column public.event_updates.created_by_user_id is
  'Volontairement sans FK vers auth.users : une suppression de compte ne doit pas detruire les annonces publiees du salon.';

create index idx_event_updates_event
  on public.event_updates (event_id);

-- Index de service de la RPC publique : couvre le tri et le filtre chaud.
create index idx_event_updates_public
  on public.event_updates (event_id, published_at desc)
  where status = 'published';

create index idx_event_updates_event_status
  on public.event_updates (event_id, status);

-- Balayage transverse (admin global, futures automatisations).
create index idx_event_updates_status_published
  on public.event_updates (status, published_at desc);

-- updated_at : reutilisation de la fonction generique existante.
create trigger trg_event_updates_updated_at
  before update on public.event_updates
  for each row execute function public.update_updated_at_column();


-- ---------------------------------------------------------------------------
-- 2. Statistiques agregees
--
-- Agregation directe, JAMAIS de table de lignes brutes : exhibitor_events
-- atteint deja 9 305 lignes sur un perimetre bien plus etroit, alors que le
-- Fil serait expose sur 533 pages salon publiques.
-- ---------------------------------------------------------------------------
create table public.event_update_stats_daily (
  id              uuid primary key default gen_random_uuid(),
  event_update_id uuid not null references public.event_updates(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  stat_date       date not null,
  impressions     bigint not null default 0,
  feed_opens      bigint not null default 0,
  cta_clicks      bigint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Contrainte UNIQUE simple (pas un index partiel) : elle doit pouvoir
  -- servir d'arbitre ON CONFLICT.
  constraint event_update_stats_daily_uniq unique (event_update_id, stat_date),
  constraint event_update_stats_positive
    check (impressions >= 0 and feed_opens >= 0 and cta_clicks >= 0)
);

create index idx_event_update_stats_event_date
  on public.event_update_stats_daily (event_id, stat_date desc);

create trigger trg_event_update_stats_updated_at
  before update on public.event_update_stats_daily
  for each row execute function public.update_updated_at_column();

comment on column public.event_update_stats_daily.event_id is
  'Denormalise pour l agregation par salon. Jamais fourni par l appelant : resolu depuis event_updates par track_event_update().';


-- ---------------------------------------------------------------------------
-- 3. Journal d'activite
-- ---------------------------------------------------------------------------
create table public.event_update_activity_log (
  id              uuid primary key default gen_random_uuid(),
  event_update_id uuid not null references public.event_updates(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  actor_user_id   uuid,   -- nullable, sans FK (meme raison que ci-dessus)
  action          text not null,
  created_at      timestamptz not null default now(),

  constraint event_update_activity_action
    check (action in ('created','published','edited','archived'))
);

create index idx_event_update_activity_update
  on public.event_update_activity_log (event_update_id, created_at desc);
create index idx_event_update_activity_event
  on public.event_update_activity_log (event_id, created_at desc);


-- ---------------------------------------------------------------------------
-- 4. RLS — modele event_program_sessions
--
-- Admin + service_role uniquement. Aucune policy SELECT publique, aucune
-- policy owner. C'est ce qui manquait sur exhibitors et novelties et qui a
-- rendu possible le contournement PostgREST documente dans l'audit d'avril.
-- ---------------------------------------------------------------------------
alter table public.event_updates              enable row level security;
alter table public.event_update_stats_daily   enable row level security;
alter table public.event_update_activity_log  enable row level security;

create policy "Admins manage event updates"
  on public.event_updates for all
  using (public.is_admin()) with check (public.is_admin());
create policy "Service role manages event updates"
  on public.event_updates for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "Admins manage event update stats"
  on public.event_update_stats_daily for all
  using (public.is_admin()) with check (public.is_admin());
create policy "Service role manages event update stats"
  on public.event_update_stats_daily for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "Admins manage event update activity"
  on public.event_update_activity_log for all
  using (public.is_admin()) with check (public.is_admin());
create policy "Service role manages event update activity"
  on public.event_update_activity_log for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');


-- ---------------------------------------------------------------------------
-- 5. RPC de lecture publique
--
-- Un seul aller-retour : les annonces actives ET leur nombre total.
-- Le Sheet reutilise exactement ce jeu de donnees, il ne declenche aucune
-- requete supplementaire (les annonces expirees ne sont jamais publiques,
-- l'"historique public" se limite donc aux annonces actives).
-- created_by_user_id ne sort jamais de cette fonction.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_event_feed(p_event_id uuid)
returns table (
  update_id     uuid,
  message       text,
  category      text,
  cta_type      text,
  cta_label     text,
  cta_url       text,
  published_at  timestamptz,
  expires_at    timestamptz,
  total_active  bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with ev as (
    select e.id
    from events e
    where e.id = p_event_id
      and ((e.visible is true and e.is_test is false) or public.is_admin())
      -- Evenement passe : plus de fil public.
      and (coalesce(e.date_fin, e.date_debut) is null
           or coalesce(e.date_fin, e.date_debut) >= current_date)
  )
  select
    u.id,
    u.message,
    u.category,
    u.cta_type,
    u.cta_label,
    u.cta_url,
    u.published_at,
    u.expires_at,
    count(*) over () as total_active
  from event_updates u
  join ev on u.event_id = ev.id
  where u.status = 'published'
    and u.published_at <= now()
    and (u.expires_at is null or u.expires_at > now())
  order by u.published_at desc
  limit 20;
$function$;

comment on function public.get_public_event_feed(uuid) is
  'Annonces actives d un salon, plus recente en tete. total_active est calcule avant le LIMIT.';


-- ---------------------------------------------------------------------------
-- 6. RPC de lecture organisateur
--
-- Expose brouillons, archivees, expirees et statistiques cumulees.
-- Garde stricte : proprietaire du salon ou admin plateforme.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_feed_admin(p_event_id uuid)
returns table (
  update_id      uuid,
  message        text,
  category       text,
  status         text,
  cta_type       text,
  cta_label      text,
  cta_url        text,
  published_at   timestamptz,
  expires_at     timestamptz,
  archived_at    timestamptz,
  created_at     timestamptz,
  updated_at     timestamptz,
  is_expired     boolean,
  impressions    bigint,
  feed_opens     bigint,
  cta_clicks     bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    u.id,
    u.message,
    u.category,
    u.status,
    u.cta_type,
    u.cta_label,
    u.cta_url,
    u.published_at,
    u.expires_at,
    u.archived_at,
    u.created_at,
    u.updated_at,
    (u.expires_at is not null and u.expires_at <= now()) as is_expired,
    coalesce(s.impressions, 0),
    coalesce(s.feed_opens, 0),
    coalesce(s.cta_clicks, 0)
  from event_updates u
  left join lateral (
    select sum(d.impressions) as impressions,
           sum(d.feed_opens)  as feed_opens,
           sum(d.cta_clicks)  as cta_clicks
    from event_update_stats_daily d
    where d.event_update_id = u.id
  ) s on true
  where u.event_id = p_event_id
    and (public.is_event_owner(p_event_id) or public.is_admin())
  order by
    case u.status when 'published' then 0 when 'draft' then 1 else 2 end,
    coalesce(u.published_at, u.created_at) desc;
$function$;


-- ---------------------------------------------------------------------------
-- 7. RPC de tracking
--
-- Meme contrat que track_exhibitor_event : appelable depuis le front en anon,
-- whitelist stricte, ne leve jamais, renvoie un booleen.
--
-- Trois gardes que le tracking existant n'a pas :
--   1. l'annonce doit etre REELLEMENT active (pas de compteur sur un brouillon,
--      une archivee ou une expiree) ;
--   2. le salon doit etre visible, non test et non termine ;
--   3. le proprietaire du salon et les admins ne sont PAS comptes.
--
-- Limite assumee : PostgREST ne donne pas d'IP exploitable, il n'y a donc pas
-- de limitation de debit possible ici. Les impressions restent approximatives.
-- La metrique a mettre en avant aupres de l'organisateur est cta_clicks.
-- ---------------------------------------------------------------------------
create or replace function public.track_event_update(
  p_event_update_id uuid,
  p_event_type      text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event_id uuid;
  v_owner    uuid;
begin
  if p_event_type is null or p_event_type not in ('impression','feed_open','cta_click') then
    return false;
  end if;

  -- Gardes 1 et 2 : annonce active sur un salon publiquement affichable.
  select u.event_id, e.owner_user_id
    into v_event_id, v_owner
  from event_updates u
  join events e on e.id = u.event_id
  where u.id = p_event_update_id
    and u.status = 'published'
    and u.published_at <= now()
    and (u.expires_at is null or u.expires_at > now())
    and e.visible is true
    and e.is_test is false
    and (coalesce(e.date_fin, e.date_debut) is null
         or coalesce(e.date_fin, e.date_debut) >= current_date)
  limit 1;

  if v_event_id is null then
    return false;
  end if;

  -- Garde 3 : l'organisateur consulte sa propre page pour verifier son rendu.
  -- Compter ses vues detruirait la credibilite de la metrique qu'on lui vend.
  if auth.uid() is not null and (auth.uid() = v_owner or public.is_admin()) then
    return false;
  end if;

  insert into event_update_stats_daily (
    event_update_id, event_id, stat_date, impressions, feed_opens, cta_clicks
  )
  values (
    p_event_update_id,
    v_event_id,
    current_date,
    case when p_event_type = 'impression' then 1 else 0 end,
    case when p_event_type = 'feed_open'  then 1 else 0 end,
    case when p_event_type = 'cta_click'  then 1 else 0 end
  )
  on conflict (event_update_id, stat_date) do update set
    impressions = event_update_stats_daily.impressions
                  + case when p_event_type = 'impression' then 1 else 0 end,
    feed_opens  = event_update_stats_daily.feed_opens
                  + case when p_event_type = 'feed_open'  then 1 else 0 end,
    cta_clicks  = event_update_stats_daily.cta_clicks
                  + case when p_event_type = 'cta_click'  then 1 else 0 end,
    updated_at  = now();

  return true;
exception
  when others then
    -- L'analytics ne casse jamais l'interface publique.
    return false;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 8. Droits d'execution
--
-- ATTENTION : voir la migration suivante (20260831190710). Le REVOKE FROM
-- PUBLIC ci-dessous ne suffit PAS a retirer l'acces a anon, car Supabase
-- accorde EXECUTE nominativement a anon et authenticated via ses
-- ALTER DEFAULT PRIVILEGES.
-- ---------------------------------------------------------------------------
revoke all on function public.get_public_event_feed(uuid) from public;
revoke all on function public.get_event_feed_admin(uuid)  from public;
revoke all on function public.track_event_update(uuid, text) from public;

grant execute on function public.get_public_event_feed(uuid)    to anon, authenticated, service_role;
grant execute on function public.track_event_update(uuid, text) to anon, authenticated, service_role;

-- Lecture organisateur : jamais anon.
grant execute on function public.get_event_feed_admin(uuid)     to authenticated, service_role;
