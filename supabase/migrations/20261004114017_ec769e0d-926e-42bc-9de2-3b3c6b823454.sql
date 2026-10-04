-- Compteur public du nombre total de conférences (sessions de programme publiées,
-- passées et à venir) des salons visibles. Ne renvoie qu'un nombre, aucun détail.
create or replace function public.public_conference_count()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::int
  from public.event_program_sessions s
  join public.events e on e.id = s.event_id
  where s.status = 'published'
    and e.visible = true
    and e.is_test = false;
$$;

revoke all on function public.public_conference_count() from public;
grant execute on function public.public_conference_count() to anon, authenticated;

-- Contrôle : la fonction répond et le total n'est pas nul.
do $$
begin
  if public.public_conference_count() is null or public.public_conference_count() = 0 then
    raise exception 'Contrôle : public_conference_count renvoie 0 ou null';
  end if;
end
$$;

notify pgrst, 'reload schema';