-- ============================================================================
-- LOT 2 — Garde-fous d'envoi
--   A. Désinscription bi-monde (exposant + organisateur)
--   B. Plafond de fréquence croisé entre les deux mondes
--   C. Blocage admin au niveau organisateur, piloté depuis une fiche salon
--
-- Appliquée en production le 2026-09-01 via Supabase MCP.
-- Deux migrations enregistrées dans supabase_migrations.schema_migrations :
--   lot2_gardefous_desinscription_et_frequence
--   lot2_plafond_croise_dans_les_vues_eligibilite
-- Ce fichier réunit les deux.
--
-- Vérifié : v_eligibles_revendication renvoie 3803 lignes avant et après.
-- Aucune régression sur le pipeline exposant en production.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Journal de desinscription : accueillir les campagnes organisateur
-- ---------------------------------------------------------------------------
ALTER TABLE public.outreach_unsubscribe_events
  ADD COLUMN IF NOT EXISTS organizer_campaign_id uuid
    REFERENCES public.organizer_outreach_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.outreach_unsubscribe_events
  DROP CONSTRAINT IF EXISTS outreach_unsubscribe_events_sequence_type_check;

ALTER TABLE public.outreach_unsubscribe_events
  ADD CONSTRAINT outreach_unsubscribe_events_sequence_type_check
  CHECK (sequence_type IN ('claim','novelty','organizer_claim','organizer_activation','unknown'));

-- ---------------------------------------------------------------------------
-- 2. Index fonctionnels pour la recherche par adresse normalisee
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_email_norm
  ON public.outreach_contacts (lower(btrim(contact_email)));

CREATE INDEX IF NOT EXISTS idx_org_outreach_contacts_email_norm
  ON public.organizer_outreach_contacts (lower(btrim(contact_email)));

CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_email_norm
  ON public.outreach_campaigns (lower(btrim(contact_email)));

-- ---------------------------------------------------------------------------
-- 3. Plafond de frequence CROISE uniquement
--    Objectif : ne pas ecrire a la meme personne au titre d'un exposant et
--    au titre d'un organisateur a quelques jours d'intervalle.
--    Le cumul exposant contre exposant n'est PAS concerne : une entreprise
--    presente sur deux salons reste deux campagnes, c'est le modele actuel
--    (3803 lignes eligibles pour 3454 adresses distinctes au 01/09/2026).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_recent_exhibitor_send(_email text, _days integer DEFAULT 21)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM outreach_campaigns oc
    LEFT JOIN outreach_contacts c
           ON c.outreach_campaign_id = oc.id AND c.is_primary = true
    WHERE oc.last_sent_at IS NOT NULL
      AND oc.last_sent_at >= now() - make_interval(days => _days)
      AND lower(btrim(_email)) IN (
            lower(btrim(COALESCE(c.contact_email, ''))),
            lower(btrim(COALESCE(oc.contact_email, '')))
          )
      AND btrim(COALESCE(_email, '')) <> ''
  );
$function$;

COMMENT ON FUNCTION public.has_recent_exhibitor_send(text, integer) IS
  'true si cette adresse a recu un email de sequence exposant dans les N derniers jours. Utilise par la vue d eligibilite organisateur.';

CREATE OR REPLACE FUNCTION public.has_recent_organizer_send(_email text, _days integer DEFAULT 21)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM organizer_outreach_campaigns oc
    LEFT JOIN organizer_outreach_contacts ct
           ON ct.organizer_outreach_campaign_id = oc.id AND ct.is_primary = true
    WHERE oc.last_sent_at IS NOT NULL
      AND oc.last_sent_at >= now() - make_interval(days => _days)
      AND lower(btrim(_email)) IN (
            lower(btrim(COALESCE(ct.contact_email, ''))),
            lower(btrim(COALESCE(oc.contact_email, '')))
          )
      AND btrim(COALESCE(_email, '')) <> ''
  );
$function$;

