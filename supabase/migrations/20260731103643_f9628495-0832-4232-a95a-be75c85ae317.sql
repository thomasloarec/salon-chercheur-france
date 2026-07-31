create or replace function public.merge_exposants_manual(
  p_canonical_id_exposant text,
  p_variant_id_exposants text[],
  p_reason text
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v text; v_canon_id int; v_canon_nom text; v_var_id int;
  v_moved uuid[]; v_deleted jsonb; n int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'merge_exposants_manual: admin uniquement';
  end if;

  select id, nom_exposant into v_canon_id, v_canon_nom
  from public.exposants where id_exposant = p_canonical_id_exposant;
  if v_canon_id is null then raise exception 'canonique introuvable: %', p_canonical_id_exposant; end if;

  foreach v in array p_variant_id_exposants loop
    if v = p_canonical_id_exposant then continue; end if;
    select id into v_var_id from public.exposants where id_exposant = v;
    if v_var_id is null then continue; end if;

    if v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' and p_canonical_id_exposant !~ '^[0-9a-f]{8}-[0-9a-f]{4}-' then
      raise exception 'variante % est une fiche revendiquee (uuid) : elle doit etre le canonique', v;
    end if;

    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_deleted
    from public.participation p
    where p.id_exposant = v and p.id_event_text is not null
      and exists (select 1 from public.participation q
                  where q.id_exposant = p_canonical_id_exposant and q.id_event_text = p.id_event_text);
    delete from public.participation p
    where p.id_exposant = v and p.id_event_text is not null
      and exists (select 1 from public.participation q
                  where q.id_exposant = p_canonical_id_exposant and q.id_event_text = p.id_event_text);

    v_moved := '{}';
    with moved as (
      update public.participation p set id_exposant = p_canonical_id_exposant
      where p.id_exposant = v returning p.id_participation
    ) select coalesce(array_agg(id_participation), '{}') into v_moved from moved;

    update public.exposants
      set is_canonical = false, canonical_id = v_canon_id, dedup_status = 'merged', merged_at = now()
    where id = v_var_id;

    insert into public.exposant_merge_log(
      canonical_id_exposant, merged_id_exposant, canonical_id, merged_id,
      canonical_nom, merged_nom, merged_website, merged_domain,
      merge_reason, confidence, origin, airtable_action,
      airtable_current_value, airtable_target_value,
      applied, participations_moved, moved_participation_ids, deleted_participations,
      touches_exhibitor, applied_by)
    select p_canonical_id_exposant, v, v_canon_id, v_var_id,
      v_canon_nom, ex.nom_exposant, ex.website_exposant, public.web_domain(ex.website_exposant),
      p_reason, 'manual',
      case when v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' then 'uuid_lotexpo' else 'airtable' end,
      case when v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' then 'none' else 'delete' end,
      ex.nom_exposant, v_canon_nom,
      true, coalesce(array_length(v_moved,1),0), v_moved, v_deleted,
      (v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-'), auth.uid()
    from public.exposants ex where ex.id = v_var_id;

    n := n + 1;
  end loop;

  update public.exposants set dedup_status = 'canonical'
  where id = v_canon_id and dedup_status is distinct from 'canonical';

  return n;
end $$;
revoke all on function public.merge_exposants_manual(text, text[], text) from public, anon;
grant execute on function public.merge_exposants_manual(text, text[], text) to authenticated, service_role;

create or replace function public.resolve_exposant_review_merge(
  p_review_id uuid,
  p_action text,
  p_canonical_id_exposant text default null,
  p_variant_id_exposants text[] default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'resolve_exposant_review_merge: admin uniquement';
  end if;
  select * into r from public.exposant_duplicate_reviews where id = p_review_id;
  if not found then raise exception 'revue introuvable'; end if;

  if p_action = 'merge' then
    if p_canonical_id_exposant is null or p_variant_id_exposants is null then
      raise exception 'canonique et variantes requis pour une fusion';
    end if;
    perform public.merge_exposants_manual(p_canonical_id_exposant, p_variant_id_exposants, 'manual_' || r.kind);
    update public.exposant_duplicate_reviews
      set status='resolved',
          resolution=jsonb_build_object('action','merge','canonical',p_canonical_id_exposant,'variants',to_jsonb(p_variant_id_exposants)),
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id = p_review_id;
  elsif p_action = 'distinct' then
    update public.exposant_duplicate_reviews
      set status='dismissed', resolution=jsonb_build_object('action','distinct'),
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id = p_review_id;
  else
    raise exception 'action inconnue: %', p_action;
  end if;
end $$;
revoke all on function public.resolve_exposant_review_merge(uuid, text, text, text[]) from public, anon;
grant execute on function public.resolve_exposant_review_merge(uuid, text, text, text[]) to authenticated, service_role;

create or replace function public.resolve_exposant_review_domain(
  p_review_id uuid,
  p_verdict text
) returns void
language plpgsql security definer set search_path = public as $$
declare r record; m text;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'resolve_exposant_review_domain: admin uniquement';
  end if;
  select * into r from public.exposant_duplicate_reviews where id = p_review_id;
  if not found then raise exception 'revue introuvable'; end if;

  if p_verdict = 'groupe' then
    update public.exposant_duplicate_reviews
      set status='dismissed', resolution=jsonb_build_object('verdict','groupe','domaine',r.reasons->>'domaine'),
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id = p_review_id;

  elsif p_verdict = 'salon' then
    foreach m in array r.member_id_exposants loop
      insert into public.exposant_merge_log(
        canonical_id_exposant, merged_id_exposant, canonical_nom, merged_nom,
        merged_website, merged_domain, merge_reason, confidence, origin,
        airtable_action, airtable_current_value, airtable_target_value, applied, applied_by)
      select ex.id_exposant, ex.id_exposant, ex.nom_exposant, ex.nom_exposant,
        ex.website_exposant, public.web_domain(ex.website_exposant), 'salon_domain_fix', 'manual',
        case when ex.id_exposant ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' then 'uuid_lotexpo' else 'airtable' end,
        'fix_domain', public.web_domain(ex.website_exposant), null, true, auth.uid()
      from public.exposants ex where ex.id_exposant = m;
    end loop;
    update public.exposant_duplicate_reviews
      set status='resolved', resolution=jsonb_build_object('verdict','salon','domaine',r.reasons->>'domaine'),
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id = p_review_id;
  else
    raise exception 'verdict inconnu: %', p_verdict;
  end if;
end $$;
revoke all on function public.resolve_exposant_review_domain(uuid, text) from public, anon;
grant execute on function public.resolve_exposant_review_domain(uuid, text) to authenticated, service_role;