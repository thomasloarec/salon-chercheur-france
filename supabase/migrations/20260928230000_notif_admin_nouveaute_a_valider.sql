-- Notification admin quand une nouveauté attend une validation (28/09/2026).
-- Deux cas, notifiés dans la cloche de chaque admin, avec lien vers la modération :
--   - novelty_submitted   : nouvelle nouveauté soumise (création, statut 'draft') ;
--   - novelty_resubmitted : nouveauté publiée ou refusée, modifiée par l'exposant et
--                           repassée en 'draft' (voir 20260928220000).
-- Pas de notification pour les nouveautés créées ou modifiées par un admin, ni pour
-- les nouveautés de test.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'like','comment','reply','new_lead_brochure','new_lead_rdv','new_novelty_on_favorite',
  'event_reminder_7d','event_reminder_1d','novelty_approved','novelty_rejected','plan_limit_reached',
  'welcome','complete_profile','password_changed','suspicious_activity','recommended_event',
  'inactivity_reminder','radar_new_matches','claim_approved','claim_request','novelty_visit_milestone',
  'radar_salon_live','radar_salon_debrief','radar_task_due','radar_prep_reminder','radar_hot_prospect',
  'event_claim_request','event_change_request','event_claim_approved','event_claim_rejected',
  'event_change_approved','event_change_rejected','participation_request','participation_approved',
  'participation_rejected','support_new_thread','support_reply','support_escalated','site_health',
  'novelty_submitted','novelty_resubmitted'
]::text[]));

CREATE OR REPLACE FUNCTION public.notify_admins_novelty_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
  v_actor uuid;
  v_actor_name text;
  v_company text;
  v_event text;
  v_admin uuid;
BEGIN
  IF NEW.status <> 'draft' OR coalesce(NEW.is_test, false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_type := 'novelty_submitted';
    v_actor := NEW.created_by;
  ELSIF OLD.status IN ('published', 'rejected') THEN
    v_type := 'novelty_resubmitted';
    v_actor := coalesce(auth.uid(), NEW.created_by);
  ELSE
    RETURN NEW;
  END IF;

  -- Action d'un admin : pas de notification à soi-même.
  IF v_actor IS NOT NULL AND public.has_role(v_actor, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
    INTO v_actor_name FROM public.profiles p WHERE p.user_id = v_actor;
  SELECT e.name INTO v_company FROM public.exhibitors e WHERE e.id = NEW.exhibitor_id;
  SELECT ev.nom_event INTO v_event FROM public.events ev WHERE ev.id = NEW.event_id;

  FOR v_admin IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::app_role LOOP
    INSERT INTO public.notifications (
      user_id, type, category, title, message, icon,
      novelty_id, event_id, exhibitor_id, actor_user_id, actor_name, actor_company,
      link_url, group_key, metadata
    ) VALUES (
      v_admin, v_type, 'system',
      CASE WHEN v_type = 'novelty_submitted'
        THEN 'Nouvelle nouveauté à valider'
        ELSE 'Nouveauté modifiée à valider' END,
      '« ' || NEW.title || ' »'
        || coalesce(' · ' || v_company, '')
        || coalesce(' · ' || v_event, '')
        || CASE WHEN v_type = 'novelty_resubmitted'
             THEN '. Retirée du site jusqu''à votre nouvelle validation.'
             ELSE '.' END,
      CASE WHEN v_type = 'novelty_submitted' THEN '🆕' ELSE '✏️' END,
      NEW.id, NEW.event_id, NEW.exhibitor_id, v_actor, v_actor_name, v_company,
      '/admin/novelties',
      'novelty_review:' || NEW.id::text,
      jsonb_build_object('novelty_id', NEW.id, 'reason', v_type)
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_admins_novelty_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS novelty_notify_admins_review ON public.novelties;
CREATE TRIGGER novelty_notify_admins_review
  AFTER INSERT OR UPDATE ON public.novelties
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_novelty_review();
