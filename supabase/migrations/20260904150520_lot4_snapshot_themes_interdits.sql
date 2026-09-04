-- ============================================================
-- WF5 — Lot 4 : distinction "theme non necessaire" / "theme interdit".
--
-- themes_autorises repond a : de quoi faut-il parler ?
-- themes_interdits  repond a : de quoi n'a-t-on PAS le droit de parler ?
--
-- Un theme peut etre absent de themes_autorises pour deux raisons
-- opposees :
--   - le gap est comble (l'organisateur a deja son programme) : rien a
--     demander, mais le mot reste dicible ;
--   - l'ancre est absente (aucun exposant nulle part, nature inconnue) :
--     le sujet est interdit sous toute forme, y compris en exemple.
--
-- Seul le second cas doit verrouiller la redaction. Sans cette
-- distinction, un controle lexical produit des faux positifs et finit
-- par etre ignore.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_organizer_activation_themes_interdits(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap      jsonb;
  v_interdits text[] := ARRAY[]::text[];
BEGIN
  v_snap := public.get_organizer_activation_snapshot(p_campaign_id);

  IF COALESCE(v_snap ->> 'ok', 'false') <> 'true' THEN
    RETURN '["exposants","programme","fil","nouveautes"]'::jsonb;
  END IF;

  -- Exposants : interdit si aucun salon n'a d'ancre exposants averee.
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_snap -> 'salons') s
    WHERE (s -> 'expects_exhibitors')::text = 'true'
  ) THEN
    v_interdits := v_interdits || 'exposants'::text;
  END IF;

  -- Programme : interdit uniquement si l'admin l'a explicitement exclu
  -- sur tous les salons.
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_snap -> 'salons') s
    WHERE COALESCE((s -> 'expects_program')::text, 'null') <> 'false'
  ) THEN
    v_interdits := v_interdits || 'programme'::text;
  END IF;

  -- Nouveautes : sans aucun exposant reference, aucune nouveaute n'est
  -- possible, le sujet n'a pas de sens.
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_snap -> 'salons') s
    WHERE (s ->> 'nb_exposants')::int > 0
  ) THEN
    v_interdits := v_interdits || 'nouveautes'::text;
  END IF;

  -- Le Fil n'a pas d'ancre : tout evenement peut publier une actualite.

  RETURN to_jsonb(v_interdits);
END;
$$;

REVOKE ALL ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_organizer_activation_themes_interdits(uuid) TO service_role;

-- Exposition dans la vue d'eligibilite (security_invoker a re-declarer).
CREATE OR REPLACE VIEW public.v_eligibles_activation_organisateur
WITH (security_invoker = true) AS
SELECT
  s.campaign_id,
  s.organizer_id,
  s.organizer_name,
  s.primary_domain,
  r.recipient_email  AS contact_email,
  r.first_name,
  r.owner_user_id,
  s.activation_step,
  s.activation_next_send_at,
  s.first_claimed_at,
  s.nb_salons_revendiques,
  s.next_event_date,
  snap.snapshot,
  snap.snapshot ->> 'next_action'      AS next_action,
  snap.snapshot ->  'themes_autorises' AS themes_autorises,
  public.get_organizer_activation_themes_interdits(s.campaign_id) AS themes_interdits
FROM public.v_organizer_activation_state s
CROSS JOIN LATERAL public.get_organizer_activation_recipient(s.campaign_id) r
CROSS JOIN LATERAL (
  SELECT public.get_organizer_activation_snapshot(s.campaign_id) AS snapshot
) snap
WHERE s.activation_status = 'active'
  AND s.activation_step < 4
  AND s.opt_out = false
  AND s.outreach_blocked = false
  AND s.activation_stop_reason IS NULL
  AND s.activation_next_send_at IS NOT NULL
  AND s.activation_next_send_at <= now()
  AND (s.activation_last_sent_at IS NULL
       OR s.activation_last_sent_at <= now() - interval '5 days')
  AND r.recipient_email IS NOT NULL
  AND r.block_reason IS NULL
  AND (snap.snapshot ->> 'nb_salons_a_venir')::int > 0
  AND (s.activation_step = 0 OR snap.snapshot ->> 'next_action' IS NOT NULL)
ORDER BY s.next_event_date NULLS LAST, s.activation_next_send_at, s.campaign_id;

REVOKE ALL ON public.v_eligibles_activation_organisateur FROM PUBLIC;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM anon;
REVOKE ALL ON public.v_eligibles_activation_organisateur FROM authenticated;
GRANT SELECT ON public.v_eligibles_activation_organisateur TO service_role;
