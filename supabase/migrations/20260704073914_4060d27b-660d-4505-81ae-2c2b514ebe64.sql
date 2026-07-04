-- =====================================================================
-- RADAR CRM · Mode Mission · Notes vocales IA — RUN BACKEND-INFRA
-- Couche unique : DB (colonne source, table voice notes, 2 RPC) + Storage.
-- NE contient PAS : Edge Function, config.toml, front, projection
-- get_radar_salon_missions (runs suivants). Idempotent.
--
-- NOTE : le bucket privé 'radar-voice-notes' (public=false, 25 MiB,
-- allowed_mime_types = {audio/webm,audio/mp4,audio/mpeg,audio/wav}) est
-- géré hors migration SQL (création via l'outil Storage dédié) car les
-- écritures dans storage.buckets sont bloquées en migration. Seules les
-- policies storage.objects (section 6) sont posées ici.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Marqueur "source" sur notes et tâches ("voice" | "manual" | NULL).
--    NULL = saisie manuelle (comportement existant, RPC add_* inchangées).
-- ---------------------------------------------------------------------
alter table public.radar_mission_notes add column if not exists source text;
alter table public.radar_mission_tasks add column if not exists source text;

alter table public.radar_mission_notes drop constraint if exists radar_mission_notes_source_check;
alter table public.radar_mission_notes add  constraint radar_mission_notes_source_check
  check (source is null or source in ('voice','manual'));

alter table public.radar_mission_tasks drop constraint if exists radar_mission_tasks_source_check;
alter table public.radar_mission_tasks add  constraint radar_mission_tasks_source_check
  check (source is null or source in ('voice','manual'));

-- ---------------------------------------------------------------------
-- 2) Table radar_mission_voice_notes (cycle de vie de la note vocale).
-- ---------------------------------------------------------------------
create table if not exists public.radar_mission_voice_notes (
  id                     uuid primary key default gen_random_uuid(),
  radar_account_id       uuid not null,
  mission_id             uuid not null references public.radar_missions(id) on delete cascade,
  created_by             uuid,
  event_id               uuid,
  company_key            text,
  audio_storage_path     text not null,
  audio_mime_type        text not null,
  audio_duration_seconds integer,
  status                 text not null default 'uploaded'
    check (status in ('uploaded','transcribing','analyzing','ready_for_review','validated','failed')),
  transcript_raw         text,
  summary_note           text,
  structured_payload     jsonb,
  error_message          text,
  created_note_id        uuid references public.radar_mission_notes(id) on delete set null,
  created_task_ids       uuid[],
  created_at             timestamptz not null default now(),
  processed_at           timestamptz,
  validated_at           timestamptz,
  deleted_audio_at       timestamptz
);

create index if not exists idx_radar_voice_notes_mission
  on public.radar_mission_voice_notes (mission_id);
create index if not exists idx_radar_voice_notes_account_status
  on public.radar_mission_voice_notes (radar_account_id, status);

alter table public.radar_mission_voice_notes enable row level security;

grant select, insert, update, delete on public.radar_mission_voice_notes to authenticated;
grant all on public.radar_mission_voice_notes to service_role;

drop policy if exists radar_mission_voice_notes_member_all on public.radar_mission_voice_notes;
create policy radar_mission_voice_notes_member_all
  on public.radar_mission_voice_notes
  for all
  to authenticated
  using      (is_radar_member(radar_account_id, auth.uid()) or is_admin())
  with check (is_radar_member(radar_account_id, auth.uid()) or is_admin());

