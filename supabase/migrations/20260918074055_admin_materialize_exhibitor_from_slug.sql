-- 20260918074055_admin_materialize_exhibitor_from_slug.sql
-- Déjà APPLIQUÉE en base via apply_migration (le RPC est actif en production).
-- À committer dans supabase/migrations/ pour la reproductibilité (Vercel ne
-- rejoue pas les migrations ; ce fichier ne fait que documenter l'état appliqué).
--
-- Objet : permettre à un admin Lotexpo d'ouvrir /exposants/:slug/gerer pour
-- n'importe quel exposant (99,6 % sont legacy, exhibitor_id NULL), avec la même
-- parité que l'espace organisateur des salons, sans revendiquer l'entreprise.
-- Idempotent. Le public_slug indexé est préservé : on rattache l'identité
-- publique EXISTANTE à la fiche moderne créée (aucune nouvelle page publique).

create or replace function public.admin_materialize_exhibitor_from_slug(p_public_slug text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_identity_id uuid;
  v_legacy_id text;
  v_exhibitor_id uuid;
  v_link_count integer;
  v_linked uuid;
  v_name text;
  v_website text;
  v_description text;
begin
  -- Garde admin (défense en profondeur : aussi REVOKE de anon plus bas).
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select id, legacy_exposant_id, exhibitor_id
    into v_identity_id, v_legacy_id, v_exhibitor_id
    from public.exhibitor_public_identities
    where public_slug = p_public_slug and is_active = true
    limit 1;

  if v_identity_id is null then
    raise exception 'identity_not_found: %', p_public_slug;
  end if;

  -- Déjà matérialisé -> idempotent, on renvoie la fiche moderne liée.
  if v_exhibitor_id is not null then
    return v_exhibitor_id;
  end if;

  if v_legacy_id is null then
    raise exception 'not_legacy_identity: % (no legacy_exposant_id to promote)', p_public_slug;
  end if;

  -- Anti-doublon : réutiliser une fiche moderne déjà liée via les participations.
  select count(distinct exhibitor_id), (array_agg(distinct exhibitor_id))[1]
    into v_link_count, v_linked
    from public.participation
    where id_exposant = v_legacy_id and exhibitor_id is not null;

  if v_link_count > 1 then
    raise exception 'ambiguous_legacy_link: % (% distinct exhibitors) - manual resolution required',
      v_legacy_id, v_link_count;
  elsif v_link_count = 1 then
    v_exhibitor_id := v_linked;
  else
    -- Créer une fiche moderne, pré-remplie depuis le legacy pour que la page
    -- "gérer" ne soit pas vide. La fiche publique reste inchangée (la vue
    -- COALESCE les mêmes valeurs). Le slug de la fiche moderne est auto-généré
    -- par trigger et reste interne (l'URL publique utilise le public_slug de
    -- l'identité).
    select nullif(btrim(nom_exposant), ''),
           nullif(btrim(website_exposant), ''),
           nullif(btrim(exposant_description), '')
      into v_name, v_website, v_description
      from public.exposants
      where id_exposant = v_legacy_id
      order by id
      limit 1;

    if v_name is null then
      select nullif(btrim(canonical_name), '')
        into v_name
        from public.exhibitor_public_identities
        where id = v_identity_id;
    end if;
    if v_name is null then
      v_name := 'Exposant ' || p_public_slug;
    end if;

    insert into public.exhibitors (name, website, description, approved, is_test, plan)
      values (v_name, v_website, v_description, false, false, 'free')
      returning id into v_exhibitor_id;

    -- Relier les participations de cette entreprise legacy à la fiche moderne.
    update public.participation
      set exhibitor_id = v_exhibitor_id
      where id_exposant = v_legacy_id and exhibitor_id is null;
  end if;

  -- Rattacher l'identité publique EXISTANTE (slug préservé, aucune page créée).
  update public.exhibitor_public_identities
    set exhibitor_id = v_exhibitor_id,
        source_type = 'linked'
    where id = v_identity_id and exhibitor_id is null;

  return v_exhibitor_id;
end;
$function$;

revoke all on function public.admin_materialize_exhibitor_from_slug(text) from public;
revoke all on function public.admin_materialize_exhibitor_from_slug(text) from anon;
grant execute on function public.admin_materialize_exhibitor_from_slug(text) to authenticated;
