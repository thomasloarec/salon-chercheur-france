do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.exposant_duplicate_reviews'::regclass
    and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%';
  if c is not null then
    execute format('alter table public.exposant_duplicate_reviews drop constraint %I', c);
  end if;
end $$;

alter table public.exposant_duplicate_reviews
  add constraint exposant_duplicate_reviews_kind_check
  check (kind in ('name_conflict','salon_domain','fuzzy_pair','domain_group'));

create or replace function public.detect_exposant_domain_duplicates()
returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'detect_exposant_domain_duplicates: admin uniquement';
  end if;

  delete from public.exposant_duplicate_reviews
  where kind = 'domain_group' and status = 'review_required'
    and reasons->>'generated' = 'domain_v1';

  drop table if exists _dbase;
  create temp table _dbase on commit drop as
  select id_exposant, nom_exposant, nom_normalized AS nn,
         web_domain(website_exposant) AS dom,
         (regexp_match(web_domain(website_exposant), '([^.]+)\.[^.]+$'))[1] AS brand_root
  from public.exposants
  where dedup_status <> 'merged' and web_domain(website_exposant) is not null;
  create index on _dbase (brand_root);

  drop table if exists _dpairs;
  create temp table _dpairs on commit drop as
  select a.brand_root, a.id_exposant AS ida, b.id_exposant AS idb
  from _dbase a
  join _dbase b on a.brand_root = b.brand_root and a.id_exposant < b.id_exposant
  where length(a.brand_root) >= 3 and a.nn <> b.nn
    and (a.nn like b.nn || '%' or b.nn like a.nn || '%'
         or a.nn like '%' || b.nn || '%' or b.nn like '%' || a.nn || '%');

  drop table if exists _dmembers;
  create temp table _dmembers on commit drop as
  select brand_root, ida AS id_exposant from _dpairs
  union
  select brand_root, idb from _dpairs;

  with grp as (
    select m.brand_root,
           array_agg(distinct m.id_exposant) AS members,
           count(distinct m.id_exposant) AS n_members
    from _dmembers m
    group by m.brand_root
    having count(distinct m.id_exposant) between 2 and 6
  )
  insert into public.exposant_duplicate_reviews(kind, member_id_exposants, score, reasons, status)
  select 'domain_group', g.members, g.n_members,
    jsonb_build_object(
      'generated','domain_v1',
      'brand_root', g.brand_root,
      'noms',     (select array_agg(distinct d.nom_exposant) from _dbase d where d.id_exposant = any(g.members)),
      'domaines', (select array_agg(distinct d.dom)          from _dbase d where d.id_exposant = any(g.members))
    ),
    'review_required'
  from grp g;

  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.detect_exposant_domain_duplicates() from public, anon;
grant execute on function public.detect_exposant_domain_duplicates() to authenticated, service_role;