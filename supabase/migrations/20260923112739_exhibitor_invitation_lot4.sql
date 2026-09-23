-- =====================================================================
-- Lot 4 (backend) : page d'invitation exposant
-- 1. build_invitation_payload : construction commune du contenu de page (interne)
-- 2. get_invitation_page      : + exhibitor.id (envoi des demandes), image_url -> url_image
-- 3. get_invitation_preview   : même contenu pour l'aperçu de l'éditeur, managers seulement,
--                               disponible avant publication
-- =====================================================================

CREATE OR REPLACE FUNCTION public.build_invitation_payload(
  p_exhibitor_id uuid,
  p_event_id     uuid,
  p_novelty_id   uuid,
  p_invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv    public.exhibitor_invitation_pages;
  v_ex     record;
  v_event  record;
  v_nov    record;
  v_stand  text;
  v_legacy text;
BEGIN
  IF p_invitation_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.exhibitor_invitation_pages WHERE id = p_invitation_id;
  END IF;

  SELECT p.display_name, p.logo_url, p.public_slug INTO v_ex
  FROM public.public_exhibitor_profiles p WHERE p.exhibitor_id = p_exhibitor_id LIMIT 1;

  SELECT e.id, e.nom_event, e.slug, e.date_debut, e.date_fin, e.ville, e.nom_lieu, e.url_image INTO v_event
  FROM public.events e WHERE e.id = p_event_id;

  SELECT n.title, n.type, n.summary, n.reason_1, n.reason_2, n.reason_3, n.media_urls, n.slug, n.stand_info INTO v_nov
  FROM public.novelties n WHERE n.id = p_novelty_id;

  SELECT epi.legacy_exposant_id INTO v_legacy
  FROM public.exhibitor_public_identities epi
  WHERE epi.exhibitor_id = p_exhibitor_id AND epi.legacy_exposant_id IS NOT NULL LIMIT 1;

  SELECT NULLIF(btrim(pa.stand_exposant), '') INTO v_stand
  FROM public.participation pa
  WHERE pa.id_event = p_event_id
    AND (pa.exhibitor_id = p_exhibitor_id
         OR pa.id_exposant = p_exhibitor_id::text
         OR (v_legacy IS NOT NULL AND pa.id_exposant = v_legacy))
    AND NULLIF(btrim(pa.stand_exposant), '') IS NOT NULL
  LIMIT 1;

  RETURN jsonb_build_object(
    'active', true,
    'reason', 'ok',
    'slug', v_inv.slug,
    'headline', v_inv.headline,
    'message', v_inv.message,
    'exhibitor', jsonb_build_object(
      'id', p_exhibitor_id, 'name', v_ex.display_name, 'logo_url', v_ex.logo_url, 'public_slug', v_ex.public_slug),
    'event', jsonb_build_object(
      'id', v_event.id, 'name', v_event.nom_event, 'slug', v_event.slug,
      'date_debut', v_event.date_debut, 'date_fin', v_event.date_fin,
      'ville', v_event.ville, 'nom_lieu', v_event.nom_lieu, 'url_image', v_event.url_image),
    'stand', COALESCE(v_stand, NULLIF(btrim(v_nov.stand_info), '')),
    'novelty', CASE WHEN v_nov.title IS NULL THEN NULL ELSE jsonb_build_object(
      'title', v_nov.title, 'type', v_nov.type, 'summary', v_nov.summary,
      'reasons', to_jsonb(array_remove(ARRAY[v_nov.reason_1, v_nov.reason_2, v_nov.reason_3], NULL)),
      'url_image', v_nov.media_urls[1], 'slug', v_nov.slug) END,
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'first_name', st.first_name, 'last_name', st.last_name,
               'job_title', st.job_title, 'photo_url', st.photo_url,
               'linkedin_url', st.linkedin_url)
             ORDER BY eis.sort_order, st.sort_order)
      FROM public.exhibitor_invitation_page_staff eis
      JOIN public.exhibitor_staff st ON st.id = eis.staff_id AND st.is_active
      WHERE p_invitation_id IS NOT NULL AND eis.invitation_id = p_invitation_id), '[]'::jsonb)
  );
