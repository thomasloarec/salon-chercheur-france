-- Lot 2 Apollo (30/09/2026) : journal Apollo par campagne
-- Sert au plafond de crédits, à l'audit et à la mesure (Lot 4).
alter table public.outreach_campaigns
  add column if not exists apollo_checked_at timestamptz,
  add column if not exists apollo_result text,
  add column if not exists apollo_credits integer not null default 0;

alter table public.outreach_campaigns
  drop constraint if exists outreach_campaigns_apollo_result_check;
alter table public.outreach_campaigns
  add constraint outreach_campaigns_apollo_result_check check (
    apollo_result is null or apollo_result in (
      'contact_verifie',      -- email Apollo verified retenu
      'email_non_verifie',    -- cible(s) enrichie(s) sans email verified, repli Hunter
      'sans_cible',           -- entreprise connue en France, aucune cible avec email, repli Hunter
      'inconnue',             -- Apollo ne connaît pas l'entreprise, repli Hunter
      'etranger',             -- aucun salarié en France, salariés ailleurs : foreign_company
      'contact_etranger',     -- contrôle file d'envoi : contact Hunter basé hors de France
      'plafond',              -- plafond journalier de crédits atteint, repli Hunter
      'erreur'                -- erreur API, repli Hunter
    )
  );

create index if not exists idx_outreach_campaigns_apollo_checked_at
  on public.outreach_campaigns (apollo_checked_at)
  where apollo_checked_at is not null;
