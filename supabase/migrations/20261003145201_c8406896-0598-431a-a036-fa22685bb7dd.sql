-- lovable-cron-fallback-reviewed: regroupement de 5 min de calme voulu par la conception (évite de relancer le moteur à chaque retour) ; 288 passages/jour acceptés, pure requête SQL quand rien à faire.
-- Assistant « Pépites », lot 4 : fondations de la boucle d'apprentissage.
-- Principes (page Notion 17, révisée le 03/10/2026) :
--   * seul un « Pas pour moi » posé sur une pépite précise apprend quelque chose sur les sujets ;
--   * « Je n'irai pas » (pas disponible, trop loin) n'apprend RIEN sur le contenu ;
--   * deux signaux concordants avant de généraliser (somme pondérée >= 1,5) ;
--   * un retour vieillit : au bout de 6 mois il compte moitié moins ;
--   * tout est réversible (assistant_undo_feedback).
-- Aucune page du site n'appelle encore ces fonctions (les boutons arrivent au lot 3).

-- ---------------------------------------------------------------------------------------------
-- 1. Colonnes ajoutées
-- ---------------------------------------------------------------------------------------------
alter table public.assistant_pistes
  add column if not exists embedding_tuned public.vector(1024),
  add column if not exists tuned_at timestamptz,
  add column if not exists origin text not null default 'profile',
  add column if not exists replaced_by uuid;

alter table public.assistant_pistes drop constraint if exists assistant_pistes_origin_chk;
alter table public.assistant_pistes add constraint assistant_pistes_origin_chk
  check (origin in ('profile', 'replacement'));

alter table public.assistant_profiles
  add column if not exists refresh_requested_at timestamptz,
  add column if not exists refresh_dispatched_at timestamptz,
  add column if not exists refresh_attempts smallint not null default 0,
  add column if not exists refreshed_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- 2. Table des retours
-- ---------------------------------------------------------------------------------------------
create table if not exists public.assistant_feedback (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.assistant_profiles(id) on delete cascade,
  signal          text not null,
  reason          text,
  item_type       text,
  item_id         uuid,
  event_id        uuid not null references public.events(id) on delete cascade,
  series_id       uuid,
  piste_id        uuid references public.assistant_pistes(id) on delete set null,
  piste_label     text,
  item_sector_ids uuid[] not null default '{}',
  source          text not null default 'app',
  created_at      timestamptz not null default now(),
  undone_at       timestamptz,
  constraint assistant_feedback_signal_chk
    check (signal in ('agenda', 'inscription', 'rdv', 'pas_pour_moi', 'je_n_irai_pas')),
  constraint assistant_feedback_reason_chk check (
       (signal = 'pas_pour_moi'  and (reason is null or reason in ('sujet', 'secteur', 'trop_general')))
    or (signal = 'je_n_irai_pas' and (reason is null or reason in ('pas_disponible', 'trop_loin', 'pas_interesse')))
    or (signal in ('agenda', 'inscription', 'rdv') and reason is null)),
  constraint assistant_feedback_item_chk check (
       (signal = 'je_n_irai_pas' and item_id is null and item_type is null)
    or (signal <> 'je_n_irai_pas' and item_id is not null and item_type in ('session', 'novelty'))),
  constraint assistant_feedback_source_chk check (source in ('app', 'email', 'test', 'admin'))
);

create index if not exists assistant_feedback_profile_idx
  on public.assistant_feedback (profile_id, created_at desc);
create index if not exists assistant_feedback_piste_idx
  on public.assistant_feedback (piste_id) where piste_id is not null;
create unique index if not exists assistant_feedback_item_active_uniq
  on public.assistant_feedback (profile_id, item_type, item_id, signal)
  where undone_at is null and item_id is not null;
create unique index if not exists assistant_feedback_event_active_uniq
  on public.assistant_feedback (profile_id, event_id)
  where undone_at is null and signal = 'je_n_irai_pas';

alter table public.assistant_feedback enable row level security;
-- Pas de policy : tout passe par les fonctions ci-dessous.