END;
$$;
-- Fonction interne : jamais appelable directement depuis l'API.
REVOKE ALL ON FUNCTION public.build_invitation_payload(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Page publique : contrôles d'activité inchangés, contenu délégué au constructeur commun.
CREATE OR REPLACE FUNCTION public.get_invitation_page(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv    public.exhibitor_invitation_pages;
  v_ex     record;
  v_event  record;
  v_nov    record;
  v_reason text := 'ok';
BEGIN
  SELECT * INTO v_inv FROM public.exhibitor_invitation_pages
  WHERE slug = lower(p_slug) AND status = 'published';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'reason', 'not_found');
  END IF;

  SELECT p.display_name, p.public_slug, COALESCE(p.is_test, false) AS is_test INTO v_ex
  FROM public.public_exhibitor_profiles p WHERE p.exhibitor_id = v_inv.exhibitor_id LIMIT 1;
  IF NOT FOUND OR v_ex.is_test THEN
    RETURN jsonb_build_object('active', false, 'reason', 'not_found');
  END IF;

  SELECT e.nom_event, e.slug, e.date_debut, e.date_fin, e.visible, COALESCE(e.is_test, false) AS is_test INTO v_event
  FROM public.events e WHERE e.id = v_inv.event_id;
  IF NOT FOUND OR v_event.visible IS NOT TRUE OR v_event.is_test THEN
    RETURN jsonb_build_object('active', false, 'reason', 'not_found');
  END IF;

  SELECT n.id, n.status INTO v_nov
  FROM public.novelties n WHERE n.id = v_inv.novelty_id AND n.is_test = false;

  IF COALESCE(v_event.date_fin, v_event.date_debut) < CURRENT_DATE THEN
    v_reason := 'event_over';
  ELSIF v_nov.id IS NULL OR v_nov.status <> 'published' THEN
    v_reason := 'novelty_unavailable';
  END IF;

  IF v_reason <> 'ok' THEN
    RETURN jsonb_build_object(
      'active', false,
      'reason', v_reason,
      'exhibitor', jsonb_build_object('name', v_ex.display_name, 'public_slug', v_ex.public_slug),
      'event', jsonb_build_object('name', v_event.nom_event, 'slug', v_event.slug)
    );
  END IF;

  RETURN public.build_invitation_payload(v_inv.exhibitor_id, v_inv.event_id, v_inv.novelty_id, v_inv.id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_invitation_page(text) FROM PUBLIC;
-- Ouverture publique INTENTIONNELLE (page destinée à des visiteurs non connectés).
GRANT EXECUTE ON FUNCTION public.get_invitation_page(text) TO anon, authenticated;

-- Aperçu de l'éditeur : managers de la fiche ou admin, avant ou après publication.
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_exhibitor_id uuid, p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_novelty_id uuid;
  v_inv_id     uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_team_member(p_exhibitor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT n.id INTO v_novelty_id
  FROM public.novelties n
  WHERE n.exhibitor_id = p_exhibitor_id AND n.event_id = p_event_id
    AND n.status = 'published' AND n.is_test = false
  ORDER BY n.updated_at DESC NULLS LAST
  LIMIT 1;
  IF v_novelty_id IS NULL THEN
    RAISE EXCEPTION 'no_published_novelty';
  END IF;

  SELECT i.id INTO v_inv_id
  FROM public.exhibitor_invitation_pages i
  WHERE i.exhibitor_id = p_exhibitor_id AND i.event_id = p_event_id;

  RETURN public.build_invitation_payload(p_exhibitor_id, p_event_id, v_novelty_id, v_inv_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_invitation_preview(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
