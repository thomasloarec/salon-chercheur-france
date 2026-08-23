-- =====================================================================
-- Lot 1 : page salon adaptative, volet exposants
-- Applique en production le 23/08/2026 via Supabase MCP.
-- Ce fichier est la trace a committer dans supabase/migrations/.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonne declarative sur events
-- ---------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS has_exhibitors boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_exhibitors_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_exhibitors_set_by uuid;

COMMENT ON COLUMN public.events.has_exhibitors IS
  'Nature de l''evenement : mobilise ou non des exposants. Pilote l''affichage des sections Nouveautes et Exposants, du Radar CRM et du Parcours IA. Ne jamais confondre avec exhibitor_sourcing_ignored (pilotage interne du sourcing).';

ALTER TABLE public.staging_events_import
  ADD COLUMN IF NOT EXISTS has_exhibitors boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_events_has_exhibitors
  ON public.events (has_exhibitors)
  WHERE has_exhibitors = false;

-- ---------------------------------------------------------------------
-- 2. Chemin d'ecriture unique : admin plateforme OU organisateur proprietaire
--    L'admin n'a pas besoin de revendiquer une page pour la modifier.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_event_exhibitor_visibility(
  p_event_id uuid,
  p_enabled  boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := is_admin();
BEGIN
  IF NOT v_is_admin AND NOT is_event_owner(p_event_id) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  UPDATE events
  SET has_exhibitors        = p_enabled,
      has_exhibitors_set_at = now(),
      has_exhibitors_set_by = auth.uid(),
      updated_at            = now()
  WHERE id = p_event_id;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_event_exhibitor_visibility(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_event_exhibitor_visibility(uuid, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Liste de suggestion admin (aucune ecriture automatique)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_events_without_exhibitors();

CREATE FUNCTION public.admin_list_events_without_exhibitors()
RETURNS TABLE (
  id                uuid,
  nom_event         text,
  type_event        text,
  date_debut        date,
  ville             text,
  slug              text,
  has_exhibitors    boolean,
  novelty_count     integer,
  is_upcoming       boolean,
  suggestion_forte  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT e.id,
         e.nom_event,
         e.type_event,
         e.date_debut,
         e.ville,
         e.slug,
         e.has_exhibitors,
         (SELECT count(*)::int FROM novelties n
           WHERE n.event_id = e.id AND n.status = 'published' AND n.is_test = false),
         (e.date_debut >= CURRENT_DATE),
         (e.type_event IS DISTINCT FROM 'salon')
  FROM events e
  WHERE e.visible = true
    AND e.is_test = false
    AND NOT EXISTS (SELECT 1 FROM participation p WHERE p.id_event = e.id)
  ORDER BY (e.type_event IS DISTINCT FROM 'salon') DESC,
           (e.date_debut >= CURRENT_DATE) DESC,
           e.date_debut;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_events_without_exhibitors() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_events_without_exhibitors() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. publish_pending_event_atomic : has_exhibitors ecrit UNIQUEMENT a l'INSERT.
--    La branche UPDATE ne le touche jamais, pour qu'un re-import Airtable
--    n'ecrase jamais une decision admin ou organisateur.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_pending_event_atomic(p_id_event text, p_event_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_count integer;
  result_event jsonb;
BEGIN
  RAISE LOG 'publish_pending_event_atomic: Debut pour id_event=%', p_id_event;

  SELECT COUNT(*) INTO existing_count
  FROM events WHERE id_event = p_id_event;

  IF existing_count > 0 THEN
    RAISE LOG 'publish_pending_event_atomic: UPDATE evenement existant %', p_id_event;

    UPDATE events SET
      nom_event = p_event_data->>'nom_event',
      type_event = p_event_data->>'type_event',
      description_event = p_event_data->>'description_event',
      date_debut = (p_event_data->>'date_debut')::date,
      date_fin = (p_event_data->>'date_fin')::date,
      secteur = p_event_data->'secteur',
      url_image = p_event_data->>'url_image',
      url_site_officiel = p_event_data->>'url_site_officiel',
      affluence = p_event_data->>'affluence',
      tarif = p_event_data->>'tarif',
      nom_lieu = p_event_data->>'nom_lieu',
      rue = p_event_data->>'rue',
      code_postal = p_event_data->>'code_postal',
      ville = p_event_data->>'ville',
      pays = COALESCE(p_event_data->>'pays', 'France'),
      location = p_event_data->>'location',
      is_b2b = COALESCE((p_event_data->>'is_b2b')::boolean, false),
      visible = true,
      updated_at = now()
    WHERE id_event = p_id_event
    RETURNING to_jsonb(events.*) INTO result_event;
  ELSE
    RAISE LOG 'publish_pending_event_atomic: INSERT nouveau evenement %', p_id_event;

    INSERT INTO events (
      id_event, nom_event, type_event, description_event,
      date_debut, date_fin, secteur, url_image, url_site_officiel,
      affluence, tarif, nom_lieu, rue, code_postal, ville, pays,
      location, is_b2b, has_exhibitors, visible
    ) VALUES (
      p_id_event,
      p_event_data->>'nom_event',
      p_event_data->>'type_event',
      p_event_data->>'description_event',
      (p_event_data->>'date_debut')::date,
      (p_event_data->>'date_fin')::date,
      p_event_data->'secteur',
      p_event_data->>'url_image',
      p_event_data->>'url_site_officiel',
      p_event_data->>'affluence',
      p_event_data->>'tarif',
      p_event_data->>'nom_lieu',
      p_event_data->>'rue',
      p_event_data->>'code_postal',
      p_event_data->>'ville',
      COALESCE(p_event_data->>'pays', 'France'),
      p_event_data->>'location',
      COALESCE((p_event_data->>'is_b2b')::boolean, false),
      COALESCE((p_event_data->>'has_exhibitors')::boolean, true),
      false
    );

    RAISE LOG 'publish_pending_event_atomic: Publication (visible=true) pour %', p_id_event;

    UPDATE events SET visible = true, updated_at = now()
    WHERE id_event = p_id_event
    RETURNING to_jsonb(events.*) INTO result_event;
  END IF;

  RAISE LOG 'publish_pending_event_atomic: Succes pour %', p_id_event;
  RETURN result_event;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'publish_pending_event_atomic: Erreur pour % - %', p_id_event, SQLERRM;
  RETURN jsonb_build_object(
    'error', true,
    'message', SQLERRM,
    'id_event', p_id_event
  );
END;
$function$;

-- =====================================================================
-- Rollback
-- =====================================================================
-- DROP FUNCTION IF EXISTS public.set_event_exhibitor_visibility(uuid, boolean);
-- DROP FUNCTION IF EXISTS public.admin_list_events_without_exhibitors();
-- DROP INDEX IF EXISTS public.idx_events_has_exhibitors;
-- ALTER TABLE public.staging_events_import DROP COLUMN IF EXISTS has_exhibitors;
-- ALTER TABLE public.events
--   DROP COLUMN IF EXISTS has_exhibitors,
--   DROP COLUMN IF EXISTS has_exhibitors_set_at,
--   DROP COLUMN IF EXISTS has_exhibitors_set_by;
-- Puis restaurer publish_pending_event_atomic sans has_exhibitors dans l'INSERT.
