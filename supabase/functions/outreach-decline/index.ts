// Public "decline" endpoint for the Nouveauté outreach sequence.
//
// The N3 email offers 3 links ("pourquoi vous ne publiez pas"). The recipient
// clicks from their inbox, unauthenticated. This endpoint:
//   - validates `reason` STRICTLY against the 3 allowed values
//   - validates `camp` (UUID format + existence)
//   - if valid AND campaign is still active, records the reason and exits the
//     sequence: decline_reason=<reason>, novelty_status='declined',
//     next_send_at=NULL, updated_at=now()
//   - is idempotent: WHERE novelty_status='active' so a second click, or a
//     click after publication, never overwrites a terminal state
//   - ALWAYS returns a neutral confirmation page (no info leak about the
//     campaign's existence/state)
//
// It touches nothing else: no other columns, no triggers, no claim sequence,
// no views.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORANGE = '#6b51ff';
const NAVY = '#0b132b';

const ALLOWED_REASONS = ['pas_le_temps', 'pas_de_nouveaute', 'pas_compris'] as const;
type Reason = (typeof ALLOWED_REASONS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REASON_COPY: Record<Reason, string> = {
  pas_le_temps:
    "Pas de souci : publier une Nouveauté ne prend que quelques minutes, quand vous serez prêt.",
  pas_de_nouveaute:
    "C'est noté : rien à annoncer pour cette édition. Vous pourrez le faire à tout moment si cela change.",
  pas_compris:
    "Pas de problème : une Nouveauté, c'est simplement un produit, service ou démo que vous présentez sur le salon.",
};

function page(
  title: string,
  message: string,
  opts: { status?: number; variant?: 'success' | 'info'; eventSlug?: string | null } = {},
): Response {
  const status = opts.status ?? 200;
  const variant = opts.variant ?? 'success';
  const icon = variant === 'success' ? '✓' : 'i';
  const badgeBg = variant === 'success' ? '#dcfce7' : '#fef3c7';
  const badgeColor = variant === 'success' ? '#16a34a' : '#b45309';

  const recoverLink = opts.eventSlug
    ? `<a class="link" href="https://lotexpo.com/events/${opts.eventSlug}">Finalement, publier une Nouveauté</a>`
    : '';

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
  .btn-primary:hover { background:#5540d6; }
  .link { color:${NAVY}; text-decoration:underline; font-size:14px; }
  .footer { text-align:center; margin-top:24px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><img src="https://vxivdvzzhebobveedxbj.supabase.co/storage/v1/object/public/email-assets/lotexpo-email-navy.png" alt="Lotexpo" width="150" height="39" style="display:inline-block;width:150px;height:39px;" /></div>
    <div class="card">
      <div class="badge">${icon}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <div class="actions">
        <a class="btn btn-primary" href="https://lotexpo.com">Retourner sur Lotexpo</a>
        ${recoverLink}
      </div>
    </div>
    <div class="footer">Vous ne recevrez plus de relance « Nouveauté » pour ce salon.</div>
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

// Neutral confirmation page used for EVERY non-error outcome (valid click,
// idempotent re-click, already published, unknown campaign, invalid reason).
// It never reveals whether the campaign exists or what its state is.
function neutralPage(reason: Reason | null, eventSlug?: string | null): Response {
  const message = reason ? REASON_COPY[reason] : "Merci, votre choix a bien été pris en compte.";
  return page('Merci, c’est noté.', message, { variant: 'success', eventSlug });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return page('Méthode non autorisée', 'Cette page ne supporte que les requêtes GET.', {
      status: 405,
      variant: 'info',
    });
  }

  const url = new URL(req.url);
  const camp = url.searchParams.get('camp');
  const reasonRaw = url.searchParams.get('reason');

  // Strict reason validation -> neutral response, no write.
  const reason = ALLOWED_REASONS.includes(reasonRaw as Reason) ? (reasonRaw as Reason) : null;
  if (!reason) {
    return neutralPage(null);
  }

  // Strict camp validation (UUID format) -> neutral response, no write.
  if (!camp || !UUID_RE.test(camp)) {
    return neutralPage(reason);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Existence check (also fetch event slug for the optional recovery link).
  const { data: campaign, error: lookupErr } = await supabase
    .from('outreach_campaigns')
    .select('id, event:events(slug)')
    .eq('id', camp)
    .maybeSingle();

  if (lookupErr) {
    console.error('outreach-decline lookup failed', lookupErr);
    // Stay neutral even on transient errors: no info leak.
    return neutralPage(reason);
  }

  // Unknown campaign -> neutral response, no write (anti-enumeration).
  if (!campaign) {
    return neutralPage(reason);
  }

  const eventSlug = (campaign as { event?: { slug?: string | null } | null }).event?.slug ?? null;

  // Idempotent, non-terminal-overwriting update.
  const { error: updateErr } = await supabase
    .from('outreach_campaigns')
    .update({
      decline_reason: reason,
      novelty_status: 'declined',
      next_send_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', camp)
    .eq('novelty_status', 'active');

  if (updateErr) {
    console.error('outreach-decline update failed', updateErr);
    // Best-effort & non blocking: always confirm neutrally.
  }

  return neutralPage(reason, eventSlug);
});