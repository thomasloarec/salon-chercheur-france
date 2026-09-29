-- Retrait à la demande de l'organisateur (29/09/2026) :
-- toutes les éditions Congrès Age 3, Handi-4 et Congrès professionnel des personnels
-- de structures d'accueil de la petite enfance (24 salons).
-- Exposants conservés. Participations, campagnes d'outreach, nouveauté associée,
-- séries, redirections de slug et données dérivées supprimées. Tout est archivé
-- dans public.archive_salons_retires avant suppression.

create table if not exists public.archive_salons_retires (
  id bigserial primary key,
  batch text not null,
  source_table text not null,
  row_data jsonb not null,
  archived_at timestamptz not null default now()
);
alter table public.archive_salons_retires enable row level security;
revoke all on public.archive_salons_retires from anon, authenticated;
revoke all on sequence public.archive_salons_retires_id_seq from anon, authenticated;

do $$
declare
  v_batch constant text := 'retrait_organisateur_age3_handi4_petiteenfance_20260929';
  v_ids uuid[] := array[
    'e95f4d98-e942-429c-8c29-54d9a37ddb16','badf2eec-e733-4aed-81af-d7824a704faa','bd410f8e-ee71-49a0-a6f8-14c67f699d5a',
    '8211eba5-6e64-41be-a580-a5c2303a69a4','d84f13c4-8fa2-4e71-8f5a-3d0d7845e21b','0123f1f0-ffb5-458e-aadd-e25be84e0279',
    '78050c37-eca2-4d14-950b-366453d433c8','c5061885-d4a3-4368-ba38-e5db6fd94a7b','235ffadc-abb4-4b42-b573-68a77693d50c',
    'b4f95f6e-8e5a-48b6-9a1f-3dc07e9e47b4','e7aa3eb7-2db5-48f0-9b69-62b2eaa8537d','630c8c49-bb43-4607-9a54-44b4fbd5e719',
    '5a4f4348-97bf-462a-8198-d00d420cab79','c109c2ce-d88a-4d01-9fcf-0af0b88ba54e','dbde879e-2ff9-4606-8155-22b1780bbc01',
    '0ac090d1-289f-4a2d-9d1b-7c3744af5593','5d850a61-b226-4fb8-b48f-8a03cacde811','1c5aacce-38e2-4257-8651-d76e2215d2de',
    '289da287-b1b5-47dc-9621-307df59c5050','2f1ed96f-8bff-49ac-b54c-fe2ae0f53aff','2bb786d1-ba5e-4409-9ace-4bedb8926b83',
    '2ddc68e9-4e22-4a41-a72b-e5f80fcfcb8f','34778c71-accf-4420-8073-bb29ef6420da','883034aa-6aed-477c-b903-26bf55715bf9'
  ]::uuid[];
  v_text_ids text[];
  v_slugs text[];
  v_series uuid[];
  v_camps uuid[];
  v_novs uuid[];
  r record;
  n int;
begin
  -- Garde-fou : exactement les 24 salons attendus
  select count(*) into n from public.events
   where id = any(v_ids)
     and (nom_event ilike 'Congrès Age 3%' or nom_event ilike 'Handi-4%'
          or nom_event ilike 'Congrès professionnel des personnels de structures d%accueil de la petite enfance%');
  if n <> 24 then raise exception 'STOP : % salons correspondants au lieu de 24', n; end if;

  select array_agg(id_event), array_agg(slug), array_agg(distinct series_id) filter (where series_id is not null)
    into v_text_ids, v_slugs, v_series from public.events where id = any(v_ids);
  select array_agg(id) into v_camps from public.outreach_campaigns
   where event_id = any(v_ids)
      or participation_id in (select id_participation from public.participation where id_event = any(v_ids));
  select array_agg(id) into v_novs from public.novelties where event_id = any(v_ids);

  -- Garde-fou : les séries ne portent aucun autre salon
  if exists (select 1 from public.events where series_id = any(v_series) and not (id = any(v_ids))) then
    raise exception 'STOP : une série est partagée avec un autre salon';
  end if;

  -- 1. Archive : salons, puis toutes les tables filles de events (FK)
  insert into public.archive_salons_retires(batch, source_table, row_data)
    select v_batch, 'events', to_jsonb(e) from public.events e where id = any(v_ids);
  for r in
    select c.conrelid::regclass::text as child, a.attname as col, af.attname as pcol
      from pg_constraint c
      join pg_attribute a  on a.attrelid = c.conrelid  and a.attnum  = any(c.conkey)
      join pg_attribute af on af.attrelid = c.confrelid and af.attnum = any(c.confkey)
     where c.contype = 'f' and c.confrelid = 'public.events'::regclass
  loop
    if r.pcol = 'id' then
      execute format('insert into public.archive_salons_retires(batch, source_table, row_data)
                      select $1, %L, to_jsonb(t) from %s t where %I = any($2)', r.child||'.'||r.col, r.child, r.col)
        using v_batch, v_ids;
    else
      execute format('insert into public.archive_salons_retires(batch, source_table, row_data)
                      select $1, %L, to_jsonb(t) from %s t where %I = any($2)', r.child||'.'||r.col, r.child, r.col)
        using v_batch, v_text_ids;
    end if;
  end loop;
  -- Petits-enfants : contacts d'outreach, enfants de la nouveauté, séries, redirections
  insert into public.archive_salons_retires(batch, source_table, row_data)
    select v_batch, 'outreach_contacts', to_jsonb(t) from public.outreach_contacts t where outreach_campaign_id = any(v_camps);
  insert into public.archive_salons_retires(batch, source_table, row_data)
    select v_batch, 'novelty_likes', to_jsonb(t) from public.novelty_likes t where novelty_id = any(v_novs);
  insert into public.archive_salons_retires(batch, source_table, row_data)
    select v_batch, 'exhibitor_claim_requests (avant mise à null source_campaign_id)', to_jsonb(t)
      from public.exhibitor_claim_requests t where source_campaign_id = any(v_camps);
  insert into public.archive_salons_retires(batch, source_table, row_data)
    select v_batch, 'event_series', to_jsonb(t) from public.event_series t where id = any(v_series);
  insert into public.archive_salons_retires(batch, source_table, row_data)
    select v_batch, 'slug_redirects', to_jsonb(t) from public.slug_redirects t
     where new_slug = any(v_slugs) or old_slug = any(v_slugs);

  -- Journal standard des retraits de participation
  insert into public.participation_removal_log(id_event, id_exposant, removed_row, reason, removed_at)
    select p.id_event, p.id_exposant, to_jsonb(p), 'retrait_demande_organisateur_20260929', now()
      from public.participation p where p.id_event = any(v_ids);

  -- 2. Suppressions (ordre FK-safe)
  update public.exhibitor_claim_requests set source_campaign_id = null where source_campaign_id = any(v_camps);
  delete from public.outreach_campaigns where id = any(v_camps);           -- cascade outreach_contacts
  delete from public.participation where id_event = any(v_ids);
  delete from public.events where id = any(v_ids);                         -- cascade : nouveauté, secteurs, favoris, IA, embeddings, similarités, recos...
  delete from public.event_series where id = any(v_series);
  delete from public.slug_redirects where new_slug = any(v_slugs) or old_slug = any(v_slugs);
end $$;

-- Rafraîchissement de public_exhibitor_profiles_mv lancé séparément (hors migration, timeout).
