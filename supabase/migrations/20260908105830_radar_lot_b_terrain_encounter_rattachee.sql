-- =====================================================================
-- Lot B (1/5) : rattachement d'une entreprise rencontree a un exposant
-- du salon. Applique en prod le 08/09/2026 via Supabase MCP, verifie
-- bout en bout en transaction annulee (recherche, creation du compte,
-- match, statut a_qualifier, mission, absence de doublon dans la liste
-- du salon : 2 -> 3 entreprises, 0 doublon).
--
-- L'ancienne signature a 2 arguments est supprimee au profit d'une
-- signature a 3 arguments dont le 3e a une valeur par defaut : le front
-- actuel, qui n'envoie que p_event_id et p_name, continue de fonctionner
-- a l'identique (comportement note locale non rattachee).
-- =====================================================================

drop function if exists public.add_radar_terrain_encounter(uuid, text);

create or replace function public.add_radar_terrain_encounter(
  p_event_id uuid,
  p_name text,
  p_id_exposant text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_key text;
  v_mission_id uuid;
  v_id_exposant text := nullif(btrim(coalesce(p_id_exposant, '')), '');
  v_expo_name text;
  v_domain text;
  v_website text;
  v_import_id uuid;
  v_user uuid;
  v_company_id uuid;
  v_company_name text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_name = '' then raise exception 'empty_name'; end if;

  v_account_id := public.radar_current_account_id(v_uid);
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  -- ---------------------------------------------------------------
  -- Rattachement demande : l'exposant doit reellement exposer sur ce
  -- salon, et disposer d'un domaine. Sans domaine, aucun re-matching
  -- futur n'est possible et l'unicite ne protege pas des doublons :
  -- on retombe alors sur la note locale, sans erreur.
  -- ---------------------------------------------------------------
  if v_id_exposant is not null then
    select v.nom_exposant, nullif(btrim(coalesce(v.normalized_domain, '')), ''), v.website_exposant
      into v_expo_name, v_domain, v_website
    from public.crm_radar_participations_view v
    where v.event_id = p_event_id and v.id_exposant = v_id_exposant
    limit 1;

    if not found then raise exception 'exposant_not_on_event'; end if;
    if v_domain is null then v_id_exposant := null; end if;
  end if;

  -- ---------------------------------------------------------------
  -- Cas historique : note locale, hors CRM. Inchange.
  -- ---------------------------------------------------------------
  if v_id_exposant is null then
    v_slug := lower(btrim(regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '-', 'g'), '-'));
    if v_slug = '' then v_slug := 'sans-nom'; end if;
    v_key := 'manual:' || v_slug;

    insert into public.radar_missions
      (radar_account_id, company_key, crm_company_id, event_id, id_exposant,
       manual_company_name, origin, visited, visited_at, ai_field_sources, created_by, updated_at)
    values
      (v_account_id, v_key, null, p_event_id, null,
       v_name, 'rencontre', true, now(), '{}'::jsonb, v_uid, now())
    on conflict (radar_account_id, company_key, event_id) do update set
       manual_company_name = coalesce(radar_missions.manual_company_name, excluded.manual_company_name),
       visited = true,
       visited_at = coalesce(radar_missions.visited_at, now()),
       updated_at = now()
    returning id into v_mission_id;

    return v_mission_id;
  end if;

  -- ---------------------------------------------------------------
  -- Cas rattache : compte Radar reel.
  -- ---------------------------------------------------------------
  v_company_name := coalesce(nullif(v_expo_name, ''), v_name);
  v_key := public.radar_company_key(v_domain, v_company_name);

  v_import_id := public.radar_ensure_manual_import(v_account_id);
  select i.user_id into v_user from public.crm_imports i where i.id = v_import_id;
  if v_user is null then raise exception 'manual_import_unavailable'; end if;

  -- Si le domaine existe deja (import CRM reel), on REUTILISE la ligne
  -- telle quelle : son import_id n'est pas vole par l'import manuel,
  -- donc elle ne bascule pas en veille.
  insert into public.crm_companies
    (user_id, radar_account_id, import_id, company_name, website_raw, normalized_domain)
  values
    (v_user, v_account_id, v_import_id, v_company_name, v_website, v_domain)
  on conflict (user_id, normalized_domain) do update set updated_at = now()
  returning id into v_company_id;

  insert into public.crm_company_event_matches
    (user_id, radar_account_id, crm_company_id, id_exposant, event_id,
     normalized_domain, match_type, match_status, needs_review)
  values
    (v_user, v_account_id, v_company_id, v_id_exposant, p_event_id,
     v_domain, 'manual', 'confirmed', false)
  on conflict (crm_company_id, id_exposant, event_id) do nothing;

  -- Veille : statut explicite 'a_qualifier' si aucun statut n'existe deja.
  insert into public.radar_company_relationship
    (radar_account_id, company_key, relationship_status, updated_by)
  values
    (v_account_id, v_key, 'a_qualifier', v_uid)
  on conflict (radar_account_id, company_key) do nothing;

  -- Mission. Si une mission existe deja pour ce compte sur ce salon
  -- (preparation anterieure), on ne l'ecrase pas : on la marque visitee.
  insert into public.radar_missions
    (radar_account_id, company_key, crm_company_id, event_id, id_exposant,
     manual_company_name, origin, visited, visited_at, ai_field_sources, created_by, updated_at)
  values
    (v_account_id, v_key, v_company_id, p_event_id, v_id_exposant,
     null, 'rencontre', true, now(), '{}'::jsonb, v_uid, now())
  on conflict (radar_account_id, company_key, event_id) do update set
     crm_company_id = coalesce(radar_missions.crm_company_id, excluded.crm_company_id),
     id_exposant    = coalesce(radar_missions.id_exposant, excluded.id_exposant),
     visited        = true,
     visited_at     = coalesce(radar_missions.visited_at, now()),
     updated_at     = now()
  returning id into v_mission_id;

  return v_mission_id;
end;
$function$;

grant execute on function public.add_radar_terrain_encounter(uuid, text, text) to authenticated;

comment on function public.add_radar_terrain_encounter(uuid, text, text) is
  'Mode Salon : ajoute une entreprise rencontree. Sans p_id_exposant, note locale hors CRM. Avec p_id_exposant, cree un compte Radar reel en veille (a_qualifier), son match confirme et sa mission.';
