DROP TRIGGER IF EXISTS radar_leads_notify ON public.radar_leads;
CREATE TRIGGER radar_leads_notify
AFTER INSERT ON public.radar_leads
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/notify-radar-lead',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);