-- ---------------------------------------------------------------------------------------------
-- 3. Poids d'un retour selon son âge (6 mois = moitié)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_feedback_weight(p_created_at timestamptz)
returns double precision
language sql stable
set search_path = public
as $$
  select power(0.5, greatest(extract(epoch from (now() - p_created_at)), 0) / 86400.0 / 182.0)
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Ajustements d'un profil, calculés à partir de ses retours actifs
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_profile_adjustments(p_profile_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  c_threshold constant double precision := 1.5;
  v_prof      public.assistant_profiles%rowtype;
  v_declared  uuid[];
  v_out       jsonb;
begin
  select * into v_prof from public.assistant_profiles ap where ap.id = p_profile_id;
  if not found then
    return null;
  end if;

  -- Secteurs déclarés : jamais bloqués en silence.
  select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_declared
  from (
    select unnest(v_prof.sector_ids) as s
    union
    select ss.sector_id from public.sub_sectors ss where ss.id = any(v_prof.sub_sector_ids)
  ) t;

  with fb as (
    select f.*, public.assistant_feedback_weight(f.created_at) as w
    from public.assistant_feedback f
    where f.profile_id = p_profile_id and f.undone_at is null
  )
  select jsonb_build_object(
    'excluded_items', coalesce((
      select jsonb_agg(distinct jsonb_build_object('item_type', fb.item_type, 'item_id', fb.item_id))
      from fb where fb.signal = 'pas_pour_moi'), '[]'::jsonb),
    'excluded_event_ids', coalesce((
      select jsonb_agg(distinct fb.event_id) from fb where fb.signal = 'je_n_irai_pas'), '[]'::jsonb),
    'excluded_series_ids', coalesce((
      select jsonb_agg(distinct fb.series_id) from fb
      where fb.signal = 'je_n_irai_pas' and fb.reason = 'pas_interesse' and fb.series_id is not null), '[]'::jsonb),
    'blocked_sector_ids', coalesce((
      select jsonb_agg(b.sid) from (
        select s.sid
        from fb cross join lateral unnest(fb.item_sector_ids) as s(sid)
        where fb.signal = 'pas_pour_moi' and fb.reason = 'secteur' and not (s.sid = any(v_declared))
        group by s.sid
        having sum(fb.w) >= c_threshold
      ) b), '[]'::jsonb),
    'replace_piste_ids', coalesce((
      select jsonb_agg(r.piste_id) from (
        select fb.piste_id
        from fb join public.assistant_pistes p on p.id = fb.piste_id and p.active
        where fb.signal = 'pas_pour_moi' and fb.reason = 'sujet'
        group by fb.piste_id
        having sum(fb.w) >= c_threshold
      ) r), '[]'::jsonb),
    'weak_piste_ids', coalesce((
      select jsonb_agg(r.piste_id) from (
        select fb.piste_id
        from fb join public.assistant_pistes p on p.id = fb.piste_id and p.active
        where fb.signal = 'pas_pour_moi' and fb.reason is null
        group by fb.piste_id
        having sum(fb.w) >= c_threshold
      ) r), '[]'::jsonb),
    'require_sector', coalesce((
      select sum(fb.w) >= c_threshold from fb
      where fb.signal = 'pas_pour_moi' and fb.reason = 'trop_general'), false),
    'propose_distance', (v_prof.radius_km is null) and coalesce((
      select sum(fb.w) >= c_threshold from fb
      where fb.signal = 'je_n_irai_pas' and fb.reason = 'trop_loin'), false),
    'recent', coalesce((
      select jsonb_agg(x.j order by x.at desc) from (
        select fb.created_at as at,
               jsonb_build_object(
                 'signal', fb.signal, 'reason', fb.reason, 'item_type', fb.item_type,
                 'title', coalesce(s.title, n.title), 'piste', fb.piste_label) as j
        from fb
        left join public.event_program_sessions s on fb.item_type = 'session' and s.id = fb.item_id
        left join public.novelties n on fb.item_type = 'novelty' and n.id = fb.item_id
        where fb.signal <> 'je_n_irai_pas'
        order by fb.created_at desc
        limit 8
      ) x), '[]'::jsonb),
    'feedback_count', (select count(*) from fb)
  ) into v_out;

  return v_out;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Vecteur ajusté de chaque piste : se rapproche des pépites aimées, s'éloigne des refusées
--    (« Pas pour moi » sans raison ou « Pas ce sujet »). Le vecteur d'origine n'est jamais modifié.
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_tune_pistes(p_profile_id uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c_like constant real := 0.35;
  c_dis  constant real := 0.15;
  r      record;
  v_dim  integer;
  v_like vector; v_wl double precision;
  v_dis  vector; v_wd double precision;
  v_new  vector;
  n      integer := 0;
begin
  for r in
    select p.id, p.embedding from public.assistant_pistes p
    where p.profile_id = p_profile_id and p.active and p.embedding is not null
  loop
    v_dim := vector_dims(r.embedding);

    with fb as (
      select f.item_type, f.item_id, public.assistant_feedback_weight(f.created_at) as w,
             case when f.signal in ('agenda', 'inscription', 'rdv') then 1 else -1 end as dir
      from public.assistant_feedback f
      where f.profile_id = p_profile_id and f.piste_id = r.id and f.undone_at is null
        and (f.signal in ('agenda', 'inscription', 'rdv')
             or (f.signal = 'pas_pour_moi' and (f.reason is null or f.reason = 'sujet')))
    ), emb as (
      select fb.dir, fb.w, coalesce(se.embedding, ne.embedding) as e
      from fb
      left join public.session_embeddings se on fb.item_type = 'session' and se.session_id = fb.item_id
      left join public.novelty_embeddings ne on fb.item_type = 'novelty' and ne.novelty_id = fb.item_id
    )
    select sum(l2_normalize(emb.e) * array_fill(emb.w::real, array[v_dim])::vector) filter (where emb.dir = 1 and emb.e is not null),
           sum(emb.w) filter (where emb.dir = 1 and emb.e is not null),
           sum(l2_normalize(emb.e) * array_fill(emb.w::real, array[v_dim])::vector) filter (where emb.dir = -1 and emb.e is not null),
           sum(emb.w) filter (where emb.dir = -1 and emb.e is not null)
      into v_like, v_wl, v_dis, v_wd
    from emb;

    if coalesce(v_wl, 0) = 0 and coalesce(v_wd, 0) = 0 then
      update public.assistant_pistes set embedding_tuned = null, tuned_at = now()
       where id = r.id and embedding_tuned is not null;
      continue;
    end if;

    v_new := l2_normalize(r.embedding);
    if coalesce(v_wl, 0) > 0 then
      v_new := v_new + v_like * array_fill((c_like / v_wl)::real, array[v_dim])::vector;
    end if;
    if coalesce(v_wd, 0) > 0 then
      v_new := v_new - v_dis * array_fill((c_dis / v_wd)::real, array[v_dim])::vector;
    end if;

    update public.assistant_pistes set embedding_tuned = l2_normalize(v_new), tuned_at = now()
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Recalcul d'un salon suggéré après un retour (même règle que le moteur :
--    au moins 2 pépites retenues, ou 1 pépite >= 90 qui croise le secteur)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_recount_suggestion(p_profile_id uuid, p_event_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_ids  uuid[];
  v_n    integer;
  v_best integer;
  v_strong boolean;
begin
  select array_agg(m.id order by m.score desc nulls last), count(*), max(m.score),
         coalesce(bool_or(m.score >= 90 and m.sector_match), false)
    into v_ids, v_n, v_best, v_strong
  from public.assistant_matches m
  where m.profile_id = p_profile_id and m.event_id = p_event_id and m.status = 'retained';

  if v_n >= 2 or v_strong then
    insert into public.assistant_suggestions (profile_id, event_id, match_ids, pepite_count, best_score, computed_at)
    values (p_profile_id, p_event_id, v_ids, v_n, v_best, now())
    on conflict (profile_id, event_id) do update
      set match_ids = excluded.match_ids, pepite_count = excluded.pepite_count,
          best_score = excluded.best_score, computed_at = excluded.computed_at;
  else
    -- Un salon pas encore montré disparaît ; un salon déjà montré garde sa ligne, compteur à jour.
    delete from public.assistant_suggestions
     where profile_id = p_profile_id and event_id = p_event_id and status = 'pending';
    update public.assistant_suggestions
       set match_ids = coalesce(v_ids, '{}'::uuid[]), pepite_count = coalesce(v_n, 0),
           best_score = v_best, computed_at = now()
     where profile_id = p_profile_id and event_id = p_event_id;
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Enregistrer un retour (appelée par le site au lot 3, par l'email, ou par Claude pour les tests)
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_record_feedback(
  p_profile_id uuid,
  p_signal     text,
  p_reason     text default null,
  p_item_type  text default null,
  p_item_id    uuid default null,
  p_event_id   uuid default null,
  p_source     text default 'app'
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c_threshold constant double precision := 1.5;
  v_uid      uuid := auth.uid();
  v_prof     public.assistant_profiles%rowtype;
  v_event    uuid;
  v_series   uuid;
  v_piste    uuid;
  v_label    text;
  v_sectors  uuid[] := '{}'::uuid[];
  v_declared uuid[];
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

  -- Accès : connexion directe à la base (tâches planifiées, administration), service_role,
  -- propriétaire du profil ou administrateur.
  if not (session_user::text <> 'authenticator'
          or coalesce(auth.role(), '') = 'service_role'
          or (v_uid is not null and v_prof.user_id = v_uid)
          or (v_uid is not null and public.has_role(v_uid, 'admin'))) then
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
    select coalesce(array_agg(distinct ss.sector_id), '{}'::uuid[]) into v_sectors
    from public.sub_sectors ss
    where ss.id = any(coalesce(
      case when p_item_type = 'session'
            then (select se.sub_sector_ids from public.session_enrichment se where se.session_id = p_item_id)
           else (select ne.sub_sector_ids from public.novelty_enrichment ne where ne.novelty_id = p_item_id)
      end, '{}'::uuid[]));
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
    elsif p_reason = 'secteur' then
      select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_declared
      from (
        select unnest(v_prof.sector_ids) as s
        union
        select ss.sector_id from public.sub_sectors ss where ss.id = any(v_prof.sub_sector_ids)
      ) t;
      select string_agg(sc.name, ' et ' order by sc.name) into v_names
      from public.sectors sc
      where sc.id = any(v_sectors) and not (sc.id = any(v_declared))
        and (select sum(public.assistant_feedback_weight(f.created_at))
             from public.assistant_feedback f
             where f.profile_id = p_profile_id and f.signal = 'pas_pour_moi' and f.reason = 'secteur'
               and f.undone_at is null and sc.id = any(f.item_sector_ids)) >= c_threshold;
      if v_names is not null then
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

  if v_refresh then
    update public.assistant_profiles set refresh_requested_at = now(), refresh_attempts = 0
     where id = p_profile_id;
  end if;

  return jsonb_build_object(
    'feedback_id', v_id, 'message', v_msg, 'generalisation', v_general,
    'propose_distance', v_distance, 'refresh', v_refresh);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Annuler un retour
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_undo_feedback(p_feedback_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_fb   public.assistant_feedback%rowtype;
  v_user uuid;
begin
  select f.* into v_fb from public.assistant_feedback f where f.id = p_feedback_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Retour introuvable.');
  end if;
  select ap.user_id into v_user from public.assistant_profiles ap where ap.id = v_fb.profile_id;
  if not (session_user::text <> 'authenticator'
          or coalesce(auth.role(), '') = 'service_role'
          or (v_uid is not null and v_user = v_uid)
          or (v_uid is not null and public.has_role(v_uid, 'admin'))) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_fb.undone_at is not null then
    return jsonb_build_object('ok', true, 'message', 'Déjà annulé.');
  end if;

  update public.assistant_feedback set undone_at = now() where id = p_feedback_id;

  if v_fb.signal = 'pas_pour_moi' then
    update public.assistant_matches set status = 'retained'
     where profile_id = v_fb.profile_id and item_type = v_fb.item_type and item_id = v_fb.item_id
       and score >= 70;
    perform public.assistant_recount_suggestion(v_fb.profile_id, v_fb.event_id);
  elsif v_fb.signal = 'je_n_irai_pas' then
    update public.assistant_suggestions set status = 'pending'
     where profile_id = v_fb.profile_id and status = 'dismissed'
       and (event_id = v_fb.event_id
            or (v_fb.reason = 'pas_interesse' and v_fb.series_id is not null
                and event_id in (select e.id from public.events e where e.series_id = v_fb.series_id)));
  end if;

  update public.assistant_profiles set refresh_requested_at = now(), refresh_attempts = 0
   where id = v_fb.profile_id;

  return jsonb_build_object('ok', true, 'message', 'Annulé.');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Présélection : lit désormais les ajustements du profil
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_candidates(
  p_profile_id uuid, p_k integer default 25, p_min_similarity real default 0.30,
  p_days_from integer default 0, p_days_to integer default 120)
returns table(piste_id uuid, item_type text, item_id uuid, event_id uuid, similarity real,
              sector_match boolean, role_match boolean, theme_match boolean, passes boolean)
language plpgsql stable security definer
set search_path = public, extensions
as $function$
#variable_conflict use_column
declare
  v_prof        public.assistant_profiles%rowtype;
  v_sectors     uuid[];
  v_role        text[];
  v_psect       uuid[];
  v_adj         jsonb;
  v_excl_sess   uuid[];
  v_excl_nov    uuid[];
  v_excl_events uuid[];
  v_excl_series uuid[];
  v_blocked     uuid[];
  v_req_sector  boolean;
  r             record;
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

  -- Ajustements issus des retours de l'utilisateur
  v_adj := coalesce(public.assistant_profile_adjustments(p_profile_id), '{}'::jsonb);
  select coalesce(array_agg((x->>'item_id')::uuid) filter (where x->>'item_type' = 'session'), '{}'::uuid[]),
         coalesce(array_agg((x->>'item_id')::uuid) filter (where x->>'item_type' = 'novelty'), '{}'::uuid[])
    into v_excl_sess, v_excl_nov
  from jsonb_array_elements(coalesce(v_adj->'excluded_items', '[]'::jsonb)) as x;
  select coalesce(array_agg(je.val::uuid), '{}'::uuid[]) into v_excl_events
  from jsonb_array_elements_text(coalesce(v_adj->'excluded_event_ids', '[]'::jsonb)) as je(val);
  select coalesce(array_agg(je.val::uuid), '{}'::uuid[]) into v_excl_series
  from jsonb_array_elements_text(coalesce(v_adj->'excluded_series_ids', '[]'::jsonb)) as je(val);
  select coalesce(array_agg(je.val::uuid), '{}'::uuid[]) into v_blocked
  from jsonb_array_elements_text(coalesce(v_adj->'blocked_sector_ids', '[]'::jsonb)) as je(val);
  v_req_sector := coalesce((v_adj->>'require_sector')::boolean, false);

  for r in
    select p.id, coalesce(p.embedding_tuned, p.embedding) as embedding,
           p.theme_codes, p.is_generic, p.sector_ids, p.sub_sector_ids
    from public.assistant_pistes p
    where p.profile_id = p_profile_id and p.active and p.embedding is not null
    order by p.position
  loop
    -- Secteurs acceptés pour cette piste : ceux du profil, plus ceux de la piste
    -- (par exemple les secteurs clients d'un fournisseur), moins les secteurs bloqués par ses retours.
    select coalesce(array_agg(distinct s), '{}'::uuid[]) into v_psect
    from (
      select unnest(v_sectors) as s
      union
      select unnest(r.sector_ids)
      union
      select ss.sector_id from public.sub_sectors ss where ss.id = any(r.sub_sector_ids)
    ) t
    where not (s = any(v_blocked));

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
        and not (se.session_id = any(v_excl_sess))
        and not (e.id = any(v_excl_events))
        and (e.series_id is null or not (e.series_id = any(v_excl_series)))
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
        and not (ne.novelty_id = any(v_excl_nov))
        and not (e.id = any(v_excl_events))
        and (e.series_id is null or not (e.series_id = any(v_excl_series)))
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
             (c.themes && r.theme_codes) as f_theme,
             -- élément dont tous les secteurs ont été refusés par l'utilisateur
             (cardinality(v_blocked) > 0 and cardinality(c.subs) > 0
              and not exists (select 1 from public.sub_sectors ss
                              where ss.id = any(c.subs) and not (ss.sector_id = any(v_blocked)))) as f_blocked
      from cand c
    )
    select r.id, f.it, f.iid, f.eid, f.sim, f.f_sector, f.f_role, f.f_theme,
           (f.sim >= p_min_similarity) and not f.f_blocked and
           case
             when v_req_sector then f.f_sector and (not r.is_generic or f.f_theme)
             when r.is_generic then f.f_theme and (f.f_sector or f.f_role)
             else (f.f_sector or f.f_role)
           end
    from flags f;
  end loop;
end
$function$;

-- ---------------------------------------------------------------------------------------------
-- 10. Relance du moteur après des retours : regroupée (5 min de calme), au plus 5 profils
--     par passage, 3 tentatives au plus en cas d'échec.
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistant_dispatch_refresh(p_limit integer default 5)
returns integer
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select ap.id from public.assistant_profiles ap
    where ap.refresh_requested_at is not null
      and ap.refresh_requested_at < now() - interval '5 minutes'
      and (ap.refreshed_at is null or ap.refreshed_at < ap.refresh_requested_at)
      and ap.refresh_attempts < 3
      and (ap.refresh_dispatched_at is null
           or ap.refresh_dispatched_at < ap.refresh_requested_at
           or ap.refresh_dispatched_at < now() - interval '30 minutes')
    order by ap.refresh_requested_at
    limit p_limit
  loop
    perform net.http_post(
      url := 'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/assistant-pepites',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY' limit 1)
      ),
      body := jsonb_build_object('profile_id', r.id, 'step', 'adapt'),
      timeout_milliseconds := 300000
    );
    update public.assistant_profiles
       set refresh_dispatched_at = now(), refresh_attempts = refresh_attempts + 1
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 11. Jeu de référence : ce qui ne doit JAMAIS arriver (doit toujours renvoyer 0 ligne)
-- ---------------------------------------------------------------------------------------------
create or replace view public.assistant_feedback_violations
with (security_invoker = true) as
select f.profile_id, 'pepite_refusee_revenue'::text as probleme,
       f.item_type, f.item_id, f.event_id, f.created_at
from public.assistant_feedback f
join public.assistant_matches m
  on m.profile_id = f.profile_id and m.item_type = f.item_type and m.item_id = f.item_id
 and m.status = 'retained'
where f.undone_at is null and f.signal = 'pas_pour_moi'
union all
select f.profile_id, 'salon_refuse_resuggere'::text,
       null::text, null::uuid, s.event_id, f.created_at
from public.assistant_feedback f
join public.assistant_suggestions s
  on s.profile_id = f.profile_id and s.status in ('pending', 'notified')
 and (s.event_id = f.event_id
      or (f.reason = 'pas_interesse' and f.series_id is not null
          and s.event_id in (select e.id from public.events e where e.series_id = f.series_id)))
where f.undone_at is null and f.signal = 'je_n_irai_pas';

-- ---------------------------------------------------------------------------------------------
-- 12. Droits
-- ---------------------------------------------------------------------------------------------
revoke all on public.assistant_feedback from anon, authenticated;
grant all on public.assistant_feedback to service_role;
revoke all on public.assistant_feedback_violations from anon, authenticated;

revoke all on function public.assistant_feedback_weight(timestamptz) from public, anon, authenticated;
revoke all on function public.assistant_profile_adjustments(uuid) from public, anon, authenticated;
revoke all on function public.assistant_tune_pistes(uuid) from public, anon, authenticated;
revoke all on function public.assistant_recount_suggestion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.assistant_dispatch_refresh(integer) from public, anon, authenticated;
revoke all on function public.assistant_record_feedback(uuid, text, text, text, uuid, uuid, text) from public, anon;
revoke all on function public.assistant_undo_feedback(uuid) from public, anon;

grant execute on function public.assistant_feedback_weight(timestamptz) to service_role;
grant execute on function public.assistant_profile_adjustments(uuid) to service_role;
grant execute on function public.assistant_tune_pistes(uuid) to service_role;
grant execute on function public.assistant_recount_suggestion(uuid, uuid) to service_role;
grant execute on function public.assistant_dispatch_refresh(integer) to service_role;
grant execute on function public.assistant_record_feedback(uuid, text, text, text, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.assistant_undo_feedback(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 13. Tâche planifiée : toutes les 5 minutes (pure requête SQL quand il n'y a rien à faire)
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform cron.unschedule('assistant-refresh-feedback');
exception when others then
  null;
end
$$;

select cron.schedule(
  'assistant-refresh-feedback',
  '*/5 * * * *',
  $cron$select public.assistant_dispatch_refresh();$cron$
);

notify pgrst, 'reload schema';