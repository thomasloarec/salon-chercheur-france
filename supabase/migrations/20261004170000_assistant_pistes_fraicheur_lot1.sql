-- Correctif intentions périmées, lot 1 (additif) : suivi de fraîcheur des intentions.
-- Cadrage : claude/Correctif_Pistes_Perimees_Cadrage_04102026.md
-- Aucun changement de comportement du moteur ni du dispatcher (lots 2 et 3).

-- 1. Colonnes de suivi
alter table public.assistant_profiles
  add column if not exists pistes_built_at timestamptz,
  add column if not exists content_changed_at timestamptz;

comment on column public.assistant_profiles.pistes_built_at is
  'Dernière reconstruction réussie des intentions (assistant_pistes) par le moteur, étape pistes ou all.';
comment on column public.assistant_profiles.content_changed_at is
  'Dernier changement d''un champ qui nourrit les intentions. Intentions à reconstruire si pistes_built_at < content_changed_at.';

-- 2. Rattrapage
--    pistes_built_at : dernière génération des intentions issues du profil (origin = profile).
update public.assistant_profiles ap
   set pistes_built_at = x.built_at
  from (select profile_id, max(created_at) as built_at
          from public.assistant_pistes
         where origin = 'profile'
         group by profile_id) x
 where x.profile_id = ap.id
   and ap.pistes_built_at is null;

--    content_changed_at : profils rattachés à un compte et déjà onboardés dont les intentions sont
--    antérieures au profil (ou absentes) => à reconstruire ; tous les autres => à jour.
update public.assistant_profiles ap
   set content_changed_at = case
         when ap.user_id is not null and ap.onboarded_at is not null
              and (ap.pistes_built_at is null or ap.pistes_built_at < ap.updated_at - interval '2 minutes')
           then ap.updated_at
         else coalesce(ap.pistes_built_at, ap.created_at)
       end
 where ap.content_changed_at is null;

-- 3. Déclencheur : tout changement d'un champ nourricier marque les intentions à reconstruire.
--    Pour un assistant rattaché à un compte et déjà onboardé (cas « Modifier »), il demande aussi
--    un rafraîchissement rapide : la reconstruction ne dépend plus du seul navigateur.
--    Les mises à jour du moteur (horodatages, statuts) ne touchent aucun de ces champs : rien ne se déclenche.
create or replace function public.assistant_profiles_track_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.content_changed_at := coalesce(new.content_changed_at, now());
    return new;
  end if;

  if new.company_name        is distinct from old.company_name
  or new.company_description is distinct from old.company_description
  or new.label               is distinct from old.label
  or new.sector_ids          is distinct from old.sector_ids
  or new.sub_sector_ids      is distinct from old.sub_sector_ids
  or new.role_code           is distinct from old.role_code
  or new.role_codes          is distinct from old.role_codes
  or new.role_other          is distinct from old.role_other
  or new.interests           is distinct from old.interests
  or new.goals               is distinct from old.goals then
    new.content_changed_at := now();
    if new.user_id is not null and old.onboarded_at is not null then
      new.refresh_requested_at := now();
      new.refresh_attempts := 0;
      new.refresh_fast := true;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists assistant_profiles_track_content on public.assistant_profiles;
create trigger assistant_profiles_track_content
  before insert or update on public.assistant_profiles
  for each row execute function public.assistant_profiles_track_content();

revoke all on function public.assistant_profiles_track_content() from public, anon, authenticated;

-- 4. Contrôle permanent : doit toujours renvoyer 0 ligne (après le lot 3).
create or replace view public.assistant_pistes_stale_violations
with (security_invoker = true) as
select ap.id as profile_id, ap.user_id, ap.label,
       ap.content_changed_at, ap.pistes_built_at
  from public.assistant_profiles ap
 where ap.user_id is not null
   and ap.onboarded_at is not null
   and (ap.pistes_built_at is null or ap.pistes_built_at < ap.content_changed_at)
   and ap.content_changed_at < now() - interval '15 minutes';

revoke all on public.assistant_pistes_stale_violations from anon, authenticated;
grant select on public.assistant_pistes_stale_violations to service_role;
