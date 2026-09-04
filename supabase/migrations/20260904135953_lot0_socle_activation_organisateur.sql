-- ============================================================
-- WF5 — Lot 0 : socle de la piste "activation organisateur"
-- Piste 100% indépendante de la piste claim (WF4).
-- Aucune colonne partagée : last_sent_at / next_send_at restent
-- la propriété exclusive de WF4.
-- ============================================================

ALTER TABLE public.organizer_outreach_campaigns
  ADD COLUMN IF NOT EXISTS activation_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_next_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_stop_reason  text,
  ADD COLUMN IF NOT EXISTS activation_stopped_at   timestamptz,
  ADD COLUMN IF NOT EXISTS activation_started_at   timestamptz;

-- Bornage de la séquence d'activation : E1 (0) -> E2 (1) -> E3 (2) -> E4 (3)
-- step = 4 signifie séquence d'accueil épuisée (bascule en mode veille, lot 6).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.organizer_outreach_campaigns'::regclass
      AND conname  = 'organizer_outreach_campaigns_activation_step_chk'
  ) THEN
    ALTER TABLE public.organizer_outreach_campaigns
      ADD CONSTRAINT organizer_outreach_campaigns_activation_step_chk
      CHECK (activation_step >= 0 AND activation_step <= 4);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_campaigns_activation_due
  ON public.organizer_outreach_campaigns (activation_next_send_at)
  WHERE activation_status = 'active';

COMMENT ON COLUMN public.organizer_outreach_campaigns.activation_next_send_at IS
  'WF5 uniquement. NULL ne signifie JAMAIS "envoyer maintenant" : la vue d''eligibilite exige une date non nulle et echue.';
