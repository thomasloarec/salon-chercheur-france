
-- =============================================
-- PHASE 0 ÉTAPE 1 : TRIGGERS DE SÉCURITÉ
-- =============================================

-- 1. TRIGGER PROTECTION EXHIBITORS
-- Colonnes autorisées pour un owner non-admin :
--   name, slug, website, logo_url, description, stand_info, updated_at
-- Toutes les autres colonnes sont verrouillées.

CREATE OR REPLACE FUNCTION public.protect_exhibitor_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can do anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Service role bypass (for edge functions using service_role)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Lock sensitive columns for non-admins
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    NEW.approved := OLD.approved;
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    NEW.plan := OLD.plan;
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    NEW.owner_user_id := OLD.owner_user_id;
  END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    NEW.is_test := OLD.is_test;
  END IF;
  -- CRM / campaign columns
  IF NEW.campaign_eligible IS DISTINCT FROM OLD.campaign_eligible THEN
    NEW.campaign_eligible := OLD.campaign_eligible;
  END IF;
  IF NEW.campaign_status IS DISTINCT FROM OLD.campaign_status THEN
    NEW.campaign_status := OLD.campaign_status;
  END IF;
  IF NEW.campaign_stop_reason IS DISTINCT FROM OLD.campaign_stop_reason THEN
    NEW.campaign_stop_reason := OLD.campaign_stop_reason;
  END IF;
  IF NEW.contact_email IS DISTINCT FROM OLD.contact_email THEN
    NEW.contact_email := OLD.contact_email;
  END IF;
  IF NEW.contact_prenom IS DISTINCT FROM OLD.contact_prenom THEN
    NEW.contact_prenom := OLD.contact_prenom;
  END IF;
  IF NEW.contact_poste IS DISTINCT FROM OLD.contact_poste THEN
    NEW.contact_poste := OLD.contact_poste;
  END IF;
  IF NEW.contact_score IS DISTINCT FROM OLD.contact_score THEN
    NEW.contact_score := OLD.contact_score;
  END IF;
  IF NEW.email_source IS DISTINCT FROM OLD.email_source THEN
    NEW.email_source := OLD.email_source;
  END IF;
  IF NEW.hunter_search_done IS DISTINCT FROM OLD.hunter_search_done THEN
    NEW.hunter_search_done := OLD.hunter_search_done;
  END IF;
  IF NEW.hunter_verify_done IS DISTINCT FROM OLD.hunter_verify_done THEN
    NEW.hunter_verify_done := OLD.hunter_verify_done;
  END IF;
  IF NEW.pre_hunter_score IS DISTINCT FROM OLD.pre_hunter_score THEN
    NEW.pre_hunter_score := OLD.pre_hunter_score;
  END IF;
  IF NEW.company_tier IS DISTINCT FROM OLD.company_tier THEN
    NEW.company_tier := OLD.company_tier;
  END IF;
  IF NEW.company_size_signal IS DISTINCT FROM OLD.company_size_signal THEN
    NEW.company_size_signal := OLD.company_size_signal;
  END IF;
  IF NEW.is_generic_inbox IS DISTINCT FROM OLD.is_generic_inbox THEN
    NEW.is_generic_inbox := OLD.is_generic_inbox;
  END IF;
  IF NEW.opt_out IS DISTINCT FROM OLD.opt_out THEN
    NEW.opt_out := OLD.opt_out;
  END IF;
  IF NEW.current_step IS DISTINCT FROM OLD.current_step THEN
    NEW.current_step := OLD.current_step;
  END IF;
  IF NEW.last_sent_at IS DISTINCT FROM OLD.last_sent_at THEN
    NEW.last_sent_at := OLD.last_sent_at;
  END IF;
  IF NEW.next_send_date IS DISTINCT FROM OLD.next_send_date THEN
    NEW.next_send_date := OLD.next_send_date;
  END IF;
  IF NEW.reply_status IS DISTINCT FROM OLD.reply_status THEN
    NEW.reply_status := OLD.reply_status;
  END IF;
  IF NEW.reply_date IS DISTINCT FROM OLD.reply_date THEN
    NEW.reply_date := OLD.reply_date;
  END IF;
  IF NEW.outlook_conv_id IS DISTINCT FROM OLD.outlook_conv_id THEN
    NEW.outlook_conv_id := OLD.outlook_conv_id;
  END IF;
  IF NEW.outlook_message_id IS DISTINCT FROM OLD.outlook_message_id THEN
    NEW.outlook_message_id := OLD.outlook_message_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_exhibitor_columns_trigger ON public.exhibitors;
CREATE TRIGGER protect_exhibitor_columns_trigger
  BEFORE UPDATE ON public.exhibitors
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_exhibitor_columns();


-- 2. TRIGGER PROTECTION NOVELTIES
-- Colonnes autorisées pour un owner non-admin :
--   title, type, summary, details, reason_1/2/3, audience_tags,
--   media_urls, doc_url, resource_url, availability, stand_info,
--   demo_slots, images_count, updated_at
-- Colonnes verrouillées :
--   status, exhibitor_id, event_id, is_premium, created_by,
--   pending_exhibitor_id, is_test

CREATE OR REPLACE FUNCTION public.protect_novelty_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can do anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Service role bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Lock sensitive columns for non-admins
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.exhibitor_id IS DISTINCT FROM OLD.exhibitor_id THEN
    NEW.exhibitor_id := OLD.exhibitor_id;
  END IF;
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    NEW.event_id := OLD.event_id;
  END IF;
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    NEW.is_premium := OLD.is_premium;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.pending_exhibitor_id IS DISTINCT FROM OLD.pending_exhibitor_id THEN
    NEW.pending_exhibitor_id := OLD.pending_exhibitor_id;
  END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    NEW.is_test := OLD.is_test;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_novelty_columns_trigger ON public.novelties;
CREATE TRIGGER protect_novelty_columns_trigger
  BEFORE UPDATE ON public.novelties
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_novelty_columns();


-- 3. TRIGGER PROTECTION PROFILES.ROLE
-- Personne ne peut modifier son propre rôle.
-- Seul un admin peut modifier le rôle d'un autre utilisateur.

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is not changing, allow
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Service role bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Nobody can change their own role
  IF OLD.user_id = auth.uid() THEN
    NEW.role := OLD.role;
    RETURN NEW;
  END IF;

  -- Only admins can change someone else's role
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role_trigger ON public.profiles;
CREATE TRIGGER protect_profile_role_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();


-- 4. NETTOYAGE DOUBLON POLICY LEADS
-- Supprime les deux policies INSERT existantes et en recrée une seule propre.
DROP POLICY IF EXISTS "Service role can create leads" ON leads;
DROP POLICY IF EXISTS "Service role can insert leads" ON leads;
CREATE POLICY "Service role can insert leads"
ON leads FOR INSERT
WITH CHECK (auth.role() = 'service_role');
