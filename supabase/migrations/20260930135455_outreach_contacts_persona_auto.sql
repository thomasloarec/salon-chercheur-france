-- Lot 2 Apollo (30/09/2026) : profil (persona) renseigné automatiquement à l'insertion d'un contact
-- Apollo fournit son propre profil ; pour Hunter (ou tout autre source), il est calculé par outreach_persona().
create or replace function public.trg_outreach_contacts_set_persona()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.persona is null then
    new.persona := public.outreach_persona(new.job_title, new.first_name, new.department_guess);
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_outreach_contacts_set_persona() from public, anon, authenticated;

drop trigger if exists trg_outreach_contacts_persona on public.outreach_contacts;
create trigger trg_outreach_contacts_persona
  before insert on public.outreach_contacts
  for each row execute function public.trg_outreach_contacts_set_persona();

-- Rattrapage des contacts existants (mesure du Lot 4)
update public.outreach_contacts
   set persona = public.outreach_persona(job_title, first_name, department_guess)
 where persona is null;