COMMENT ON FUNCTION public.has_recent_organizer_send(text, integer) IS
  'true si cette adresse a recu un email de sequence organisateur dans les N derniers jours. Utilise par les vues d eligibilite exposant.';

-- ---------------------------------------------------------------------------
-- 4. Desinscription bi-monde
--    Une desinscription vaut pour toutes les sequences et tous les salons
--    de la personne, exposant comme organisateur.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outreach_unsubscribe(
  p_campaign_id uuid,
  p_sequence    text DEFAULT 'unknown',
  p_user_agent  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email          text;
  v_company        text;
  v_event_id       uuid;
  v_event_name     text;
  v_event_slug     text;
  v_sequence       text;
  v_is_organizer   boolean := false;
  v_expo_camp      uuid;
  v_orga_camp      uuid;
  v_stopped_expo   integer := 0;
  v_stopped_orga   integer := 0;
BEGIN
  v_sequence := CASE
    WHEN p_sequence IN ('claim','novelty','organizer_claim','organizer_activation')
    THEN p_sequence ELSE 'unknown'
  END;

  v_is_organizer := v_sequence IN ('organizer_claim','organizer_activation');

  -- Resolution de l'adresse. On tente le monde annonce par la sequence,
  -- puis l'autre : un lien mal etiquete ne doit jamais empecher un opt-out.
  IF v_is_organizer THEN
    SELECT lower(btrim(COALESCE(ct.contact_email, oc.contact_email))),
           o.name, s.next_event_id, s.next_event_name, s.next_event_slug, oc.id
      INTO v_email, v_company, v_event_id, v_event_name, v_event_slug, v_orga_camp
    FROM public.organizer_outreach_campaigns oc
    JOIN public.organizers o ON o.id = oc.organizer_id
    LEFT JOIN public.v_organizers_summary s ON s.organizer_id = oc.organizer_id
    LEFT JOIN public.organizer_outreach_contacts ct
           ON ct.organizer_outreach_campaign_id = oc.id AND ct.is_primary = true
    WHERE oc.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    SELECT lower(btrim(COALESCE(c.contact_email, oc.contact_email))),
           oc.company_name, oc.event_id, e.nom_event, e.slug, oc.id
      INTO v_email, v_company, v_event_id, v_event_name, v_event_slug, v_expo_camp
    FROM public.outreach_campaigns oc
    LEFT JOIN public.events e ON e.id = oc.event_id
    LEFT JOIN public.outreach_contacts c
           ON c.outreach_campaign_id = oc.id AND c.is_primary = true
    WHERE oc.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF (v_email IS NULL OR v_email = '') AND NOT v_is_organizer THEN
    SELECT lower(btrim(COALESCE(ct.contact_email, oc.contact_email))),
           o.name, s.next_event_id, s.next_event_name, s.next_event_slug, oc.id
      INTO v_email, v_company, v_event_id, v_event_name, v_event_slug, v_orga_camp
    FROM public.organizer_outreach_campaigns oc
    JOIN public.organizers o ON o.id = oc.organizer_id
    LEFT JOIN public.v_organizers_summary s ON s.organizer_id = oc.organizer_id
    LEFT JOIN public.organizer_outreach_contacts ct
           ON ct.organizer_outreach_campaign_id = oc.id AND ct.is_primary = true
    WHERE oc.id = p_campaign_id
    LIMIT 1;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_email');
  END IF;

  -- 1) Blacklist globale : c'est elle qui protege toutes les vues
  INSERT INTO public.email_blacklist (email_normalized, reason, source, note)
  VALUES (
    v_email,
    'opt_out_global',
    'unsubscribe_link',
    'Désinscription depuis le lien email' || COALESCE(' · ' || v_event_name, '')
  )
  ON CONFLICT (email_normalized) DO UPDATE
    SET source = 'unsubscribe_link',
        reason = 'opt_out_global',
        note   = COALESCE(public.email_blacklist.note, EXCLUDED.note)
    WHERE public.email_blacklist.source <> 'unsubscribe_link';

  -- 2) Journal
  INSERT INTO public.outreach_unsubscribe_events (
    email_normalized, campaign_id, organizer_campaign_id, event_id,
    company_name, event_name, sequence_type, user_agent
  )
  VALUES (
    v_email, v_expo_camp, v_orga_camp, v_event_id,
    v_company, v_event_name, v_sequence, left(COALESCE(p_user_agent, ''), 400)
  );

  -- 3) Arret des campagnes exposant portant cette adresse
  UPDATE public.outreach_campaigns oc
  SET stop_reason     = 'unsubscribe',
      stop_note       = COALESCE(oc.stop_note, 'Désinscription destinataire (lien email)'),
      stopped_at      = COALESCE(oc.stopped_at, now()),
      campaign_status = 'stopped',
      updated_at      = now()
  WHERE oc.stop_reason IS DISTINCT FROM 'unsubscribe'
    AND (
      lower(btrim(oc.contact_email)) = v_email
      OR oc.id IN (
        SELECT c2.outreach_campaign_id
        FROM public.outreach_contacts c2
        WHERE lower(btrim(c2.contact_email)) = v_email
      )
    );
  GET DIAGNOSTICS v_stopped_expo = ROW_COUNT;

  -- 4) Arret des campagnes organisateur portant cette adresse
  UPDATE public.organizer_outreach_campaigns oc
  SET stop_reason       = 'unsubscribe',
      stop_note         = COALESCE(oc.stop_note, 'Désinscription destinataire (lien email)'),
      stopped_at        = COALESCE(oc.stopped_at, now()),
      opt_out           = true,
      claim_status      = 'opted_out',
      activation_status = CASE WHEN oc.activation_status = 'not_started'
                               THEN 'not_started' ELSE 'stopped' END,
      updated_at        = now()
  WHERE oc.stop_reason IS DISTINCT FROM 'unsubscribe'
    AND (
      lower(btrim(oc.contact_email)) = v_email
      OR oc.id IN (
        SELECT ct2.organizer_outreach_campaign_id
        FROM public.organizer_outreach_contacts ct2
        WHERE lower(btrim(ct2.contact_email)) = v_email
      )
    );
  GET DIAGNOSTICS v_stopped_orga = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'campaigns_stopped', v_stopped_expo,
    'organizer_campaigns_stopped', v_stopped_orga,
    'event_slug', v_event_slug
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Blocage admin au niveau organisateur, pilote depuis une fiche salon
--    Ces deux RPC sont la seule surface exposee a authenticated dans ce lot.
--    Elles gardent is_admin() en premiere ligne.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_event_organizer_outreach_state(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'organizer_id',       o.id,
    'organizer_name',     o.name,
    'primary_domain',     o.primary_domain,
    'outreach_blocked',   o.outreach_blocked,
    'blocked_reason',     o.blocked_reason,
    'blocked_at',         o.blocked_at,
    'nb_salons_total',    COALESCE(s.nb_salons_total, 0),
    'nb_salons_a_venir',  COALESCE(s.nb_salons_a_venir, 0),
    'campaign_id',        c.id,
    'claim_status',       c.claim_status,
    'claim_step',         c.claim_step,
    'last_sent_at',       c.last_sent_at,
    'next_send_at',       c.next_send_at,
    'stop_reason',        c.stop_reason,
    'has_contact',        (c.id IS NOT NULL AND EXISTS (
                             SELECT 1 FROM organizer_outreach_contacts ct
                             WHERE ct.organizer_outreach_campaign_id = c.id))
  )
  INTO v
  FROM events e
  JOIN organizer_domains od ON od.domain = e.url_site_officiel_domain
  JOIN organizers o ON o.id = od.organizer_id
  LEFT JOIN v_organizers_summary s ON s.organizer_id = o.id
  LEFT JOIN organizer_outreach_campaigns c ON c.organizer_id = o.id
  WHERE e.id = p_event_id
  LIMIT 1;

  RETURN COALESCE(v, jsonb_build_object('organizer_id', NULL));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_organizer_outreach_block(
  p_event_id uuid,
  p_blocked  boolean,
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_organizer_id uuid;
  v_salons       integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT o.id INTO v_organizer_id
  FROM events e
  JOIN organizer_domains od ON od.domain = e.url_site_officiel_domain
  JOIN organizers o ON o.id = od.organizer_id
  WHERE e.id = p_event_id
  LIMIT 1;

  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'organizer_not_found');
  END IF;

  SELECT COALESCE(nb_salons_total, 0) INTO v_salons
  FROM v_organizers_summary WHERE organizer_id = v_organizer_id;

  IF p_blocked THEN
    UPDATE organizers
    SET outreach_blocked = true,
        blocked_reason   = COALESCE(p_reason, 'Blocage admin'),
        blocked_at       = now(),
        blocked_by       = auth.uid()
    WHERE id = v_organizer_id;

    UPDATE organizer_outreach_campaigns
    SET stop_reason       = 'admin_block',
        stop_note         = COALESCE(p_reason, 'Blocage admin'),
        stopped_at        = now(),
        stopped_by        = auth.uid(),
        claim_status      = 'stopped',
        activation_status = CASE WHEN activation_status = 'not_started'
                                 THEN 'not_started' ELSE 'stopped' END
    WHERE organizer_id = v_organizer_id
      AND stop_reason IS DISTINCT FROM 'unsubscribe';
  ELSE
    UPDATE organizers
    SET outreach_blocked = false,
        blocked_reason   = NULL,
        blocked_at       = NULL,
        blocked_by       = NULL
    WHERE id = v_organizer_id;

    -- On ne reactive que ce que l'admin avait lui-meme arrete.
    -- Une desinscription du destinataire n'est jamais annulee ici.
    UPDATE organizer_outreach_campaigns
    SET stop_reason       = NULL,
        stop_note         = NULL,
        stopped_at        = NULL,
        stopped_by        = NULL,
        claim_status      = CASE WHEN claim_step = 0 THEN 'pending' ELSE 'active' END,
        activation_status = CASE WHEN activation_status = 'stopped' AND activation_step > 0
                                 THEN 'active' ELSE activation_status END
    WHERE organizer_id = v_organizer_id
      AND stop_reason = 'admin_block';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organizer_id', v_organizer_id,
    'blocked', p_blocked,
    'salons_impactes', v_salons
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Droits
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_recent_exhibitor_send(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_recent_organizer_send(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_recent_exhibitor_send(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_recent_organizer_send(text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.outreach_unsubscribe(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_unsubscribe(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_event_organizer_outreach_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_organizer_outreach_state(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_organizer_outreach_block(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_organizer_outreach_block(uuid, boolean, text) TO authenticated, service_role;

-- ============================================================================
-- 7. Application du plafond croise dans les trois vues
--    Les deux vues exposant sont recreees a l'identique, avec un seul
--    predicat ajoute. Elles n'ont volontairement PAS d'option
--    security_invoker : on reproduit l'etat existant pour ne pas modifier
--    leur semantique de droits.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_eligibles_revendication AS
 SELECT oc.id,
    c.contact_email,
    c.first_name,
    oc.company_name,
    e.nom_event,
    slug.public_slug,
    oc.claim_step,
    ( SELECT count(*) AS count
           FROM outreach_campaigns oc2
          WHERE oc2.event_id = oc.event_id AND oc2.claim_status = 'claimed'::text) AS claimed_count,
    oc.next_send_at
   FROM outreach_campaigns oc
     JOIN events e ON e.id = oc.event_id
     LEFT JOIN participation p ON p.id_participation = oc.participation_id
     LEFT JOIN outreach_contacts c ON c.outreach_campaign_id = oc.id AND c.is_primary = true
     LEFT JOIN LATERAL ( SELECT COALESCE(( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = oc.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = p.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = oc.id_exposant_legacy AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true
                 LIMIT 1)) AS public_slug) slug ON true
  WHERE oc.hunter_status = 'ready'::text
    AND c.contact_email IS NOT NULL
    AND (oc.claim_status = ANY (ARRAY['pending'::text, 'active'::text]))
    AND oc.opt_out = false
    AND NOT is_email_blacklisted(c.contact_email)
    AND NOT public.has_recent_organizer_send(c.contact_email, 21)
    AND oc.claim_step < 2
    AND (oc.next_send_at IS NULL OR oc.next_send_at <= now())
    AND e.date_debut >= (CURRENT_DATE + 3)
    AND e.date_debut <= (CURRENT_DATE + 90)
    AND e.visible = true
    AND e.is_test = false
    AND slug.public_slug IS NOT NULL
    AND oc.stop_reason IS NULL
    AND (COALESCE(oc.campaign_status, ''::text) <> ALL (ARRAY['stopped'::text, 'opted_out'::text, 'completed'::text, 'converted'::text, 'blocked_invalid_email'::text, 'novelty_published'::text, 'expired'::text]))
  ORDER BY oc.claim_step DESC, e.date_debut, oc.event_id, oc.next_send_at NULLS FIRST, oc.id;

CREATE OR REPLACE VIEW public.v_eligibles_nouveaute AS
 SELECT oc.id,
    c.contact_email,
    c.first_name,
    oc.company_name,
    e.nom_event,
    slug.public_slug,
    oc.novelty_step,
    oc.next_send_at,
    oc.event_id,
    e.date_debut,
    e.slug AS event_slug
   FROM outreach_campaigns oc
     JOIN events e ON e.id = oc.event_id
     LEFT JOIN participation p ON p.id_participation = oc.participation_id
     LEFT JOIN outreach_contacts c ON c.outreach_campaign_id = oc.id AND c.is_primary = true
     LEFT JOIN LATERAL ( SELECT COALESCE(( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = oc.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.exhibitor_id = p.exhibitor_id AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = oc.id_exposant_legacy AND epi.is_active = true
                 LIMIT 1), ( SELECT epi.public_slug
                   FROM exhibitor_public_identities epi
                  WHERE epi.legacy_exposant_id = p.id_exposant AND epi.is_active = true
                 LIMIT 1)) AS public_slug) slug ON true
  WHERE oc.claim_status = 'claimed'::text
    AND oc.novelty_status = 'active'::text
    AND oc.opt_out = false
    AND NOT is_email_blacklisted(c.contact_email)
    AND NOT public.has_recent_organizer_send(c.contact_email, 21)
    AND oc.novelty_step < 3
    AND (oc.next_send_at IS NULL OR oc.next_send_at <= now())
    AND e.date_debut >= (CURRENT_DATE + 3)
    AND e.visible = true
    AND e.is_test = false
    AND NOT (EXISTS ( SELECT 1
           FROM novelties n
          WHERE n.exhibitor_id = oc.exhibitor_id AND n.event_id = oc.event_id AND n.status = 'published'::text AND n.is_test = false))
    AND oc.stop_reason IS NULL
    AND (COALESCE(oc.campaign_status, ''::text) <> ALL (ARRAY['stopped'::text, 'opted_out'::text, 'completed'::text, 'converted'::text, 'blocked_invalid_email'::text, 'novelty_published'::text, 'expired'::text]))
  ORDER BY oc.novelty_step DESC, oc.next_send_at NULLS FIRST, oc.id;

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
  AND NOT public.has_recent_exhibitor_send(ct.contact_email, 21)
  AND s.outreach_blocked = false
  AND s.nb_salons_revendiques = 0
  AND s.nb_salons_a_venir > 0
  AND s.next_event_date >= CURRENT_DATE + 7
  AND s.next_event_date <= CURRENT_DATE + 270
  AND s.next_event_slug IS NOT NULL
ORDER BY c.claim_step DESC, s.next_event_date, c.next_send_at NULLS FIRST, c.id;
