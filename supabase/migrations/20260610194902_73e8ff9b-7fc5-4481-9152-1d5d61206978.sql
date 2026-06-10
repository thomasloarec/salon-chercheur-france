-- ============================================================
-- 1.1 — Deux pistes de conversion sur outreach_campaigns
-- ============================================================
ALTER TABLE public.outreach_campaigns
  ADD COLUMN IF NOT EXISTS claim_status   text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS novelty_status text NOT NULL DEFAULT 'n/a',
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS claimed_at     timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_campaigns_claim_status_check') THEN
    ALTER TABLE public.outreach_campaigns
      ADD CONSTRAINT outreach_campaigns_claim_status_check
      CHECK (claim_status IN ('pending','active','claimed','declined'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_campaigns_novelty_status_check') THEN
    ALTER TABLE public.outreach_campaigns
      ADD CONSTRAINT outreach_campaigns_novelty_status_check
      CHECK (novelty_status IN ('n/a','active','published','declined'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_campaigns_decline_reason_check') THEN
    ALTER TABLE public.outreach_campaigns
      ADD CONSTRAINT outreach_campaigns_decline_reason_check
      CHECK (decline_reason IS NULL OR decline_reason IN ('pas_le_temps','pas_de_nouveaute','pas_compris','autre'));
  END IF;
END $$;

-- ============================================================
-- 1.3 — Colonne d'attribution sur exhibitor_claim_requests
-- ============================================================
ALTER TABLE public.exhibitor_claim_requests
  ADD COLUMN IF NOT EXISTS source_campaign_id uuid
  REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claim_requests_source_campaign
  ON public.exhibitor_claim_requests(source_campaign_id);

-- ============================================================
-- 1.4 — Trigger de détection de la revendication
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_claim_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_domain      text;
BEGIN
  -- N'agir que lors d'une transition VERS 'approved'
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW; -- déjà approuvé : no-op idempotent
  END IF;

  -- Chemin 1 (prioritaire) : attribution explicite via deep-link
  v_campaign_id := NEW.source_campaign_id;

  -- Chemin 2 (fallback) : via exhibitor_id -> participation -> campagne
  IF v_campaign_id IS NULL THEN
    SELECT oc.id INTO v_campaign_id
    FROM outreach_campaigns oc
    JOIN participation p ON p.id_participation = oc.participation_id
    WHERE p.exhibitor_id = NEW.exhibitor_id
      AND oc.claim_status IN ('pending','active')
    ORDER BY oc.created_at DESC
    LIMIT 1;
  END IF;

  -- Chemin 3 (fallback) : via domaine normalisé
  IF v_campaign_id IS NULL THEN
    SELECT normalize_domain(website) INTO v_domain
    FROM exhibitors WHERE id = NEW.exhibitor_id;
    IF v_domain IS NOT NULL AND v_domain <> '' THEN
      SELECT oc.id INTO v_campaign_id
      FROM outreach_campaigns oc
      WHERE normalize_domain(oc.website) = v_domain
        AND oc.claim_status IN ('pending','active')
      ORDER BY oc.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_campaign_id IS NOT NULL THEN
    UPDATE outreach_campaigns
    SET claim_status   = 'claimed',
        claimed_at     = now(),
        novelty_status = CASE WHEN novelty_status = 'n/a' THEN 'active' ELSE novelty_status END,
        updated_at     = now()
    WHERE id = v_campaign_id
      AND claim_status <> 'claimed'; -- idempotent
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_claim_conversion ON public.exhibitor_claim_requests;
CREATE TRIGGER trg_check_claim_conversion
AFTER INSERT OR UPDATE OF status ON public.exhibitor_claim_requests
FOR EACH ROW
EXECUTE FUNCTION public.check_claim_conversion();

-- ============================================================
-- 1.5 — Modification additive de check_novelty_conversion()
-- (définition réelle + ligne additive novelty_status = 'published')
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_novelty_conversion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Chemin 1 : matching direct par exhibitor_id + event_id
  UPDATE outreach_campaigns
  SET campaign_status = 'converted',
      novelty_status = 'published',
      novelty_id = NEW.id,
      updated_at = now()
  WHERE event_id = NEW.event_id
    AND exhibitor_id = NEW.exhibitor_id
    AND campaign_status NOT IN ('converted', 'opted_out');

  -- Chemin 2 : matching via participation
  UPDATE outreach_campaigns oc
  SET campaign_status = 'converted',
      novelty_status = 'published',
      novelty_id = NEW.id,
      updated_at = now()
  FROM participation p
  WHERE oc.participation_id = p.id_participation
    AND p.exhibitor_id = NEW.exhibitor_id
    AND oc.event_id = NEW.event_id
    AND oc.campaign_status NOT IN ('converted', 'opted_out');

  -- Chemin 3 : fallback par website normalisé
  UPDATE outreach_campaigns oc
  SET campaign_status = 'converted',
      novelty_status = 'published',
      novelty_id = NEW.id,
      updated_at = now()
  FROM exhibitors ex
  WHERE ex.id = NEW.exhibitor_id
    AND oc.event_id = NEW.event_id
    AND ex.website IS NOT NULL
    AND oc.website IS NOT NULL
    AND (
      replace(replace(lower(oc.website), 'https://', ''), 'http://', '')
        LIKE '%' || replace(replace(lower(ex.website), 'https://', ''), 'http://', '') || '%'
      OR
      replace(replace(lower(ex.website), 'https://', ''), 'http://', '')
        LIKE '%' || replace(replace(lower(oc.website), 'https://', ''), 'http://', '') || '%'
    )
    AND oc.campaign_status NOT IN ('converted', 'opted_out');

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 1.2 — Backfill RESTREINT (campagnes converties avec équipe active)
-- ============================================================
UPDATE public.outreach_campaigns oc
SET claim_status   = 'claimed',
    novelty_status = 'published',
    claimed_at     = COALESCE(claimed_at, now())
FROM novelties n
JOIN exhibitor_team_members tm
  ON tm.exhibitor_id = n.exhibitor_id AND tm.status = 'active'
WHERE oc.novelty_id = n.id
  AND oc.campaign_status = 'converted'
  AND oc.claim_status <> 'claimed';