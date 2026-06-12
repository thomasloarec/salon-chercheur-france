-- ============================================================
-- BLOC 1 — Colonnes compteurs (idempotent)
-- ============================================================
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS claim_step   integer NOT NULL DEFAULT 0;
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS novelty_step integer NOT NULL DEFAULT 0;

-- ============================================================
-- BLOC 2 — Amendement check_claim_conversion
-- Corps d'origine PRÉSERVÉ ; 2 zones modifiées :
--  [FIX ORIGINE]   : la campagne revendiquée démarre la séquence Nouveauté.
--  [AJOUT PROPAG.] : propagation entreprise avant RETURN.
-- Garde de (re)démarrage Nouveauté (sur les DEUX UPDATE) :
--   novelty_step = 0 AND novelty_status NOT IN ('published','declined')
--   -> une campagne déjà engagée (step >= 1) n'est jamais reculée.
-- ============================================================
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

-- ============================================================
-- BLOC 3 — Vue v_eligibles_revendication
-- ============================================================
DROP VIEW IF EXISTS public.v_eligibles_revendication;
CREATE VIEW public.v_eligibles_revendication AS
SELECT
  oc.id,
  c.contact_email,
  c.first_name,
  oc.company_name,
  e.nom_event,
  slug.public_slug,
  oc.claim_step,
  ( SELECT count(*) FROM public.outreach_campaigns oc2
      WHERE oc2.event_id = oc.event_id AND oc2.claim_status = 'claimed' ) AS claimed_count,
  oc.next_send_at
FROM public.outreach_campaigns oc
JOIN public.events e ON e.id = oc.event_id
LEFT JOIN public.participation p ON p.id_participation = oc.participation_id
LEFT JOIN public.outreach_contacts c ON c.outreach_campaign_id = oc.id AND c.is_primary = true
LEFT JOIN LATERAL (
  SELECT COALESCE(
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.exhibitor_id = oc.exhibitor_id AND epi.is_active = true LIMIT 1),
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.exhibitor_id = p.exhibitor_id AND epi.is_active = true LIMIT 1),
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.legacy_exposant_id = oc.id_exposant_legacy AND epi.is_active = true LIMIT 1),
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true LIMIT 1)
  ) AS public_slug
) slug ON true
WHERE oc.hunter_status = 'ready'
  AND c.contact_email IS NOT NULL
  AND oc.claim_status IN ('pending','active')
  AND oc.opt_out = false
  AND oc.claim_step < 3
  AND (oc.next_send_at IS NULL OR oc.next_send_at <= now())
  AND e.date_debut >= CURRENT_DATE
  AND e.date_debut <= CURRENT_DATE + 60
  AND e.campagne_active = true
  AND slug.public_slug IS NOT NULL
ORDER BY oc.claim_step DESC, oc.next_send_at ASC NULLS FIRST, oc.id ASC;

GRANT SELECT ON public.v_eligibles_revendication TO service_role;

-- ============================================================
-- BLOC 4 — Vue v_eligibles_nouveaute (version fondatrice)
-- ============================================================
DROP VIEW IF EXISTS public.v_eligibles_nouveaute;
CREATE VIEW public.v_eligibles_nouveaute AS
SELECT
  oc.id,
  c.contact_email,
  c.first_name,
  oc.company_name,
  e.nom_event,
  slug.public_slug,
  oc.novelty_step,
  oc.next_send_at,
  oc.event_id,
  e.date_debut
FROM public.outreach_campaigns oc
JOIN public.events e ON e.id = oc.event_id
LEFT JOIN public.participation p ON p.id_participation = oc.participation_id
LEFT JOIN public.outreach_contacts c ON c.outreach_campaign_id = oc.id AND c.is_primary = true
LEFT JOIN LATERAL (
  SELECT COALESCE(
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.exhibitor_id = oc.exhibitor_id AND epi.is_active = true LIMIT 1),
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.exhibitor_id = p.exhibitor_id AND epi.is_active = true LIMIT 1),
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.legacy_exposant_id = oc.id_exposant_legacy AND epi.is_active = true LIMIT 1),
    (SELECT epi.public_slug FROM public.exhibitor_public_identities epi
       WHERE epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true LIMIT 1)
  ) AS public_slug
) slug ON true
WHERE oc.claim_status = 'claimed'
  AND oc.novelty_status = 'active'
  AND oc.opt_out = false
  AND oc.novelty_step < 4
  AND (oc.next_send_at IS NULL OR oc.next_send_at <= now())
  AND e.date_debut >= CURRENT_DATE
  AND e.campagne_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.novelties n
    WHERE n.exhibitor_id = oc.exhibitor_id
      AND n.event_id = oc.event_id
      AND n.status = 'published'
      AND n.is_test = false
  )
ORDER BY oc.novelty_step DESC, oc.next_send_at ASC NULLS FIRST, oc.id ASC;

GRANT SELECT ON public.v_eligibles_nouveaute TO service_role;