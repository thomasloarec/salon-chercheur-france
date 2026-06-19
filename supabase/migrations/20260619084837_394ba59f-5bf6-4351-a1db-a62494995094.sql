create table public.widget_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  event_id uuid not null references public.events(id) on delete restrict,
  allowed_domains text[] not null default '{}',
  organizer_name text,
  organizer_email text,
  status text not null default 'active' check (status in ('active','revoked')),
  last_seen_at timestamptz,
  last_seen_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_widget_tokens_event on public.widget_tokens(event_id);

grant select, insert, update, delete on public.widget_tokens to authenticated;
grant all on public.widget_tokens to service_role;

alter table public.widget_tokens enable row level security;

create policy "admins manage widget_tokens"
  on public.widget_tokens for all to public
  using (is_admin()) with check (is_admin());

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger update_widget_tokens_updated_at
  before update on public.widget_tokens
  for each row execute function public.update_updated_at_column();

create or replace function public.resolve_widget_token(p_token text)
returns table (
  event_id uuid,
  id_event_text text,
  event_slug text,
  allowed_domains text[],
  event_passed boolean
)
language sql stable security definer set search_path = public
as $$
  select e.id, e.id_event, e.slug, t.allowed_domains,
         (e.date_fin < current_date)
  from public.widget_tokens t
  join public.events e on e.id = t.event_id
  where t.token = p_token and t.status = 'active'
  limit 1;
$$;

grant execute on function public.resolve_widget_token(text) to anon, authenticated;