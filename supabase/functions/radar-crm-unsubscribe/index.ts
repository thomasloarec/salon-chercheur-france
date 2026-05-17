// Radar CRM email unsubscribe endpoint.
//
// Public GET endpoint with a one-time token. On success it:
//   - flips crm_notification_preferences.radar_email_enabled to false
//   - stamps radar_email_unsubscribed_at
//   - marks the token as used
// It does NOT touch internal notifications or other Lotexpo preferences.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' } as const;

function page(title: string, message: string, status = 200): Response {
  const body = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#0f172a; }
  .wrap { max-width:520px; margin:80px auto; padding:32px; background:#fff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  h1 { font-size:20px; margin:0 0 12px 0; }
  p { font-size:14px; line-height:1.6; color:#334155; margin:0 0 12px 0; }
  a { color:#2563eb; }
</style></head><body><div class="wrap">
<h1>${title}</h1><p>${message}</p>
<p><a href="https://lotexpo.com">Retour à Lotexpo</a></p>
</div></body></html>`;
  return new Response(body, { status, headers: htmlHeaders });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return page('Méthode non autorisée', 'Cette page ne supporte que les requêtes GET.', 405);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return page('Lien invalide', 'Le lien de désabonnement est invalide ou incomplet.', 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('email_unsubscribe_tokens')
    .select('id, user_id, scope, used_at, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (tokenErr) {
    console.error('unsubscribe token lookup failed', tokenErr);
    return page('Erreur', 'Une erreur est survenue. Merci de réessayer plus tard.', 500);
  }
  if (!tokenRow) return page('Lien invalide', 'Ce lien de désabonnement est invalide.', 400);
  if (tokenRow.used_at) {
    return page('Déjà désabonné', "Vous êtes déjà désabonné des emails Radar CRM. Vos notifications internes Lotexpo restent actives.");
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return page('Lien expiré', 'Ce lien de désabonnement a expiré. Vous pouvez gérer vos préférences depuis votre compte Lotexpo.', 400);
  }
  if (tokenRow.scope !== 'radar_crm') {
    return page('Lien invalide', 'Ce lien n’est pas valide pour les emails Radar CRM.', 400);
  }

  const nowIso = new Date().toISOString();

  const { error: prefErr } = await supabase
    .from('crm_notification_preferences')
    .update({ radar_email_enabled: false, radar_email_unsubscribed_at: nowIso })
    .eq('user_id', tokenRow.user_id);
  if (prefErr) {
    console.error('unsubscribe pref update failed', prefErr);
    return page('Erreur', 'Impossible de finaliser le désabonnement. Merci de réessayer.', 500);
  }

  await supabase.from('email_unsubscribe_tokens').update({ used_at: nowIso }).eq('id', tokenRow.id);

  return page(
    'Vous êtes désabonné',
    'Vous êtes désabonné des emails Radar CRM. Vos notifications internes Lotexpo (cloche, agenda) restent actives.',
  );
});