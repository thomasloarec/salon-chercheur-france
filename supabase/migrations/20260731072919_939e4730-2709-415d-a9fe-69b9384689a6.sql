-- 2.1 exposants : colonnes de canonisation
alter table public.exposants add column if not exists canonical_id integer;
alter table public.exposants add column if not exists is_canonical boolean not null default true;
alter table public.exposants add column if not exists dedup_status text not null default 'unprocessed';
alter table public.exposants add column if not exists merged_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='exposants_canonical_id_fkey') then
    alter table public.exposants
      add constraint exposants_canonical_id_fkey
      foreign key (canonical_id) references public.exposants(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='exposants_dedup_status_check') then
    alter table public.exposants
      add constraint exposants_dedup_status_check
      check (dedup_status in ('unprocessed','canonical','merged','under_review','blocked'));
  end if;
end $$;

create index if not exists idx_exposants_canonical_id on public.exposants(canonical_id);
create index if not exists idx_exposants_dedup_status on public.exposants(dedup_status);

-- 2.2 exposant_merge_log
create table if not exists public.exposant_merge_log (
  id uuid primary key default gen_random_uuid(),
  canonical_id_exposant text not null,
  merged_id_exposant   text not null,
  canonical_id integer,
  merged_id    integer,
  canonical_nom   text,
  merged_nom      text,
  merged_website  text,
  merged_domain   text,
  merge_reason text not null check (merge_reason in
    ('same_domain_root','name_matches_root','fuzzy_confirmed','salon_domain_fix','manual')),
  confidence   text not null default 'auto' check (confidence in ('auto','review','manual')),
  participations_moved integer not null default 0,
  moved_participation_ids uuid[] not null default '{}',
  origin text not null check (origin in ('airtable','uuid_lotexpo')),
  airtable_action text not null default 'none' check (airtable_action in ('rename','delete','fix_domain','none')),
  airtable_current_value text,
  airtable_target_value  text,
  reverted boolean not null default false,
  reverted_at timestamptz,
  reverted_by uuid,
  applied_by uuid,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.exposant_merge_log to authenticated;
grant all on public.exposant_merge_log to service_role;

create index if not exists idx_merge_log_canonical on public.exposant_merge_log(canonical_id_exposant);
create index if not exists idx_merge_log_merged    on public.exposant_merge_log(merged_id_exposant);
create index if not exists idx_merge_log_reverted  on public.exposant_merge_log(reverted);
create index if not exists idx_merge_log_airtable  on public.exposant_merge_log(origin, airtable_action) where reverted = false;

-- 2.3 exposant_duplicate_reviews
create table if not exists public.exposant_duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('name_conflict','salon_domain','fuzzy_pair')),
  member_id_exposants text[] not null default '{}',
  score integer,
  confidence text,
  reasons jsonb not null default '{}'::jsonb,
  status text not null default 'review_required' check (status in ('review_required','resolved','dismissed')),
  resolution jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.exposant_duplicate_reviews to authenticated;
grant all on public.exposant_duplicate_reviews to service_role;

create index if not exists idx_expo_reviews_status on public.exposant_duplicate_reviews(status);
create index if not exists idx_expo_reviews_kind   on public.exposant_duplicate_reviews(kind);

-- 2.4 staging_exposants_import
create table if not exists public.staging_exposants_import (
  id uuid primary key default gen_random_uuid(),
  id_exposant text,
  airtable_id text,
  nom_exposant text,
  website_exposant text,
  exposant_description text,
  id_event_text text,
  urlexpo_event text,
  stand_exposant text,
  nom_normalized text,
  normalized_domain text,
  import_batch_id uuid,
  match_status text not null default 'pending'
    check (match_status in ('pending','new','alias_known','salon_domain','auto_matched','needs_review','blocked')),
  matched_canonical_id_exposant text,
  match_reason text,
  match_score integer,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.staging_exposants_import to authenticated;
grant all on public.staging_exposants_import to service_role;

create index if not exists idx_staging_expo_batch  on public.staging_exposants_import(import_batch_id);
create index if not exists idx_staging_expo_status on public.staging_exposants_import(match_status);
create index if not exists idx_staging_expo_nom_trgm on public.staging_exposants_import using gin (nom_normalized gin_trgm_ops);
create index if not exists idx_staging_expo_domain on public.staging_exposants_import(normalized_domain) where normalized_domain is not null;

-- 2.5 Vue
create or replace view public.v_exposant_cleanup_actions as
select
  l.id,
  l.created_at,
  l.origin,
  l.airtable_action,
  l.merged_id_exposant       as id_exposant_a_corriger,
  l.merged_nom               as nom_actuel,
  l.airtable_current_value   as valeur_actuelle,
  l.airtable_target_value    as valeur_cible,
  l.canonical_id_exposant    as id_exposant_canonique,
  l.canonical_nom            as nom_canonique,
  l.merge_reason,
  l.confidence,
  l.participations_moved,
  l.moved_participation_ids
from public.exposant_merge_log l
where l.reverted = false
  and l.origin = 'airtable'
  and l.airtable_action <> 'none'
order by l.created_at desc;

grant select on public.v_exposant_cleanup_actions to authenticated;
grant select on public.v_exposant_cleanup_actions to service_role;

-- 2.6 RLS
alter table public.exposant_merge_log         enable row level security;
alter table public.exposant_duplicate_reviews enable row level security;
alter table public.staging_exposants_import   enable row level security;

drop policy if exists "admin manage exposant_merge_log" on public.exposant_merge_log;
create policy "admin manage exposant_merge_log" on public.exposant_merge_log
  for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "service_role exposant_merge_log" on public.exposant_merge_log;
create policy "service_role exposant_merge_log" on public.exposant_merge_log
  for all to service_role using (true) with check (true);

drop policy if exists "admin manage exposant_duplicate_reviews" on public.exposant_duplicate_reviews;
create policy "admin manage exposant_duplicate_reviews" on public.exposant_duplicate_reviews
  for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "service_role exposant_duplicate_reviews" on public.exposant_duplicate_reviews;
create policy "service_role exposant_duplicate_reviews" on public.exposant_duplicate_reviews
  for all to service_role using (true) with check (true);

drop policy if exists "admin manage staging_exposants_import" on public.staging_exposants_import;
create policy "admin manage staging_exposants_import" on public.staging_exposants_import
  for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "service_role staging_exposants_import" on public.staging_exposants_import;
create policy "service_role staging_exposants_import" on public.staging_exposants_import
  for all to service_role using (true) with check (true);