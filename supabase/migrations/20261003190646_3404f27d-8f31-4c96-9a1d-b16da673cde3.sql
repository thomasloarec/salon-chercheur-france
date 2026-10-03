-- Assistant « Pépites », lot 3b : ce que les cartes du site affichent.
-- 1. Les messages de confirmation ne parlent plus de « pépite » (décision de Thomas du 03/10 : un vocabulaire
--    concret, « conférences et Nouveautés à ne pas manquer »). Le reste de assistant_record_feedback est inchangé.
-- 2. Chaque élément renvoyé par assistant_my_feed porte aussi le type de session (conférence, table ronde,
--    atelier…), la page publique de l'exposant d'une Nouveauté, et s'il accepte les demandes de rendez-vous
--    (un responsable actif, comme RequestMeetingButton ailleurs sur le site).
-- Mêmes signatures, mêmes droits.

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
    v_msg := 'Compris : je ne vous la proposerai plus.';
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
        v_msg := 'Compris : je vous proposerai moins de sujets de ce type.';
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
      'session_type', s.session_type,
      'day_date', s.day_date, 'start_time', s.start_time, 'end_time', s.end_time,
      'location', s.location, 'registration_url', s.registration_url) end,
    'novelty', case when m.item_type = 'novelty' then jsonb_build_object(
      'slug', n.slug, 'stand_info', n.stand_info, 'exhibitor_id', n.exhibitor_id,
      'exhibitor_name', ex.name, 'image_url', n.media_urls[1],
      'exhibitor_slug', pep.public_slug,
      'can_request_meeting', coalesce(pep.has_active_manager and not pep.is_test, false)) end
  )
  from (select 1) one
  left join public.event_program_sessions s on m.item_type = 'session' and s.id = m.item_id
  left join public.session_enrichment se on m.item_type = 'session' and se.session_id = m.item_id
  left join public.novelties n on m.item_type = 'novelty' and n.id = m.item_id
  left join public.novelty_enrichment ne on m.item_type = 'novelty' and ne.novelty_id = m.item_id
  left join public.exhibitors ex on ex.id = n.exhibitor_id
  left join lateral (
    select pe.public_slug, pe.has_active_manager, pe.is_test
    from public.public_exhibitor_profiles pe
    where n.exhibitor_id is not null and pe.exhibitor_id = n.exhibitor_id
    limit 1) pep on true
  left join public.assistant_pistes p on p.id = m.piste_id
$$;

notify pgrst, 'reload schema';