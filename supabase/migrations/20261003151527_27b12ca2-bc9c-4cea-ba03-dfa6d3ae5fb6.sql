-- Assistant « Pépites », lot 4 bis : un retour positif pèse moins sur le vecteur de sa piste.
-- Constat de la boucle à blanc du 03/10 : deux ajouts à l'agenda de Nouveautés « drones » (profil Standex)
-- ont fait passer le salon UAV Show de 2 à 6 pépites. Le poids des pépites aimées passe de 0,35 à 0,20.
-- Seule la fonction assistant_tune_pistes change ; ses droits sont conservés (create or replace).

create or replace function public.assistant_tune_pistes(p_profile_id uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c_like constant real := 0.20;
  c_dis  constant real := 0.15;
  r      record;
  v_dim  integer;
  v_like vector; v_wl double precision;
  v_dis  vector; v_wd double precision;
  v_new  vector;
  n      integer := 0;
begin
  for r in
    select p.id, p.embedding from public.assistant_pistes p
    where p.profile_id = p_profile_id and p.active and p.embedding is not null
  loop
    v_dim := vector_dims(r.embedding);

    with fb as (
      select f.item_type, f.item_id, public.assistant_feedback_weight(f.created_at) as w,
             case when f.signal in ('agenda', 'inscription', 'rdv') then 1 else -1 end as dir
      from public.assistant_feedback f
      where f.profile_id = p_profile_id and f.piste_id = r.id and f.undone_at is null
        and (f.signal in ('agenda', 'inscription', 'rdv')
             or (f.signal = 'pas_pour_moi' and (f.reason is null or f.reason = 'sujet')))
    ), emb as (
      select fb.dir, fb.w, coalesce(se.embedding, ne.embedding) as e
      from fb
      left join public.session_embeddings se on fb.item_type = 'session' and se.session_id = fb.item_id
      left join public.novelty_embeddings ne on fb.item_type = 'novelty' and ne.novelty_id = fb.item_id
    )
    select sum(l2_normalize(emb.e) * array_fill(emb.w::real, array[v_dim])::vector) filter (where emb.dir = 1 and emb.e is not null),
           sum(emb.w) filter (where emb.dir = 1 and emb.e is not null),
           sum(l2_normalize(emb.e) * array_fill(emb.w::real, array[v_dim])::vector) filter (where emb.dir = -1 and emb.e is not null),
           sum(emb.w) filter (where emb.dir = -1 and emb.e is not null)
      into v_like, v_wl, v_dis, v_wd
    from emb;

    if coalesce(v_wl, 0) = 0 and coalesce(v_wd, 0) = 0 then
      update public.assistant_pistes set embedding_tuned = null, tuned_at = now()
       where id = r.id and embedding_tuned is not null;
      continue;
    end if;

    v_new := l2_normalize(r.embedding);
    if coalesce(v_wl, 0) > 0 then
      v_new := v_new + v_like * array_fill((c_like / v_wl)::real, array[v_dim])::vector;
    end if;
    if coalesce(v_wd, 0) > 0 then
      v_new := v_new - v_dis * array_fill((c_dis / v_wd)::real, array[v_dim])::vector;
    end if;

    update public.assistant_pistes set embedding_tuned = l2_normalize(v_new), tuned_at = now()
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end
$$;

notify pgrst, 'reload schema';