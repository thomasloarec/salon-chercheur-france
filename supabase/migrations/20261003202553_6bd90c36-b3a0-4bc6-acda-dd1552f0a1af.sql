-- Lot 3d bis : journal des demandes de lien de connexion (limites d'envoi de assistant-login-link).
-- Seules des empreintes SHA-256 sont stockées (ni adresse email, ni IP en clair). Lecture et écriture
-- réservées au service (aucune règle d'accès pour le site). Purge quotidienne au-delà de 2 jours.
create table if not exists public.auth_login_link_requests (
  id         bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_login_link_requests_email_idx on public.auth_login_link_requests (email_hash, created_at);
create index if not exists auth_login_link_requests_ip_idx on public.auth_login_link_requests (ip_hash, created_at);
alter table public.auth_login_link_requests enable row level security;
revoke all on table public.auth_login_link_requests from anon, authenticated;
grant all on public.auth_login_link_requests to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'auth-login-link-purge') then
    perform cron.unschedule('auth-login-link-purge');
  end if;
  perform cron.schedule('auth-login-link-purge', '17 3 * * *',
    $job$delete from public.auth_login_link_requests where created_at < now() - interval '2 days'$job$);
end
$$;