-- ---------------------------------------------------------------------
-- 3) RPC create_radar_mission_voice_note.
--    Contrat identique à add_radar_mission_note : le front n'envoie que
--    crm_company_id + event_id ; le serveur dérive mission_id /
--    radar_account_id / company_key via upsert_radar_mission (hérite du
--    scoping import + résolution workspace, aucun code dupliqué).
--    Le front génère l'UUID (= chemin Storage {uid}/{id}.{ext}).
-- ---------------------------------------------------------------------
create or replace function public.create_radar_mission_voice_note(
  p_crm_company_id         uuid,
  p_event_id               uuid,
  p_id                     uuid,
  p_audio_storage_path     text,
  p_audio_mime_type        text,
  p_audio_duration_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_mission_id  uuid;
  v_account_id  uuid;
  v_company_key text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- défense : l'audio ne peut vivre que dans le dossier de l'appelant
  if p_audio_storage_path is null
     or not starts_with(p_audio_storage_path, v_uid::text || '/') then
    raise exception 'invalid_storage_path';
  end if;

  if p_audio_mime_type is null then
    raise exception 'missing_mime_type';
  end if;

  -- get-or-create mission (même délégation que add_radar_mission_note)
  v_mission_id := upsert_radar_mission(p_crm_company_id, p_event_id);

  select radar_account_id, company_key
    into v_account_id, v_company_key
    from public.radar_missions
   where id = v_mission_id;

  if v_account_id is null then
    raise exception 'mission_resolution_failed';
  end if;

  insert into public.radar_mission_voice_notes (
    id, radar_account_id, mission_id, created_by, event_id, company_key,
    audio_storage_path, audio_mime_type, audio_duration_seconds, status
  ) values (
    p_id, v_account_id, v_mission_id, v_uid, p_event_id, v_company_key,
    p_audio_storage_path, p_audio_mime_type, p_audio_duration_seconds, 'uploaded'
  )
  on conflict (id) do nothing;   -- idempotent sur retry réseau (id client)

  return p_id;
end;
$$;

grant execute on function
  public.create_radar_mission_voice_note(uuid,uuid,uuid,text,text,integer)
  to authenticated;

-- ---------------------------------------------------------------------
-- 4) RPC validate_radar_voice_note (atomique, idempotente).
--    Insère la note (par mission_id) + les tâches cochées, relie les
--    artefacts à la ligne voice-note, passe status='validated'.
--    p_checked_tasks : jsonb array de { "body": text, "due_at": iso|null }
-- ---------------------------------------------------------------------
create or replace function public.validate_radar_voice_note(
  p_voice_note_id  uuid,
  p_edited_summary text,
  p_checked_tasks  jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_vn       public.radar_mission_voice_notes%rowtype;
  v_note_id  uuid;
  v_task_ids uuid[] := '{}'::uuid[];
  v_task_id  uuid;
  v_task     jsonb;
  v_tasks    jsonb;
  v_due_at   timestamptz;
  v_body     text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_vn
    from public.radar_mission_voice_notes
   where id = p_voice_note_id;

  if not found then
    raise exception 'voice_note_not_found';
  end if;

  if not (is_radar_member(v_vn.radar_account_id, v_uid) or is_admin()) then
    raise exception 'no_access';
  end if;

  -- idempotence : déjà validée -> renvoyer les artefacts existants
  if v_vn.status = 'validated' then
    return jsonb_build_object(
      'voice_note_id',     v_vn.id,
      'status',            'validated',
      'note_id',           v_vn.created_note_id,
      'task_ids',          to_jsonb(coalesce(v_vn.created_task_ids,'{}'::uuid[])),
      'already_validated', true
    );
  end if;

  if v_vn.status <> 'ready_for_review' then
    raise exception 'not_ready_for_review';   -- on ne valide qu'une analyse terminée
  end if;

  -- 1) note (par mission_id — la mission existe déjà)
  insert into public.radar_mission_notes (mission_id, radar_account_id, body, created_by, source)
  values (
    v_vn.mission_id,
    v_vn.radar_account_id,
    coalesce(nullif(btrim(p_edited_summary), ''), v_vn.summary_note, ''),
    v_uid,
    'voice'
  )
  returning id into v_note_id;

  -- 2) tâches cochées (tolère une entrée malformée sans casser la validation)
  v_tasks := case
    when p_checked_tasks is not null and jsonb_typeof(p_checked_tasks) = 'array'
    then p_checked_tasks else '[]'::jsonb
  end;

  for v_task in select value from jsonb_array_elements(v_tasks) loop
    v_body := btrim(coalesce(v_task->>'body',''));
    if v_body = '' then
      continue;
    end if;

    v_due_at := null;
    if nullif(btrim(coalesce(v_task->>'due_at','')), '') is not null then
      begin
        v_due_at := (v_task->>'due_at')::timestamptz;
      exception when others then
        v_due_at := null;   -- date invalide tolérée
      end;
    end if;

    insert into public.radar_mission_tasks (mission_id, radar_account_id, body, due_at, created_by, source)
    values (v_vn.mission_id, v_vn.radar_account_id, v_body, v_due_at, v_uid, 'voice')
    returning id into v_task_id;

    v_task_ids := array_append(v_task_ids, v_task_id);
  end loop;

  -- 3) liaison + bascule statut (atomique dans la même transaction)
  update public.radar_mission_voice_notes
     set status           = 'validated',
         summary_note     = coalesce(nullif(btrim(p_edited_summary), ''), summary_note),
         created_note_id  = v_note_id,
         created_task_ids = v_task_ids,
         validated_at     = now()
   where id = p_voice_note_id;

  return jsonb_build_object(
    'voice_note_id',     p_voice_note_id,
    'status',            'validated',
    'note_id',           v_note_id,
    'task_ids',          to_jsonb(v_task_ids),
    'already_validated', false
  );
end;
$$;

grant execute on function
  public.validate_radar_voice_note(uuid,text,jsonb)
  to authenticated;

-- ---------------------------------------------------------------------
-- 5) Bucket privé radar-voice-notes.
--    (géré hors migration SQL — voir note d'en-tête)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 6) Policies storage.objects — keyées sur {uid} en 1er segment.
--    Chemin : radar-voice-notes/{auth.uid()}/{voice_note_id}.{ext}
--    L'Edge Function lira le fichier en service_role (bypass RLS).
-- ---------------------------------------------------------------------
drop policy if exists "radar voice notes insert own" on storage.objects;
create policy "radar voice notes insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'radar-voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "radar voice notes select own" on storage.objects;
create policy "radar voice notes select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'radar-voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "radar voice notes update own" on storage.objects;
create policy "radar voice notes update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'radar-voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'radar-voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "radar voice notes delete own" on storage.objects;
create policy "radar voice notes delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'radar-voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );