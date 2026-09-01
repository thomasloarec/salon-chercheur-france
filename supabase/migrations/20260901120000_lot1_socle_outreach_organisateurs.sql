-- ============================================================================
-- LOT 1 — Socle données outreach organisateurs (WF4)
-- Appliquée en production le 2026-09-01 via Supabase MCP.
-- Deux migrations enregistrées dans supabase_migrations.schema_migrations :
--   lot1_socle_outreach_organisateurs
--   lot1_revoke_authenticated_on_create_missing_organizer_campaigns
-- Ce fichier réunit les deux. Aucune table existante n'est modifiée ;
-- le seul objet créé hors périmètre nouveau est un index sur events.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table organizers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  primary_domain   text NOT NULL,
  website          text,
  outreach_blocked boolean NOT NULL DEFAULT false,
  blocked_reason   text,
  blocked_at       timestamptz,
  blocked_by       uuid,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizers_primary_domain_key UNIQUE (primary_domain)
);

COMMENT ON TABLE public.organizers IS
  'Entite organisateur de salons. Regroupee par domaine du site officiel. Le nom est un libelle interne, il napparait pas dans les emails.';
COMMENT ON COLUMN public.organizers.outreach_blocked IS
  'true = aucun email ne doit partir vers cet organisateur, tous salons confondus.';

DROP TRIGGER IF EXISTS trg_organizers_updated_at ON public.organizers;
CREATE TRIGGER trg_organizers_updated_at
  BEFORE UPDATE ON public.organizers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Table organizer_domains (rattachement aux events, sans toucher a events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizer_domains (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  domain       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_domains_domain_key UNIQUE (domain),
  CONSTRAINT organizer_domains_domain_normalized_chk
    CHECK (domain = lower(btrim(domain)) AND domain !~ '[/:?[:space:]]' AND domain !~ '^www\.')
);

CREATE INDEX IF NOT EXISTS idx_organizer_domains_organizer
  ON public.organizer_domains(organizer_id);

COMMENT ON TABLE public.organizer_domains IS
  'Domaines rattaches a un organisateur. Jointure : events.url_site_officiel_domain = organizer_domains.domain. Fusionner deux organisateurs = deplacer une ligne ici.';

CREATE INDEX IF NOT EXISTS idx_events_url_site_officiel_domain
  ON public.events(url_site_officiel_domain);

-- ---------------------------------------------------------------------------
-- 3. Table organizer_outreach_campaigns
--    L'unicite sur organizer_id est ce qui garantit UN SEUL mail pour un
--    organisateur portant N salons, y compris sur un re-run du RPC.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizer_outreach_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id      uuid NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,

  -- enrichissement
  hunter_status     text NOT NULL DEFAULT 'pending',
  contact_email     text,

  -- sequence A : revendication (2 emails maximum)
  claim_status      text NOT NULL DEFAULT 'pending',
  claim_step        integer NOT NULL DEFAULT 0,
  claimed_at        timestamptz,

  -- sequence B : activation (Lot 6, colonnes posees des maintenant)
  activation_status text NOT NULL DEFAULT 'not_started',
  activation_step   integer NOT NULL DEFAULT 0,

  -- cadencement commun
  last_sent_at      timestamptz,
  next_send_at      timestamptz,

  -- arret
  opt_out           boolean NOT NULL DEFAULT false,
  stop_reason       text,
  stop_note         text,
  stopped_at        timestamptz,
  stopped_by        uuid,
  reply_status      text NOT NULL DEFAULT 'none',

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT organizer_outreach_campaigns_organizer_key UNIQUE (organizer_id),
  CONSTRAINT organizer_outreach_campaigns_hunter_status_chk
    CHECK (hunter_status IN ('pending','ready','excluded','manual_review')),
  CONSTRAINT organizer_outreach_campaigns_claim_status_chk
    CHECK (claim_status IN ('pending','active','claimed','stopped','opted_out','completed','blocked_invalid_email')),
  CONSTRAINT organizer_outreach_campaigns_activation_status_chk
    CHECK (activation_status IN ('not_started','active','completed','stopped')),
  CONSTRAINT organizer_outreach_campaigns_claim_step_chk
    CHECK (claim_step BETWEEN 0 AND 2),
  CONSTRAINT organizer_outreach_campaigns_reply_status_chk
    CHECK (reply_status IN ('none','positive','negative','bounced','auto_reply'))
);

CREATE INDEX IF NOT EXISTS idx_org_campaigns_claim
  ON public.organizer_outreach_campaigns(claim_status, claim_step, next_send_at);
CREATE INDEX IF NOT EXISTS idx_org_campaigns_hunter
  ON public.organizer_outreach_campaigns(hunter_status);

DROP TRIGGER IF EXISTS trg_org_campaigns_updated_at ON public.organizer_outreach_campaigns;
CREATE TRIGGER trg_org_campaigns_updated_at
  BEFORE UPDATE ON public.organizer_outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Table organizer_outreach_contacts
