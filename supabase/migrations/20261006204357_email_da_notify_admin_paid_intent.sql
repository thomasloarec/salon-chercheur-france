-- Mise sur la DA Lotexpo de l'email admin « Signal paiement, Recherche IA »
-- (trigger trg_notify_admin_paid_intent sur ai_funnel_events).
-- Logique inchangée : clé Resend lue dans le Vault, sortie silencieuse si absente,
-- même expéditeur, même destinataire, même objet, mêmes données. Seul le HTML change.

CREATE OR REPLACE FUNCTION public.notify_admin_paid_intent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_key   text;
  v_total bigint;
  v_html  text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY';
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NEW;  -- clé absente du Vault : email non envoyé (ajouter RESEND_API_KEY au Vault pour activer)
  END IF;

  SELECT count(*) INTO v_total FROM public.ai_funnel_events WHERE event_type = 'paid_intent_clicked';

  v_html :=
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>Signal paiement, Recherche IA</title></head>'
    || '<body style="margin:0;padding:0;background:#e6e8ec;">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e6e8ec;"><tr><td align="center" style="padding:24px 12px;">'
    || '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">'
    || '<tr><td align="center" style="background:#0b132b;padding:22px 32px;"><img src="https://vxivdvzzhebobveedxbj.supabase.co/storage/v1/object/public/email-assets/lotexpo-email-white.png" width="150" height="39" alt="Lotexpo" style="display:block;width:150px;height:39px;color:#ffffff;font-family:Georgia,serif;font-size:20px;"></td></tr>'
    || '<tr><td style="padding:28px 32px 24px 32px;">'
    || '<p style="margin:0 0 8px 0;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b51ff;">Recherche IA</p>'
    || '<h1 style="margin:0 0 14px 0;font-family:''Playfair Display'',Georgia,''Times New Roman'',serif;font-size:26px;line-height:32px;font-weight:700;color:#0b132b;">Signal d''intention de paiement</h1>'
    || '<p style="margin:0 0 16px 0;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#0b132b;">Un utilisateur a cliqué « Débloquer » sur le paywall de la Recherche IA.</p>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;border:1px solid #e6e8ec;border-radius:8px;">'
    || '<tr><td style="padding:9px 14px;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;color:#5c6684;white-space:nowrap;">Utilisateur</td><td style="padding:9px 14px;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#0b132b;font-weight:600;word-break:break-word;">' || coalesce(NEW.user_id::text, '?') || '</td></tr>'
    || '<tr><td style="border-top:1px solid #e6e8ec;padding:9px 14px;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;color:#5c6684;white-space:nowrap;">Quand</td><td style="border-top:1px solid #e6e8ec;padding:9px 14px;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#0b132b;font-weight:600;">' || coalesce(to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI'), '?') || ' UTC</td></tr>'
    || '</table>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0 0;"><tr><td style="background:#b6e3ff;border-radius:8px;padding:16px 20px;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;color:#0b132b;">Total des clics « payer » à ce jour : <strong style="font-size:20px;">' || v_total || '</strong></td></tr></table>'
    || '</td></tr>'
    || '<tr><td style="background:#0b132b;padding:28px 32px;"><p style="margin:0;font-family:''Playfair Display'',Georgia,''Times New Roman'',serif;font-size:18px;line-height:22px;font-weight:700;color:#ffffff;">Lotexpo</p><p style="margin:6px 0 0 0;font-family:-apple-system,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#c9d2ec;">L''intelligence des salons professionnels.</p></td></tr>'
    || '</table></td></tr></table></body></html>';

  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Lotexpo <admin@lotexpo.com>',
      'to', jsonb_build_array('admin@lotexpo.com'),
      'subject', 'Signal paiement — Recherche IA',
      'html', v_html
    )
  );
  RETURN NEW;
END $function$;
