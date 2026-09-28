-- Sécurité et données, lot B6, étape 1 (28/09/2026)
-- Aucune modification visible sur le site. Trois volets :
--   A. Conversions de prospection : une nouveauté préparée par Lotexpo n'est plus comptée
--      comme une conversion de l'exposant (statut novelty_published, déjà exclu des
--      séquences d'emails comme converted : la prospection se comporte à l'identique).
--   B. Comptage des enregistrements (« likes ») par fonctions SECURITY DEFINER, préalable
--      à la fermeture de la lecture publique de novelty_likes (étape 3, après le lot front).
--   C. Stockage : droits d'écriture et de suppression limités au déposant ou à l'admin,
--      comptes anonymes (recherche IA) exclus des dépôts, et lecture du stockage privé
--      novelty-resources limitée au déposant ou à l'admin.

-- ============================================================================
-- A. Conversions de prospection
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_novelty_conversion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Nouveauté préparée par Lotexpo : la campagne s'arrête (comme avant) mais n'est pas
  -- une conversion de l'exposant. origin est fixé à l'insertion (trigger b_set_novelty_origin).
  v_status text := CASE WHEN NEW.origin = 'lotexpo' THEN 'novelty_published' ELSE 'converted' END;
BEGIN
  -- Chemin 1 : matching direct par exhibitor_id + event_id
  UPDATE outreach_campaigns
  SET campaign_status = v_status,
      novelty_status = 'published',
      novelty_id = NEW.id,
      updated_at = now()
  WHERE event_id = NEW.event_id
    AND exhibitor_id = NEW.exhibitor_id
    AND campaign_status NOT IN ('converted', 'opted_out', 'novelty_published');

  -- Chemin 2 : matching via participation
  UPDATE outreach_campaigns oc
  SET campaign_status = v_status,
      novelty_status = 'published',
      novelty_id = NEW.id,
      updated_at = now()
  FROM participation p
  WHERE oc.participation_id = p.id_participation
    AND p.exhibitor_id = NEW.exhibitor_id
    AND oc.event_id = NEW.event_id
    AND oc.campaign_status NOT IN ('converted', 'opted_out', 'novelty_published');

  -- Chemin 3 : fallback par website normalisé
  UPDATE outreach_campaigns oc
  SET campaign_status = v_status,
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
    AND oc.campaign_status NOT IN ('converted', 'opted_out', 'novelty_published');

  RETURN NEW;
END;
$function$;

-- Rattrapage : campagnes marquées « converties » par une nouveauté préparée par Lotexpo
UPDATE outreach_campaigns oc
SET campaign_status = 'novelty_published',
    updated_at = now()
FROM novelties n
WHERE n.id = oc.novelty_id
  AND n.origin = 'lotexpo'
  AND oc.campaign_status = 'converted';

-- ============================================================================
-- B. Comptage des enregistrements sans exposer qui a enregistré
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_novelty_likes_count(novelty_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM novelty_likes
  WHERE novelty_id = novelty_uuid;
$function$;

CREATE OR REPLACE FUNCTION public.get_novelty_likes_counts(p_novelty_ids uuid[])
 RETURNS TABLE(novelty_id uuid, likes_count integer)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.novelty_id, COUNT(*)::INTEGER
  FROM novelty_likes l
  WHERE l.novelty_id = ANY (p_novelty_ids)
  GROUP BY l.novelty_id;
$function$;

REVOKE ALL ON FUNCTION public.get_novelty_likes_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_novelty_likes_count(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_novelty_likes_counts(uuid[]) TO anon, authenticated, service_role;

-- ============================================================================
-- C. Stockage
-- ============================================================================
-- Bucket public « novelties » (images et brochures des nouveautés)
DROP POLICY IF EXISTS "Authenticated users can upload novelty files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own novelty files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own novelty files" ON storage.objects;

CREATE POLICY "Real users can upload novelty files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'novelties'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY "Uploader or admin can update novelty files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'novelties' AND (owner_id = auth.uid()::text OR public.is_admin()))
  WITH CHECK (bucket_id = 'novelties' AND (owner_id = auth.uid()::text OR public.is_admin()));

CREATE POLICY "Uploader or admin can delete novelty files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'novelties' AND (owner_id = auth.uid()::text OR public.is_admin()));

-- Bucket privé « novelty-resources » (PDF importés, ressources)
DROP POLICY IF EXISTS "Authenticated users can download resources" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload resources" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their resources" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their resources" ON storage.objects;

CREATE POLICY "Uploader or admin can read resources"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'novelty-resources' AND (owner_id = auth.uid()::text OR public.is_admin()));

CREATE POLICY "Real users can upload resources"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'novelty-resources'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

CREATE POLICY "Uploader or admin can update resources"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'novelty-resources' AND (owner_id = auth.uid()::text OR public.is_admin()))
  WITH CHECK (bucket_id = 'novelty-resources' AND (owner_id = auth.uid()::text OR public.is_admin()));

CREATE POLICY "Uploader or admin can delete resources"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'novelty-resources' AND (owner_id = auth.uid()::text OR public.is_admin()));