--    Jusqu'a 3 contacts par organisateur, classes par tier, pour disposer
--    d'un repli si le contact principal rebondit.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizer_outreach_contacts (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_outreach_campaign_id uuid NOT NULL
    REFERENCES public.organizer_outreach_campaigns(id) ON DELETE CASCADE,
  contact_email     text NOT NULL,
  first_name        text,
  last_name         text,
  full_name         text,
  job_title         text,
  department_guess  text,
  tier              text NOT NULL DEFAULT 'autre',
  tier_rank         integer NOT NULL DEFAULT 99,
  source            text NOT NULL DEFAULT 'hunter',
  hunter_score      integer,
  hunter_confidence integer,
  is_primary        boolean NOT NULL DEFAULT false,
  contact_status    text NOT NULL DEFAULT 'ready',
  email_sent_count  integer NOT NULL DEFAULT 0,
  last_sent_at      timestamptz,
  last_reply_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT organizer_outreach_contacts_unique_email
    UNIQUE (organizer_outreach_campaign_id, contact_email),
  CONSTRAINT organizer_outreach_contacts_tier_chk
    CHECK (tier IN ('dirigeant','marketing_com','generique','autre')),
  CONSTRAINT organizer_outreach_contacts_status_chk
    CHECK (contact_status IN ('ready','sent','bounced','replied','rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_contacts_primary
  ON public.organizer_outreach_contacts(organizer_outreach_campaign_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_org_contacts_campaign
  ON public.organizer_outreach_contacts(organizer_outreach_campaign_id);

DROP TRIGGER IF EXISTS trg_org_contacts_updated_at ON public.organizer_outreach_contacts;
CREATE TRIGGER trg_org_contacts_updated_at
  BEFORE UPDATE ON public.organizer_outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS (calque sur outreach_campaigns / outreach_contacts)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_domains            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_outreach_contacts  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage organizers" ON public.organizers;
CREATE POLICY "Admins can manage organizers" ON public.organizers
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "service_role_full_access_organizers" ON public.organizers;
CREATE POLICY "service_role_full_access_organizers" ON public.organizers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage organizer domains" ON public.organizer_domains;
CREATE POLICY "Admins can manage organizer domains" ON public.organizer_domains
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "service_role_full_access_organizer_domains" ON public.organizer_domains;
CREATE POLICY "service_role_full_access_organizer_domains" ON public.organizer_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read organizer campaigns" ON public.organizer_outreach_campaigns;
CREATE POLICY "Admins can read organizer campaigns" ON public.organizer_outreach_campaigns
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins can update organizer campaigns" ON public.organizer_outreach_campaigns;
CREATE POLICY "Admins can update organizer campaigns" ON public.organizer_outreach_campaigns
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "service_role_full_access_organizer_campaigns" ON public.organizer_outreach_campaigns;
CREATE POLICY "service_role_full_access_organizer_campaigns" ON public.organizer_outreach_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read organizer contacts" ON public.organizer_outreach_contacts;
CREATE POLICY "Admins can read organizer contacts" ON public.organizer_outreach_contacts
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "service_role_full_access_organizer_contacts" ON public.organizer_outreach_contacts;
CREATE POLICY "service_role_full_access_organizer_contacts" ON public.organizer_outreach_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. Seed des organisateurs depuis les domaines existants
-- ---------------------------------------------------------------------------
INSERT INTO public.organizers (name, primary_domain, website)
SELECT DISTINCT
  e.url_site_officiel_domain,
  e.url_site_officiel_domain,
  'https://' || e.url_site_officiel_domain
FROM public.events e
WHERE e.visible = true
  AND COALESCE(e.is_test, false) = false
  AND btrim(COALESCE(e.url_site_officiel_domain, '')) <> ''
ON CONFLICT (primary_domain) DO NOTHING;

INSERT INTO public.organizer_domains (organizer_id, domain)
SELECT o.id, o.primary_domain
FROM public.organizers o
ON CONFLICT (domain) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Blocage des organisateurs ayant refuse explicitement
-- ---------------------------------------------------------------------------
UPDATE public.organizers
SET outreach_blocked = true,
    blocked_reason   = 'Refus explicite de l organisateur (SPORT ACHAT ETE)',
    blocked_at       = now()
WHERE primary_domain = 'sport-achat-ete.com';

-- ---------------------------------------------------------------------------
-- 8. Vue de synthese : un organisateur, ses salons, son prochain salon
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_organizers_summary
WITH (security_invoker = on, security_barrier = on) AS
SELECT
  o.id             AS organizer_id,
  o.name           AS organizer_name,
  o.primary_domain,
  o.outreach_blocked,
  count(e.id)                                                   AS nb_salons_total,
  count(e.id) FILTER (WHERE e.date_debut >= CURRENT_DATE)       AS nb_salons_a_venir,
  count(e.id) FILTER (WHERE e.owner_user_id IS NOT NULL)        AS nb_salons_revendiques,
  (array_agg(e.id        ORDER BY e.date_debut)
     FILTER (WHERE e.date_debut >= CURRENT_DATE))[1]            AS next_event_id,
  (array_agg(e.nom_event ORDER BY e.date_debut)
     FILTER (WHERE e.date_debut >= CURRENT_DATE))[1]            AS next_event_name,
  (array_agg(e.slug      ORDER BY e.date_debut)
     FILTER (WHERE e.date_debut >= CURRENT_DATE))[1]            AS next_event_slug,
  min(e.date_debut) FILTER (WHERE e.date_debut >= CURRENT_DATE) AS next_event_date
FROM public.organizers o
JOIN public.organizer_domains od ON od.organizer_id = o.id
JOIN public.events e
  ON e.url_site_officiel_domain = od.domain
 AND e.visible = true
 AND COALESCE(e.is_test, false) = false
GROUP BY o.id, o.name, o.primary_domain, o.outreach_blocked;

-- ---------------------------------------------------------------------------
-- 9. Vue des campagnes manquantes + RPC de creation (patron WF1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_organizer_campaigns_missing
WITH (security_invoker = on, security_barrier = on) AS
SELECT s.organizer_id
FROM public.v_organizers_summary s
LEFT JOIN public.organizer_outreach_campaigns c ON c.organizer_id = s.organizer_id
WHERE c.id IS NULL
  AND s.outreach_blocked = false
  AND s.nb_salons_a_venir > 0;

CREATE OR REPLACE FUNCTION public.create_missing_organizer_campaigns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.organizer_outreach_campaigns (organizer_id)
  SELECT organizer_id
  FROM public.v_organizer_campaigns_missing
  LIMIT 200
  ON CONFLICT (organizer_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'inserted_campaigns', inserted_count
  );
END;
$function$;

-- Supabase applique ALTER DEFAULT PRIVILEGES a la creation : le GRANT EXECUTE
-- vers anon ET authenticated existe avant tout REVOKE. Les trois REVOKE
-- ci-dessous sont donc obligatoires, REVOKE FROM PUBLIC seul ne suffit pas.
REVOKE ALL ON FUNCTION public.create_missing_organizer_campaigns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_missing_organizer_campaigns() FROM anon;
REVOKE ALL ON FUNCTION public.create_missing_organizer_campaigns() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_missing_organizer_campaigns() TO service_role;

-- ---------------------------------------------------------------------------
-- 10. Vue d'enrichissement (source WF4-A)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_organizers_a_enrichir
WITH (security_invoker = on, security_barrier = on) AS
SELECT
  c.id             AS campaign_id,
  s.organizer_id,
  s.organizer_name,
  s.primary_domain AS domain,
  s.nb_salons_a_venir,
  s.next_event_name,
  s.next_event_date
FROM public.organizer_outreach_campaigns c
JOIN public.v_organizers_summary s ON s.organizer_id = c.organizer_id
WHERE c.hunter_status = 'pending'
  AND s.outreach_blocked = false
  AND s.nb_salons_a_venir > 0
  AND s.next_event_date >= CURRENT_DATE + 7
  AND s.next_event_date <= CURRENT_DATE + 270
ORDER BY s.next_event_date, s.organizer_id;

-- ---------------------------------------------------------------------------
-- 11. Vue d'eligibilite (source WF4-B)
--     Fenetre : prochain salon entre J+7 et J+270
--     Sequence : 2 emails maximum (claim_step < 2)
--     Arret : des qu'AU MOINS UN salon de l'organisateur est revendique
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_eligibles_revendication_organisateur
WITH (security_invoker = on, security_barrier = on) AS
SELECT
  c.id             AS campaign_id,
  s.organizer_id,
  s.organizer_name,
  s.primary_domain AS domain,
  ct.contact_email,
  ct.first_name,
  ct.tier          AS contact_tier,
  s.nb_salons_a_venir,
  s.next_event_id,
  s.next_event_name,
  s.next_event_slug,
  s.next_event_date,
  c.claim_step,
  c.next_send_at
FROM public.organizer_outreach_campaigns c
JOIN public.v_organizers_summary s ON s.organizer_id = c.organizer_id
JOIN public.organizer_outreach_contacts ct
  ON ct.organizer_outreach_campaign_id = c.id AND ct.is_primary = true
WHERE c.hunter_status  = 'ready'
  AND c.claim_status   IN ('pending','active')
  AND c.claim_step     < 2
  AND c.opt_out        = false
  AND c.stop_reason    IS NULL
  AND (c.next_send_at IS NULL OR c.next_send_at <= now())
  AND ct.contact_email IS NOT NULL
  AND ct.contact_status IN ('ready','sent')
  AND NOT public.is_email_blacklisted(ct.contact_email)
  AND s.outreach_blocked = false
  AND s.nb_salons_revendiques = 0
  AND s.nb_salons_a_venir > 0
  AND s.next_event_date >= CURRENT_DATE + 7
  AND s.next_event_date <= CURRENT_DATE + 270
  AND s.next_event_slug IS NOT NULL
ORDER BY c.claim_step DESC, s.next_event_date, c.next_send_at NULLS FIRST, c.id;
