-- Assistant « Pépites », lot 3a bis : Mon Agenda garde les pépites des salons déjà ajoutés.
-- Constat du test du 03/10 : ajouter une conférence à l'agenda ajoute son salon (statut « added ») ; le salon
-- quitte alors « À découvrir » et ses autres pépites n'apparaissaient plus nulle part. assistant_my_feed renvoie
-- désormais aussi « agenda_pepites » : pour chaque salon à venir de l'agenda, ses pépites retenues.
-- Même signature, mêmes droits ; seule une clé est ajoutée à la réponse.

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
        and e.date_fin >= current_date - 1), '[]'::jsonb),
    -- Pépites des salons déjà dans l'agenda (partie « Mes salons ») : un salon ajouté quitte
    -- « À découvrir », mais ses autres pépites restent visibles sous ce salon.
    'agenda_pepites', coalesce((
      select jsonb_agg(jsonb_build_object(
               'event_id', x.event_id,
               'pepites', (select jsonb_agg(public.assistant_pepite_json(v_pid, m) order by m.score desc nulls last)
                           from public.assistant_matches m
                           where m.profile_id = v_pid and m.event_id = x.event_id and m.status = 'retained'))
             order by x.date_debut)
      from (
        select distinct e.id as event_id, e.date_debut
        from public.assistant_matches m
        join public.events e on e.id = m.event_id
        where m.profile_id = v_pid and m.status = 'retained' and e.date_fin >= current_date
          and exists (select 1 from public.favorites f
                      where f.user_id = v_prof.user_id and (f.event_uuid = e.id or f.event_id = e.id))
      ) x), '[]'::jsonb)
  );
end
$$;

notify pgrst, 'reload schema';