-- =====================================================================
-- Prise de notes sur une entreprise rencontree hors CRM (Mode Salon).
-- V1 : une seule origine 'rencontre'. crm_company_id reste null.
-- Applique en prod le 16/08/2026 via Supabase MCP, verifie bout en bout
-- (creation rencontre + note + remontee dans get_radar_salon_missions,
--  non-regression des entreprises CRM confirmee). A committer.
-- =====================================================================

-- 1. Colonne pour le nom saisi librement.
alter table public.radar_missions
  add column if not exists manual_company_name text default null;

comment on column public.radar_missions.manual_company_name is
  'Nom saisi librement pour une entreprise rencontree hors CRM (origin=rencontre). NULL pour les missions ordinaires.';

-- 2. Creer une rencontre a partir d'un nom. company_key prefixee 'manual:'
--    pour ne JAMAIS entrer en collision avec une entreprise du CRM.
create or replace function public.add_radar_terrain_encounter(
  p_event_id uuid,
  p_name text
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
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_name = '' then raise exception 'empty_name'; end if;

  v_account_id := public.radar_current_account_id(v_uid);
  if v_account_id is null or not public.has_radar_access(v_uid) then raise exception 'no_access'; end if;

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found';
  end if;

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
end;
$function$;

-- 3. Ajouter une note a une mission deja creee, sans exiger crm_company_id.
create or replace function public.add_radar_mission_note_by_mission(
  p_mission_id uuid,
  p_body text
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_mission_account uuid;
  v_note_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_body is null or length(btrim(p_body)) = 0 then raise exception 'empty_body'; end if;

  v_account_id := public.radar_current_account_id(v_uid);
  if v_account_id is null then raise exception 'no_access'; end if;

  select radar_account_id into v_mission_account from public.radar_missions where id = p_mission_id;
  if v_mission_account is null then raise exception 'mission_not_found'; end if;
  if v_mission_account <> v_account_id then raise exception 'forbidden'; end if;

  insert into public.radar_mission_notes (mission_id, radar_account_id, body, created_by)
  values (p_mission_id, v_account_id, p_body, v_uid)
  returning id into v_note_id;

  return v_note_id;
end;
$function$;

grant execute on function public.add_radar_terrain_encounter(uuid, text) to authenticated;
grant execute on function public.add_radar_mission_note_by_mission(uuid, text) to authenticated;

-- 4. get_radar_salon_missions etendu : inclut les rencontres manuelles (crm_company_id null).
--    Voir le fichier de migration livre pour le corps complet (branche v_manual ajoutee,
--    concatenee a v_companies). Deploye en prod le 16/08/2026.
