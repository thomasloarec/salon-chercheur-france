-- 20261001160000_exposants_normalized_domain_auto.sql
-- Radar CRM : les exposants créés depuis mi-mai 2026 n'avaient plus de
-- normalized_domain (colonne remplie une seule fois par un backfill, jamais
-- maintenue ensuite). La vue crm_radar_participations_view exclut ces
-- exposants, donc aucun compte CRM ne pouvait matcher avec eux.
-- Constat 01/10/2026 : 15 058 exposants avec site web mais sans domaine.
--
-- Correctif :
--   1. trigger qui calcule normalized_domain via public.web_domain()
--      à chaque INSERT, et à chaque UPDATE du site (ou si le domaine est vide) ;
--   2. backfill des lignes vides (les 15 873 lignes déjà remplies ne sont pas touchées).
-- web_domain() est déjà la fonction de référence (identique à la valeur
-- existante sur 99,9 % des lignes remplies) et rejette les valeurs invalides
-- (emails, "htttps", "www;site.fr").

create or replace function public.set_exposants_normalized_domain()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.normalized_domain is null or btrim(new.normalized_domain) = '' then
      new.normalized_domain := public.web_domain(new.website_exposant);
    end if;
  elsif new.website_exposant is distinct from old.website_exposant
     or new.normalized_domain is null
     or btrim(new.normalized_domain) = '' then
    new.normalized_domain := public.web_domain(new.website_exposant);
  end if;
  return new;
end;
$$;

revoke all on function public.set_exposants_normalized_domain() from public;
revoke all on function public.set_exposants_normalized_domain() from anon;
revoke all on function public.set_exposants_normalized_domain() from authenticated;

drop trigger if exists trg_exposants_normalized_domain on public.exposants;
create trigger trg_exposants_normalized_domain
  before insert or update of website_exposant, normalized_domain
  on public.exposants
  for each row
  execute function public.set_exposants_normalized_domain();

-- Backfill : uniquement les lignes vides avec un site exploitable.
update public.exposants
set normalized_domain = public.web_domain(website_exposant)
where (normalized_domain is null or btrim(normalized_domain) = '')
  and public.web_domain(website_exposant) is not null;
