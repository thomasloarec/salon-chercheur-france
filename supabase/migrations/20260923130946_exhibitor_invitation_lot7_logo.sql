-- =====================================================================
-- Lot 7 : page d'invitation, logo exposant
-- build_invitation_payload : ajoute exhibitor.website pour le repli favicon
-- (les fiches sans logo téléversé affichent le favicon du site, comme partout ailleurs).
-- Aucun autre changement ; droits inchangés (fonction interne).
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
  v_website text;
BEGIN
  IF p_invitation_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.exhibitor_invitation_pages WHERE id = p_invitation_id;
  END IF;

  SELECT p.display_name, p.logo_url, p.public_slug INTO v_ex
  FROM public.public_exhibitor_profiles p WHERE p.exhibitor_id = p_exhibitor_id LIMIT 1;

  -- Site web : repli favicon quand aucun logo n'a été téléversé (même règle que le reste du site).
  SELECT NULLIF(btrim(x.website), '') INTO v_website FROM public.exhibitors x WHERE x.id = p_exhibitor_id;

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
      'id', p_exhibitor_id, 'name', v_ex.display_name, 'logo_url', v_ex.logo_url, 'website', v_website, 'public_slug', v_ex.public_slug),
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

NOTIFY pgrst, 'reload schema';
