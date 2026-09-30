-- Lot 4 (30/09/2026) : taux de revendication par source (apollo / hunter) et par profil (persona)
-- Base : campagnes exposants ayant reçu au moins un email, contact principal.
create or replace view public.v_mesure_revendication_profil
with (security_invoker = on) as
select
  coalesce(c.source, 'inconnue') as source,
  coalesce(c.persona, 'GENERIQUE') as persona,
  (oc.last_sent_at >= timestamptz '2026-09-30 14:00:00+02') as apres_lot3,
  count(*) as envoyes,
  count(*) filter (where oc.claim_status = 'claimed') as revendiques,
  round(100.0 * count(*) filter (where oc.claim_status = 'claimed') / nullif(count(*), 0), 1) as taux_pct
from public.outreach_campaigns oc
join public.outreach_contacts c on c.outreach_campaign_id = oc.id and c.is_primary
where oc.last_sent_at is not null
group by 1, 2, 3;

revoke all on public.v_mesure_revendication_profil from anon, authenticated;
