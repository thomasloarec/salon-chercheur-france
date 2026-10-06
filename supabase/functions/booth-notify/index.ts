// booth-notify
//
// Lotexpo Leads : emails liés à l'accès bêta.
// Appelée par le webhook de base de données sur INSERT ou UPDATE OF status de `booth_access`.
//
// Sécurité sans secret partagé : le contenu du webhook n'est jamais cru. Seul `record.id` est lu ;
// la fonction relit la ligne en base avec la clé de service et n'agit que sur l'état réel.
// Chaque email est « réservé » par une mise à jour conditionnelle (admin_notified_at /
// decision_notified_at IS NULL) : un appel rejoué ou forgé ne peut pas provoquer de doublon.
//
//   - status = requested et admin_notified_at vide  -> email à admin@lotexpo.com + notification in-app admins
//   - status = approved  et decision_notified_at vide -> email au demandeur (accès ouvert)
//   - status = rejected  et decision_notified_at vide -> email au demandeur (demande non retenue)
//   - status = revoked   et decision_notified_at vide -> marqué traité, aucun email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph, dataTable, link, infoBox } from '../_shared/email-template.ts';

const ADMIN_EMAIL = 'admin@lotexpo.com';
const SITE_URL = 'https://lotexpo.com';
const LOG = '[booth-notify]';

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuit (1 compte)',
  beta: 'Bêta (toutes les fonctions offertes)',
  pass: 'Pass Salon',
  annual: 'Annuel',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return 'Non renseignée';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: { table?: string; record?: { id?: string } | null };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: true, skipped: 'invalid_json' });
  }
  const accessId = payload?.record?.id;
  if (payload?.table !== 'booth_access' || !accessId || !UUID_RE.test(accessId)) {
    return json({ ok: true, skipped: 'not_booth_access' });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: access, error: readErr } = await db
    .from('booth_access')
    .select('id, exhibitor_id, status, plan, plan_event_id, plan_valid_until, requested_by, target_event_id, team_size, message, created_at, admin_notified_at, decision_notified_at')
    .eq('id', accessId)
    .maybeSingle();
  if (readErr) {
    console.error(LOG, 'read failed', readErr.message);
    return json({ ok: false, error: 'read_failed' }, 500);
  }
  if (!access) return json({ ok: true, skipped: 'not_found' });

  const { data: exhibitor } = await db.from('exhibitors').select('name, slug').eq('id', access.exhibitor_id).maybeSingle();
  const exhibitorName = exhibitor?.name ?? 'Entreprise';
  const exhibitorSlug = exhibitor?.slug ?? null;

  async function eventLabel(eventId: string | null): Promise<string | null> {
    if (!eventId) return null;
    const { data } = await db.from('events').select('nom_event, date_debut').eq('id', eventId).maybeSingle();
    if (!data) return null;
    return data.date_debut ? `${data.nom_event} (${formatDateFr(data.date_debut)})` : data.nom_event;
  }

  async function userEmail(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error) {
      console.warn(LOG, 'getUserById failed', error.message);
      return null;
    }
    return data?.user?.email ?? null;
  }

  // ---------------------------------------------------------------------------
  // 1. Nouvelle demande : email à l'admin
  // ---------------------------------------------------------------------------
  if (access.status === 'requested' && !access.admin_notified_at) {
    const { data: claimed } = await db
      .from('booth_access')
      .update({ admin_notified_at: new Date().toISOString() })
      .eq('id', access.id)
      .is('admin_notified_at', null)
      .eq('status', 'requested')
      .select('id');
    if (!claimed || claimed.length === 0) return json({ ok: true, skipped: 'already_notified' });

    const requester = await userEmail(access.requested_by);
    const target = await eventLabel(access.target_event_id);
    const rows: Array<[string, string]> = [
      ['Entreprise', exhibitorName],
      ['Demandeur', requester ?? 'Inconnu'],
      ['Salon visé', target ?? 'Non précisé'],
      ['Taille de l\'équipe', access.team_size ? String(access.team_size) : 'Non précisée'],
      ['Message', access.message ?? 'Aucun message'],
      ['Date de la demande', formatDateFr(access.created_at)],
    ];
    const blocks = [
      heading('Nouvelle demande d\'accès à Lotexpo Leads'),
      paragraph(`<strong>${escapeHtml(exhibitorName)}</strong> demande l'accès à la bêta de Lotexpo Leads.`),
      dataTable(rows),
    ];
    if (exhibitorSlug) {
      blocks.push(paragraph(`Fiche exposant : ${link(`${SITE_URL}/exposants/${exhibitorSlug}`, escapeHtml(exhibitorName))}`));
    }
    blocks.push(paragraph('La demande attend votre validation dans l\'administration Lotexpo (Demandes Lotexpo Leads).'));

    try {
      const res = await sendResendEmail({
        to: ADMIN_EMAIL,
        subject: `🔔 Demande d'accès Lotexpo Leads : ${exhibitorName}`,
        html: renderEmailShell({
          title: 'Nouvelle demande Lotexpo Leads',
          preheader: `${exhibitorName} demande l'accès à Lotexpo Leads.`,
          bodyBlocks: blocks,
          footer: {},
        }),
        tags: [{ name: 'type', value: 'booth_access_request' }],
      });
      console.log(LOG, 'admin email sent', { id: res.id, access: access.id });
    } catch (err) {
      // On libère la réservation pour qu'un prochain changement puisse renvoyer l'email
      await db.from('booth_access').update({ admin_notified_at: null }).eq('id', access.id);
      console.error(LOG, 'admin email failed', String(err));
      return json({ ok: false, error: 'email_failed' }, 500);
    }

    // Notification in-app aux administrateurs (indépendante de l'email)
    try {
      const { data: admins } = await db.from('user_roles').select('user_id').eq('role', 'admin');
      const targets = Array.from(new Set((admins ?? []).map((a: { user_id: string }) => a.user_id)));
      if (targets.length > 0) {
        // Le type 'booth_access_request' doit être autorisé par la contrainte notifications_type_check
        // (ajout prévu au lot 5) : tant que ce n'est pas le cas, l'insertion échoue et c'est journalisé.
        const { error: notifErr } = await db.from('notifications').insert(targets.map((userId) => ({
          user_id: userId,
          type: 'booth_access_request',
          category: 'exhibitor_mgmt',
          title: 'Nouvelle demande Lotexpo Leads',
          message: `${exhibitorName} demande l'accès à Lotexpo Leads. À valider.`,
          icon: '📩',
          exhibitor_id: access.exhibitor_id,
          event_id: access.target_event_id ?? null,
          link_url: '/admin/lotexpo-leads',
          metadata: { booth_access_id: access.id },
        })));
        if (notifErr) console.error(LOG, 'in-app notification rejected', notifErr.message);
      }
    } catch (err) {
      console.error(LOG, 'in-app notification failed', String(err));
    }
    return json({ ok: true, sent: 'admin' });
  }

  // ---------------------------------------------------------------------------
  // 2. Décision : email au demandeur
  // ---------------------------------------------------------------------------
  if (['approved', 'rejected', 'revoked'].includes(access.status) && !access.decision_notified_at) {
    const { data: claimed } = await db
      .from('booth_access')
      .update({ decision_notified_at: new Date().toISOString() })
      .eq('id', access.id)
      .is('decision_notified_at', null)
      .eq('status', access.status)
      .select('id');
    if (!claimed || claimed.length === 0) return json({ ok: true, skipped: 'already_notified' });

    if (access.status === 'revoked') return json({ ok: true, skipped: 'revoked_no_email' });

    const to = await userEmail(access.requested_by);
    if (!to) return json({ ok: true, skipped: 'no_requester_email' });

    const manageUrl = exhibitorSlug ? `${SITE_URL}/exposants/${exhibitorSlug}/gerer` : `${SITE_URL}`;
    let subject: string;
    let blocks: string[];
    let cta: { label: string; href: string } | undefined;

    if (access.status === 'approved') {
      const planLabel = PLAN_LABELS[access.plan] ?? access.plan;
      const planEvent = await eventLabel(access.plan_event_id);
      const rows: Array<[string, string]> = [['Entreprise', exhibitorName], ['Formule', planLabel]];
      if (planEvent) rows.push(['Salon', planEvent]);
      if (access.plan_valid_until) rows.push(['Valable jusqu\'au', formatDateFr(access.plan_valid_until)]);
      subject = `Votre accès à Lotexpo Leads est ouvert`;
      blocks = [
        heading('Bienvenue dans Lotexpo Leads'),
        paragraph(`L'accès de <strong>${escapeHtml(exhibitorName)}</strong> à Lotexpo Leads est ouvert.`),
        dataTable(rows),
        infoBox('Prochaine étape : dans votre espace exposant, section Salons, créez l\'espace du salon où vous exposez, puis invitez votre équipe.'),
      ];
      cta = { label: 'Ouvrir mon espace exposant', href: manageUrl };
    } else {
      subject = `Votre demande d'accès à Lotexpo Leads`;
      blocks = [
        heading('Votre demande d\'accès à Lotexpo Leads'),
        paragraph(`Merci pour votre intérêt. Nous ne pouvons pas ouvrir l'accès de <strong>${escapeHtml(exhibitorName)}</strong> à la bêta pour le moment.`),
        paragraph(`Vous pouvez répondre à cet email pour en savoir plus, ou refaire une demande plus tard depuis votre ${link(manageUrl, 'espace exposant')}.`),
      ];
    }

    try {
      const res = await sendResendEmail({
        to,
        subject,
        html: renderEmailShell({ title: subject, preheader: subject, bodyBlocks: blocks, cta, footer: {} }),
        replyTo: ADMIN_EMAIL,
        tags: [{ name: 'type', value: `booth_access_${access.status}` }],
      });
      console.log(LOG, 'decision email sent', { id: res.id, access: access.id, status: access.status });
    } catch (err) {
      await db.from('booth_access').update({ decision_notified_at: null }).eq('id', access.id);
      console.error(LOG, 'decision email failed', String(err));
      return json({ ok: false, error: 'email_failed' }, 500);
    }
    return json({ ok: true, sent: access.status });
  }

  return json({ ok: true, skipped: 'nothing_to_do' });
});
