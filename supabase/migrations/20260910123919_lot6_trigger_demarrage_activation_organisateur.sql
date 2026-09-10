-- ============================================================
-- WF5 — Lot 6 (partiel) : allumage automatique de la piste activation.
--
-- Miroir organisateur de check_claim_conversion() (monde exposant).
-- Jusqu'ici, activation_status etait mis a 'active' par un backfill
-- ponctuel (lot 0) : chaque nouvelle revendication d'evenement restait
-- donc a 'not_started' et n'entrait jamais dans WF5. Ce trigger ferme
-- la boucle de facon permanente.
--
-- Chaine de resolution : event_claim_requests approuve
--   -> events.owner_user_id (via l'evenement revendique)
--   -> events.url_site_officiel_domain
--   -> organizer_domains.domain
--   -> organizer_outreach_campaigns (une par organisateur).
--
-- Idempotent, et il ne REDEMARRE jamais une sequence : si l'organisateur
-- a deja recu des emails (step > 0) ou s'est desabonne, on ne touche a
-- rien. Il ne fait qu'allumer une piste encore 'not_started'.
--
-- La DE-VALIDATION (salon retire a un organisateur) n'a PAS besoin de
-- trigger : la vue v_organizer_activation_state exige un salon avec
-- owner_user_id non nul, donc un salon rendu fait sortir l'organisateur
-- de la file a la lecture, exactement comme l'arret de la piste claim.
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_organizer_activation_on_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_id uuid;
BEGIN
  -- N'agir qu'a la transition VERS 'approved'.
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;  -- deja approuve : no-op idempotent
  END IF;

  -- Resolution de la campagne organisateur a partir de l'evenement revendique.
  SELECT c.id INTO v_campaign_id
  FROM public.events e
  JOIN public.organizer_domains od ON od.domain = e.url_site_officiel_domain
  JOIN public.organizer_outreach_campaigns c ON c.organizer_id = od.organizer_id
  WHERE e.id = NEW.event_id
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    -- Aucun organisateur rattache (domaine inconnu dans organizer_domains).
    -- On ne cree rien : ce cas releve d'un rattachement admin, pas d'un envoi.
    RETURN NEW;
  END IF;

  UPDATE public.organizer_outreach_campaigns
  SET activation_status       = 'active',
      activation_started_at    = COALESCE(activation_started_at, now()),
      activation_next_send_at  = COALESCE(activation_next_send_at, now()),
      updated_at               = now()
  WHERE id = v_campaign_id
    AND activation_status = 'not_started'   -- ne demarre que ce qui dort
    AND opt_out = false                     -- jamais un opt-out
    AND activation_stop_reason IS NULL;     -- jamais une piste stoppee

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_start_organizer_activation ON public.event_claim_requests;
CREATE TRIGGER trg_start_organizer_activation
  AFTER INSERT OR UPDATE OF status ON public.event_claim_requests
  FOR EACH ROW EXECUTE FUNCTION public.start_organizer_activation_on_claim();
