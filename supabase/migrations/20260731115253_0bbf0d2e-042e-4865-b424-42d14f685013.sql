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
    perform public.merge_exposants_manual(p_canonical_id_exposant, p_variant_id_exposants, 'manual');
    update public.exposant_duplicate_reviews
      set status='resolved',
          resolution=jsonb_build_object('action','merge','kind',r.kind,'canonical',p_canonical_id_exposant,'variants',to_jsonb(p_variant_id_exposants)),
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id = p_review_id;
  elsif p_action = 'distinct' then
    update public.exposant_duplicate_reviews
      set status='dismissed', resolution=jsonb_build_object('action','distinct','kind',r.kind),
          reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id = p_review_id;
  else
    raise exception 'action inconnue: %', p_action;
  end if;
end $$;