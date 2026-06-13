CREATE OR REPLACE FUNCTION public.check_claim_conversion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_id uuid;
  v_domain      text;
  v_company_domain text;  -- [AJOUT] domaine normalisé de l'entreprise revendiquée
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
        -- [FIX] renseigne exhibitor_id si absent (cas revendication par domaine)
        exhibitor_id   = COALESCE(exhibitor_id, NEW.exhibitor_id),
        -- [FIX ORIGINE] démarre la séquence Nouveauté uniquement si elle n'a pas commencé.
        novelty_status = CASE WHEN novelty_step = 0 AND novelty_status NOT IN ('published','declined') THEN 'active' ELSE novelty_status END,
        novelty_step   = CASE WHEN novelty_step = 0 AND novelty_status NOT IN ('published','declined') THEN 0     ELSE novelty_step   END,
        next_send_at   = CASE WHEN novelty_step = 0 AND novelty_status NOT IN ('published','declined') THEN now() + interval '4 days' ELSE next_send_at END,
        updated_at     = now()
    WHERE id = v_campaign_id
      AND claim_status <> 'claimed'; -- idempotent
  END IF;

  -- ============================================================
  -- [AJOUT — PROPAGATION ENTREPRISE] (purement additif)
  -- Toutes les campagnes de la même entreprise (exhibitor_id OU
  -- domaine normalisé website), via normalize_domain() (mécanique du chemin 3).
  -- ============================================================
  SELECT normalize_domain(website) INTO v_company_domain
  FROM exhibitors WHERE id = NEW.exhibitor_id;

  UPDATE outreach_campaigns oc
  SET claim_status   = 'claimed',
      claimed_at     = COALESCE(oc.claimed_at, now()),
      -- [FIX] renseigne exhibitor_id si absent (cas revendication par domaine)
      exhibitor_id   = COALESCE(oc.exhibitor_id, NEW.exhibitor_id),
      novelty_status = CASE WHEN oc.novelty_step = 0 AND oc.novelty_status NOT IN ('published','declined') THEN 'active' ELSE oc.novelty_status END,
      novelty_step   = CASE WHEN oc.novelty_step = 0 AND oc.novelty_status NOT IN ('published','declined') THEN 0     ELSE oc.novelty_step   END,
      next_send_at   = CASE WHEN oc.novelty_step = 0 AND oc.novelty_status NOT IN ('published','declined') THEN now() + interval '4 days' ELSE oc.next_send_at END,
      updated_at     = now()
  WHERE oc.claim_status <> 'claimed'  -- idempotence : ne touche pas les déjà claimed
    AND (
          (NEW.exhibitor_id IS NOT NULL AND oc.exhibitor_id = NEW.exhibitor_id)
          OR
          (v_company_domain IS NOT NULL AND v_company_domain <> ''
             AND normalize_domain(oc.website) = v_company_domain)
        );
  -- [FIN AJOUT]

  RETURN NEW;
END;
$function$;