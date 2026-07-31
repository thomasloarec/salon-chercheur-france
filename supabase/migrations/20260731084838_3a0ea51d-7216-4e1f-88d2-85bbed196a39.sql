alter table public.exposant_merge_log add column if not exists applied boolean not null default false;
alter table public.exposant_merge_log add column if not exists plan_batch_id uuid;
alter table public.exposant_merge_log add column if not exists touches_exhibitor boolean not null default false;
alter table public.exposant_merge_log add column if not exists note text;
create index if not exists idx_merge_log_applied on public.exposant_merge_log(applied);

create or replace view public.v_exposant_cleanup_actions
with (security_invoker = on, security_barrier = on) as
select
  l.id, l.created_at, l.origin, l.airtable_action,
  l.merged_id_exposant     as id_exposant_a_corriger,
  l.merged_nom             as nom_actuel,
  l.airtable_current_value as valeur_actuelle,
  l.airtable_target_value  as valeur_cible,
  l.canonical_id_exposant  as id_exposant_canonique,
  l.canonical_nom          as nom_canonique,
  l.merge_reason, l.confidence, l.participations_moved, l.moved_participation_ids
from public.exposant_merge_log l
where l.reverted = false and l.applied = true
  and l.origin = 'airtable' and l.airtable_action <> 'none'
order by l.created_at desc;
revoke all on public.v_exposant_cleanup_actions from anon;

create or replace function public.exposant_reg_domain(p_raw text)
returns text language sql immutable set search_path='public' as $$
  select (regexp_match(public.web_domain(p_raw), '([^.]+\.[^.]+)$'))[1];
$$;

