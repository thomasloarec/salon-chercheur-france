// Radar CRM email unsubscribe endpoint.
//
// Public GET endpoint with a one-time token. On success it:
//   - flips crm_notification_preferences.radar_email_enabled to false
//   - stamps radar_email_unsubscribed_at
//   - marks the token as used
// It does NOT touch internal notifications or other Lotexpo preferences.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const ORANGE = '#ff7a1f';
const NAVY = '#06286e';

type PageVariant = 'success' | 'info' | 'error';

function page(
  title: string,
  message: string,
  opts: { status?: number; variant?: PageVariant; icon?: string } = {},
): Response {
  const status = opts.status ?? 200;
  const variant = opts.variant ?? 'info';
  const icon = opts.icon ?? (variant === 'success' ? '✓' : variant === 'error' ? '!' : 'i');
  const badgeBg = variant === 'success' ? '#dcfce7' : variant === 'error' ? '#fee2e2' : '#fef3c7';
  const badgeColor = variant === 'success' ? '#16a34a' : variant === 'error' ? '#dc2626' : '#b45309';

  const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${title} · Lotexpo</title>
<style>
  *,*::before,*::after { box-sizing:border-box; }
  html,body { margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:#f8fafc; color:#0f172a; min-height:100vh; }
  .wrap { max-width:520px; margin:0 auto; padding:64px 20px; }
  .brand { text-align:center; margin-bottom:24px; font-weight:700; font-size:20px; color:${NAVY}; letter-spacing:-0.01em; }
  .brand span { color:${ORANGE}; }
  .card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:40px 32px; text-align:center; box-shadow:0 4px 16px rgba(15,23,42,.04); }
  .badge { display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:999px; background:${badgeBg}; color:${badgeColor}; font-size:28px; font-weight:700; margin-bottom:20px; }
  h1 { font-size:22px; margin:0 0 12px 0; color:${NAVY}; line-height:1.3; }
  p { font-size:15px; line-height:1.6; color:#475569; margin:0 0 16px 0; }
  .actions { margin-top:28px; display:flex; flex-direction:column; gap:12px; align-items:center; }
  .btn { display:inline-block; padding:12px 22px; border-radius:10px; text-decoration:none; font-size:15px; font-weight:600; }
  .btn-primary { background:${ORANGE}; color:#fff; }
  .btn-primary:hover { background:#ea6a10; }
  .link { color:${NAVY}; text-decoration:underline; font-size:14px; }
  .footer { text-align:center; margin-top:24px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">Lot<span>expo</span></div>
    <div class="card">
      <div class="badge">${icon}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <div class="actions">
        <a class="btn btn-primary" href="https://lotexpo.com">Retourner sur Lotexpo</a>
        <a class="link" href="https://lotexpo.com/radar-crm">Découvrir Radar CRM</a>
      </div>
    </div>
    <div class="footer">Vos notifications internes Lotexpo (cloche, agenda) restent actives.</div>
  </div>
</body>
</html>`;

  const bytes = new TextEncoder().encode(body);
  return new Response(bytes, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return page('Méthode non autorisée', 'Cette page ne supporte que les requêtes GET.', { status: 405, variant: 'error' });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return page('Lien invalide', 'Le lien de désabonnement est invalide ou incomplet.', { status: 400, variant: 'error' });

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
    return page('Erreur', 'Une erreur est survenue. Merci de réessayer plus tard.', { status: 500, variant: 'error' });
  }
  if (!tokenRow) return page('Lien invalide', 'Ce lien de désabonnement est invalide.', { status: 400, variant: 'error' });
  if (tokenRow.used_at) {
    return page('Déjà désabonné', "Vous êtes déjà désabonné des emails Radar CRM. Vos notifications internes Lotexpo restent actives.", { variant: 'success' });
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return page('Lien expiré', 'Ce lien de désabonnement a expiré. Vous pouvez gérer vos préférences depuis votre compte Lotexpo.', { status: 400, variant: 'error' });
  }
  if (tokenRow.scope !== 'radar_crm') {
    return page('Lien invalide', 'Ce lien n’est pas valide pour les emails Radar CRM.', { status: 400, variant: 'error' });
  }

  const nowIso = new Date().toISOString();

  const { error: prefErr } = await supabase
    .from('crm_notification_preferences')
    .update({ radar_email_enabled: false, radar_email_unsubscribed_at: nowIso })
    .eq('user_id', tokenRow.user_id);
  if (prefErr) {
    console.error('unsubscribe pref update failed', prefErr);
    return page('Erreur', 'Impossible de finaliser le désabonnement. Merci de réessayer.', { status: 500, variant: 'error' });
  }

  await supabase.from('email_unsubscribe_tokens').update({ used_at: nowIso }).eq('id', tokenRow.id);

  return page(
    'Vous êtes bien désabonné des emails Radar CRM',
    'Vous ne recevrez plus d’emails Radar CRM. Vos notifications internes Lotexpo restent actives.',
    { variant: 'success' },
  );
});