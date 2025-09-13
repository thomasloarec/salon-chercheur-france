-- S'assure que la table existe
create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 1) Upsert la version canonique
insert into public.sectors (name)
values ('Automobile & Mobilité')
on conflict (name) do nothing;

-- 2) Si l'ancien nom existe, le migrer vers le nouveau
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.sectors where name = 'Automobile & Mobilités';
  select id into new_id from public.sectors where name = 'Automobile & Mobilité';

  if old_id is not null and new_id is not null then
    -- Tentatives de MAJ des tables de liaison si elles existent (ajuster selon schéma)
    if to_regclass('public.event_sectors') is not null then
      update public.event_sectors set sector_id = new_id where sector_id = old_id;
    end if;

    if to_regclass('public.events_sectors') is not null then
      update public.events_sectors set sector_id = new_id where sector_id = old_id;
    end if;

    if to_regclass('public.exhibitor_sectors') is not null then
      update public.exhibitor_sectors set sector_id = new_id where sector_id = old_id;
    end if;

    -- Supprime l'ancien secteur s'il reste
    delete from public.sectors where id = old_id;
  end if;
end $$;