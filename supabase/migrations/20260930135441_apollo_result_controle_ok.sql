-- Lot 2 Apollo (30/09/2026) : valeur 'controle_ok' pour le contrôle pays de la file d'envoi existante
alter table public.outreach_campaigns
  drop constraint if exists outreach_campaigns_apollo_result_check;
alter table public.outreach_campaigns
  add constraint outreach_campaigns_apollo_result_check check (
    apollo_result is null or apollo_result in (
      'contact_verifie','email_non_verifie','sans_cible','inconnue','etranger',
      'contact_etranger','controle_ok','plafond','erreur'
    )
  );
