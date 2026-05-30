CREATE OR REPLACE FUNCTION public.protect_exhibitor_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins et service_role (validation de claim / edge functions) : accès total
  IF public.is_admin() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Pour un owner : on force la valeur OLD sur chaque colonne sensible,
  -- quelle que soit la valeur NEW reçue.

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

  -- NB : name_normalized volontairement NON protégée
  -- (gérée par generate_exhibitor_slug_trigger, BEFORE UPDATE 'g',
  --  qui s'exécute avant ce trigger 't' — la protéger créerait une
  --  incohérence slug/name_normalized lors d'un changement de nom).

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_exhibitor_columns ON public.exhibitors;

CREATE TRIGGER trg_protect_exhibitor_columns
BEFORE UPDATE ON public.exhibitors
FOR EACH ROW
EXECUTE FUNCTION public.protect_exhibitor_columns();