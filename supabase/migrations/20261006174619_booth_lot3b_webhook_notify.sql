-- Lotexpo Leads, Lot 3b : webhook vers la fonction booth-notify (emails de demande et de décision d'accès).
-- La fonction ne fait pas confiance au contenu du webhook : elle relit la ligne et réserve chaque email
-- par une mise à jour conditionnelle (admin_notified_at / decision_notified_at), d'où l'absence de secret.
CREATE TRIGGER booth_access_notify
AFTER INSERT OR UPDATE OF status ON public.booth_access
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/booth-notify',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
