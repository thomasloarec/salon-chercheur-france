-- ============================================================================
-- LOT 3 (backend) — Admin organisateurs : liste, détail, fusion, édition
-- Appliquée en production le 2026-09-03 via Supabase MCP.
-- Migration enregistrée : lot3_rpc_fusion_organisateurs_et_liste_admin
--
-- Complète les deux RPC du Lot 2 (get_event_organizer_outreach_state,
-- admin_set_organizer_outreach_block) déjà en base et utilisées par le
-- toggle de blocage sur la fiche salon. Ce lot ajoute uniquement ce qui
-- manque côté données pour la section admin Organisateurs et la fusion
-- manuelle des groupes multi-domaines.
--
-- Vérifié : fusion age-3.fr -> petitenfance.net déplace 9 domaines et
-- supprime la source (test avec rollback, aucune donnée modifiée).
-- Aucun grant anon sur les quatre RPC.
-- ============================================================================

-- 1. Liste des organisateurs (pagination + recherche + filtre bloqués)
CREATE OR REPLACE FUNCTION public.admin_list_organizers(
  p_search text DEFAULT NULL,
  p_only_blocked boolean DEFAULT false,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  organizer_id     uuid,
  organizer_name   text,
  primary_domain   text,
  outreach_blocked boolean,
  nb_domaines      integer,
  nb_salons_total  integer,
  nb_salons_a_venir integer,
  nb_salons_revendiques integer,
  campaign_id      uuid,
  claim_status     text,
  claim_step       integer,
  hunter_status    text,
  last_sent_at     timestamptz,
  next_event_date  date,
  total_count      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      o.id,
      o.name,
      o.primary_domain,
      o.outreach_blocked,
      (SELECT count(*) FROM organizer_domains d WHERE d.organizer_id = o.id)::int AS nb_domaines,
      COALESCE(s.nb_salons_total, 0)::int       AS nb_salons_total,
      COALESCE(s.nb_salons_a_venir, 0)::int     AS nb_salons_a_venir,
      COALESCE(s.nb_salons_revendiques, 0)::int AS nb_salons_revendiques,
      c.id            AS campaign_id,
      c.claim_status,
      c.claim_step,
      c.hunter_status,
      c.last_sent_at,
      s.next_event_date
    FROM organizers o
    LEFT JOIN v_organizers_summary s ON s.organizer_id = o.id
    LEFT JOIN organizer_outreach_campaigns c ON c.organizer_id = o.id
    WHERE (p_search IS NULL OR p_search = ''
           OR o.name ILIKE '%'||p_search||'%'
           OR o.primary_domain ILIKE '%'||p_search||'%')
      AND (NOT p_only_blocked OR o.outreach_blocked)
  ),
  counted AS (SELECT count(*) AS n FROM base)
  SELECT
    b.id, b.name, b.primary_domain, b.outreach_blocked,
    b.nb_domaines, b.nb_salons_total, b.nb_salons_a_venir, b.nb_salons_revendiques,
    b.campaign_id, b.claim_status, b.claim_step, b.hunter_status,
    b.last_sent_at, b.next_event_date,
    (SELECT n FROM counted) AS total_count
  FROM base b
  ORDER BY b.nb_salons_a_venir DESC NULLS LAST, b.name
  LIMIT LEAST(GREATEST(p_limit, 1), 500)
  OFFSET GREATEST(p_offset, 0);
END;
$function$;

-- 2. Détail d'un organisateur (domaines + salons + campagne)
CREATE OR REPLACE FUNCTION public.admin_get_organizer_detail(p_organizer_id uuid)
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
    'organizer_id',     o.id,
    'organizer_name',   o.name,
    'primary_domain',   o.primary_domain,
    'outreach_blocked', o.outreach_blocked,
    'blocked_reason',   o.blocked_reason,
    'note',             o.note,
    'domains', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('domain', d.domain) ORDER BY d.domain)
      FROM organizer_domains d WHERE d.organizer_id = o.id
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'nom_event', e.nom_event, 'date_debut', e.date_debut,
        'domain', e.url_site_officiel_domain,
        'revendique', (e.owner_user_id IS NOT NULL)
      ) ORDER BY e.date_debut DESC)
      FROM events e
      JOIN organizer_domains d ON d.domain = e.url_site_officiel_domain
      WHERE d.organizer_id = o.id AND e.visible = true AND COALESCE(e.is_test,false) = false
    ), '[]'::jsonb),
    'campaign', (
      SELECT jsonb_build_object(
        'id', c.id, 'claim_status', c.claim_status, 'claim_step', c.claim_step,
        'hunter_status', c.hunter_status, 'last_sent_at', c.last_sent_at,
        'stop_reason', c.stop_reason
      )
      FROM organizer_outreach_campaigns c WHERE c.organizer_id = o.id
    )
  )
  INTO v
  FROM organizers o WHERE o.id = p_organizer_id;

  RETURN COALESCE(v, jsonb_build_object('organizer_id', NULL));
END;
$function$;

-- 3. Fusion manuelle : absorbe p_source dans p_target
CREATE OR REPLACE FUNCTION public.admin_merge_organizers(
  p_target_id uuid,
  p_source_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sent          integer;
  v_moved         integer := 0;
  v_source_block  boolean;
  v_target_block  boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_target_id = p_source_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_organizer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizers WHERE id = p_target_id)
     OR NOT EXISTS (SELECT 1 FROM organizers WHERE id = p_source_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'organizer_not_found');
  END IF;

  -- Garde-fou : aucune fusion si un email est deja parti de part ou d'autre
  SELECT count(*) INTO v_sent
  FROM organizer_outreach_campaigns
  WHERE organizer_id IN (p_target_id, p_source_id)
    AND (last_sent_at IS NOT NULL OR claim_step > 0);

  IF v_sent > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_already_sent');
  END IF;

  SELECT outreach_blocked INTO v_source_block FROM organizers WHERE id = p_source_id;
  SELECT outreach_blocked INTO v_target_block FROM organizers WHERE id = p_target_id;

  UPDATE organizer_domains SET organizer_id = p_target_id WHERE organizer_id = p_source_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  IF v_source_block AND NOT v_target_block THEN
    UPDATE organizers
    SET outreach_blocked = true,
        blocked_reason = COALESCE(blocked_reason, 'Blocage herite lors d une fusion manuelle'),
        blocked_at = COALESCE(blocked_at, now()),
        blocked_by = auth.uid()
    WHERE id = p_target_id;
  END IF;

  DELETE FROM organizer_outreach_campaigns WHERE organizer_id = p_source_id;
  DELETE FROM organizers WHERE id = p_source_id;

  RETURN jsonb_build_object(
    'ok', true,
    'target_id', p_target_id,
    'source_id', p_source_id,
    'domains_moved', v_moved
  );
END;
$function$;

-- 4. Édition légère : nom, note
CREATE OR REPLACE FUNCTION public.admin_update_organizer(
  p_organizer_id uuid,
  p_name text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE organizers
  SET name = COALESCE(NULLIF(btrim(p_name), ''), name),
      note = CASE WHEN p_note IS NULL THEN note ELSE NULLIF(btrim(p_note), '') END
  WHERE id = p_organizer_id;

  RETURN jsonb_build_object('ok', FOUND);
END;
$function$;

-- 5. Droits : admin uniquement (jamais anon)
REVOKE ALL ON FUNCTION public.admin_list_organizers(text, boolean, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_organizer_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_merge_organizers(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_organizer(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_organizers(text, boolean, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_organizer_detail(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_merge_organizers(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_organizer(uuid, text, text) TO authenticated, service_role;
