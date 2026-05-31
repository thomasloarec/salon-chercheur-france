-- ============================================================
-- Phase 4A-B (V3) — Backend sécurisé édition gestionnaire
-- 1) Durcir protect_exhibitor_columns : name, name_normalized, slug
-- 2) Fonction d'extraction sécurisée exhibitor_id depuis chemin logo
-- 3) Bucket exhibitor-logos + policies idempotentes (UPDATE: USING + WITH CHECK)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) Trigger protect_exhibitor_columns (defense in depth)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_exhibitor_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins et service_role (validation de claim / edge functions) : accès total
  IF public.is_admin() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Pour un owner : on force la valeur OLD sur chaque colonne sensible.

  -- Identité publique / nom / slug (Phase 4A-B : defense in depth)
  -- name protégé pour les non-admins. trg_exhibitors_name_normalized
  -- (BEFORE UPDATE OF name) s'exécute APRÈS ce trigger (ordre alphabétique :
  -- protect_exhibitor_columns_trigger 'p' < trg_exhibitors_name_normalized 't'),
  -- il recalcule name_normalized depuis NEW.name = OLD.name → identique à
  -- OLD.name_normalized. On force quand même name_normalized ici pour
  -- documenter l'intention.
  NEW.name                 := OLD.name;
  NEW.name_normalized      := OLD.name_normalized;
  NEW.slug                 := OLD.slug;

  -- Gouvernance / modération
  NEW.approved             := OLD.approved;
  NEW.plan                 := OLD.plan;
  NEW.verified_at          := OLD.verified_at;
  NEW.is_test              := OLD.is_test;
  NEW.owner_user_id        := OLD.owner_user_id;
  NEW.created_at           := OLD.created_at;

  -- CRM / outreach
  NEW.contact_email        := OLD.contact_email;
  NEW.contact_prenom       := OLD.contact_prenom;
  NEW.contact_poste        := OLD.contact_poste;
  NEW.contact_score        := OLD.contact_score;
  NEW.campaign_status      := OLD.campaign_status;
  NEW.campaign_eligible    := OLD.campaign_eligible;
  NEW.campaign_stop_reason := OLD.campaign_stop_reason;
  NEW.email_source         := OLD.email_source;
  NEW.opt_out              := OLD.opt_out;
  NEW.hunter_search_done   := OLD.hunter_search_done;
  NEW.hunter_verify_done   := OLD.hunter_verify_done;
  NEW.is_generic_inbox     := OLD.is_generic_inbox;
  NEW.pre_hunter_score     := OLD.pre_hunter_score;
  NEW.company_size_signal  := OLD.company_size_signal;
  NEW.company_tier         := OLD.company_tier;
  NEW.current_step         := OLD.current_step;
  NEW.last_sent_at         := OLD.last_sent_at;
  NEW.next_send_date       := OLD.next_send_date;
  NEW.outlook_message_id   := OLD.outlook_message_id;
  NEW.outlook_conv_id      := OLD.outlook_conv_id;
  NEW.reply_status         := OLD.reply_status;
  NEW.reply_date           := OLD.reply_date;

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────
-- 2) Extraction sécurisée de l'exhibitor_id depuis le chemin logo
--    Chemin attendu : exhibitors/{exhibitor_id}/{filename}
--    Retourne NULL si le chemin est mal formé / segment non-UUID.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.extract_exhibitor_id_from_logo_path(object_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  parts     text[];
  candidate text;
BEGIN
  IF object_name IS NULL OR length(btrim(object_name)) = 0 THEN
    RETURN NULL;
  END IF;

  parts := storage.foldername(object_name);

  IF parts IS NULL OR array_length(parts, 1) < 2 THEN
    RETURN NULL;
  END IF;

  IF parts[1] IS DISTINCT FROM 'exhibitors' THEN
    RETURN NULL;
  END IF;

  candidate := parts[2];

  IF candidate IS NULL
     OR candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  RETURN candidate::uuid;
END;
$function$;

-- ─────────────────────────────────────────────
-- 3) Bucket exhibitor-logos (public, 5 Mo, jpeg/png/webp ; SVG refusé)
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exhibitor-logos',
  'exhibitor-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies idempotentes
DROP POLICY IF EXISTS "Exhibitor logos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Managers can upload exhibitor logos"   ON storage.objects;
DROP POLICY IF EXISTS "Managers can update exhibitor logos"   ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete exhibitor logos"   ON storage.objects;

-- SELECT : public (bucket public)
CREATE POLICY "Exhibitor logos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'exhibitor-logos');

-- INSERT
CREATE POLICY "Managers can upload exhibitor logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'exhibitor-logos'
  AND auth.uid() IS NOT NULL
  AND public.extract_exhibitor_id_from_logo_path(name) IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.exhibitors e
      WHERE e.id = public.extract_exhibitor_id_from_logo_path(name)
        AND e.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.exhibitor_team_members tm
      WHERE tm.exhibitor_id = public.extract_exhibitor_id_from_logo_path(name)
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.status = 'active'
    )
    OR public.is_admin()
  )
);

-- UPDATE : USING (ligne existante) + WITH CHECK (chemin d'arrivée)
CREATE POLICY "Managers can update exhibitor logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'exhibitor-logos'
  AND auth.uid() IS NOT NULL
  AND public.extract_exhibitor_id_from_logo_path(name) IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.exhibitors e
      WHERE e.id = public.extract_exhibitor_id_from_logo_path(name)
        AND e.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.exhibitor_team_members tm
      WHERE tm.exhibitor_id = public.extract_exhibitor_id_from_logo_path(name)
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.status = 'active'
    )
    OR public.is_admin()
  )
)
WITH CHECK (
  bucket_id = 'exhibitor-logos'
  AND auth.uid() IS NOT NULL
  AND public.extract_exhibitor_id_from_logo_path(name) IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.exhibitors e
      WHERE e.id = public.extract_exhibitor_id_from_logo_path(name)
        AND e.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.exhibitor_team_members tm
      WHERE tm.exhibitor_id = public.extract_exhibitor_id_from_logo_path(name)
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.status = 'active'
    )
    OR public.is_admin()
  )
);

-- DELETE
CREATE POLICY "Managers can delete exhibitor logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'exhibitor-logos'
  AND auth.uid() IS NOT NULL
  AND public.extract_exhibitor_id_from_logo_path(name) IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.exhibitors e
      WHERE e.id = public.extract_exhibitor_id_from_logo_path(name)
        AND e.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.exhibitor_team_members tm
      WHERE tm.exhibitor_id = public.extract_exhibitor_id_from_logo_path(name)
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.status = 'active'
    )
    OR public.is_admin()
  )
);