create or replace function public.build_exposant_dedup_plan(p_fuzzy_threshold numeric default 0.78)
returns table(poche text, volume bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare v_batch uuid := gen_random_uuid();
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'build_exposant_dedup_plan: admin uniquement';
  end if;

  delete from public.exposant_merge_log where applied = false;
  delete from public.exposant_duplicate_reviews
    where status = 'review_required' and reasons->>'generated' = 'auto_v1';

  create temp table _b on commit drop as
  select e.id, e.id_exposant, e.nom_exposant, e.website_exposant, e.nom_normalized nn,
    public.web_domain(e.website_exposant) dom,
    public.exposant_reg_domain(e.website_exposant) reg,
    nullif(regexp_replace(coalesce(e.nom_normalized,''),'[^a-z0-9]','','g'),'') nn_compact,
    nullif(regexp_replace(split_part(public.web_domain(e.website_exposant),'.',1),'[^a-z0-9]','','g'),'') root,
    (e.id_exposant ~ '^[0-9a-f]{8}-[0-9a-f]{4}-') is_uuid,
    (select count(*) from public.participation p where p.id_exposant = e.id_exposant) n_part
  from public.exposants e
  where e.nom_normalized is not null and e.nom_normalized <> '';

  create temp table _g on commit drop as
  select nn,
    count(*) n_rows,
    count(distinct reg) filter (where reg is not null) n_reg,
    bool_or(is_uuid) has_uuid,
    bool_or(root is not null and nn_compact is not null
            and (root = nn_compact or root like nn_compact||'%' or nn_compact like root||'%')) name_matches_root
  from _b group by nn having count(*) > 1;

  create temp table _canon on commit drop as
  select distinct on (b.nn) b.nn, b.id canon_id, b.id_exposant canon_key, b.nom_exposant canon_nom
  from _b b join _g g on g.nn = b.nn
  where g.n_reg <= 1 or g.name_matches_root
  order by b.nn,
    b.is_uuid desc,
    (b.root is not null and b.nn_compact is not null
       and (b.root = b.nn_compact or b.root like b.nn_compact||'%' or b.nn_compact like b.root||'%')) desc,
    b.n_part desc,
    b.id asc;

  insert into public.exposant_merge_log(
    canonical_id_exposant, merged_id_exposant, canonical_id, merged_id,
    canonical_nom, merged_nom, merged_website, merged_domain,
    merge_reason, confidence, origin, airtable_action,
    airtable_current_value, airtable_target_value,
    applied, plan_batch_id, touches_exhibitor, note)
  select c.canon_key, b.id_exposant, c.canon_id, b.id,
    c.canon_nom, b.nom_exposant, b.website_exposant, b.dom,
    case when g.name_matches_root then 'name_matches_root' else 'same_domain_root' end,
    'auto',
    case when b.is_uuid then 'uuid_lotexpo' else 'airtable' end,
    case when b.is_uuid then 'none' else 'delete' end,
    b.nom_exposant, c.canon_nom,
    false, v_batch, g.has_uuid,
    case when g.has_uuid then 'Groupe lie a une fiche exhibitors : canonique = fiche revendiquee, verifier le lien' else null end
  from _b b join _g g on g.nn = b.nn join _canon c on c.nn = b.nn
  where (g.n_reg <= 1 or g.name_matches_root) and b.id <> c.canon_id;

  insert into public.exposant_duplicate_reviews(kind, member_id_exposants, reasons, status)
  select 'name_conflict',
    array_agg(b.id_exposant order by b.id_exposant),
    jsonb_build_object('generated','auto_v1','nom_normalise', b.nn,
      'noms', array_agg(distinct b.nom_exposant),
      'domaines', array_agg(distinct b.dom) filter (where b.dom is not null)),
    'review_required'
  from _b b join _g g on g.nn = b.nn
  where not (g.n_reg <= 1 or g.name_matches_root)
  group by b.nn;

  insert into public.exposant_duplicate_reviews(kind, member_id_exposants, score, reasons, status)
  select 'salon_domain', d.ids, d.n_names,
    jsonb_build_object('generated','auto_v1','domaine', d.dom,
      'entreprises_distinctes', d.n_names,
      'action','taguer SALON (corriger/supprimer les lignes) ou GROUPE (aucune action)'),
    'review_required'
  from (
    select dom, count(distinct nn) n_names, array_agg(distinct id_exposant) ids
    from _b where dom is not null group by dom having count(distinct nn) >= 3
  ) d;

  insert into public.exposant_duplicate_reviews(kind, member_id_exposants, score, reasons, status)
  select 'fuzzy_pair',
    (select array_agg(distinct id_exposant) from _b where nn in (pr.nna, pr.nnb)),
    round(pr.s * 100)::int,
    jsonb_build_object('generated','auto_v1','nom_a', pr.nna, 'nom_b', pr.nnb, 'similarite', round(pr.s,3)),
    'review_required'
  from (
    select a.nn nna, c.nn nnb, similarity(a.nn, c.nn) s
    from (select distinct nn, left(nn,4) blk from _b where length(nn) >= 4) a
    join (select distinct nn, left(nn,4) blk from _b where length(nn) >= 4) c
      on a.blk = c.blk and a.nn < c.nn and similarity(a.nn, c.nn) > p_fuzzy_threshold
  ) pr;

  return query
  select 'plan_variantes_auto'::text, count(*) from public.exposant_merge_log where applied = false
  union all select 'dont_groupes_lies_exhibitors', count(*) from public.exposant_merge_log where applied = false and touches_exhibitor
  union all select 'revue_conflits_nom', count(*) from public.exposant_duplicate_reviews where kind='name_conflict' and reasons->>'generated'='auto_v1'
  union all select 'revue_domaines_suspects', count(*) from public.exposant_duplicate_reviews where kind='salon_domain' and reasons->>'generated'='auto_v1'
  union all select 'revue_paires_floues', count(*) from public.exposant_duplicate_reviews where kind='fuzzy_pair' and reasons->>'generated'='auto_v1';
end $$;

revoke all on function public.build_exposant_dedup_plan(numeric) from public, anon;
grant execute on function public.build_exposant_dedup_plan(numeric) to authenticated, service_role;