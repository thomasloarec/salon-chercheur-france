// supabase/functions/assistant-alerts/index.ts
// Assistant salons, lot 5 : les alertes. Appelée chaque matin par la tâche assistant-alerts-daily.
//   - le mardi (heure de Paris) : récapitulatif de la semaine (mode weekly)
//   - les autres jours : seulement l'urgent (mode urgent : suggestion très forte, salon dans 21 jours)
// Pour chaque visiteur concerné : email (s'il l'a accepté, plafonné, jamais vide) et notification dans la
// cloche (pour tout le monde), puis marquage de ce qui a été signalé (RPC assistant_alerts_mark).
//
// Corps (facultatif) :
//   { "mode": "weekly" | "urgent" }                    forcer le mode (serveur ou admin)
//   { "profile_id": "...", "force": true }             test admin : un seul assistant, meilleures suggestions
//   { "dry_run": true }                                rien n'est envoyé ni marqué ; renvoie l'email rendu
// Sécurité : verify_jwt = false ; clé de service (tâche planifiée) ou session admin.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph, EMAIL_COLORS, EMAIL_FONTS } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_EVENTS = 3;      // salons montrés dans un email
const MAX_PER_EVENT = 3;   // éléments montrés par salon
const MAX_ITEMS = 8;       // éléments montrés au total
const C = EMAIL_COLORS;
const F = EMAIL_FONTS;

type Item = {
  item_type: 'session' | 'novelty'; item_id: string; event_id: string; score: number | null;
  reason: string | null; title: string | null; promise: string | null;
  session: { day_date: string | null; start_time: string | null } | null;
  novelty: { exhibitor_name: string | null; stand_info: string | null } | null;
};
type Ev = { id: string; slug: string | null; nom_event: string; date_debut: string; date_fin: string | null; ville: string | null };
type Entry = {
  profile_id: string; user_id: string; email: string | null; can_email: boolean; email_skip_reason: string | null;
  unsubscribe_token: string | null; items: Item[]; new_events: { event_id: string }[]; events: Ev[];
};

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function noDash(s: string | null | undefined): string {
  return (s ?? '').replace(/\s*[—–]\s*/g, ', ').trim();
}
function parisDay(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}
function frDate(d: string | null, opts: Intl.DateTimeFormatOptions): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...opts }).format(new Date(`${d.slice(0, 10)}T12:00:00Z`));
}
function eventDates(e: Ev): string {
  const a = frDate(e.date_debut, { day: 'numeric', month: 'long' });
  if (!e.date_fin || e.date_fin.slice(0, 10) === e.date_debut.slice(0, 10)) {
    return frDate(e.date_debut, { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const sameMonth = e.date_fin.slice(0, 7) === e.date_debut.slice(0, 7);
  const b = frDate(e.date_fin, { day: 'numeric', month: 'long', year: 'numeric' });
  return sameMonth ? `${frDate(e.date_debut, { day: 'numeric' })} au ${b}` : `${a} au ${b}`;
}
function daysUntil(d: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((new Date(d.slice(0, 10) + 'T00:00:00Z').getTime() - today) / 86400000);
}
function timeFr(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  return m && m !== '00' ? `${Number(h)} h ${m}` : `${Number(h)} h`;
}
function itemLabel(it: Item): string {
  if (it.item_type === 'session') {
    const day = it.session?.day_date ? frDate(it.session.day_date, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const time = timeFr(it.session?.start_time ?? null);
    return ['Conférence', [day, time].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  }
  const ex = it.novelty?.exhibitor_name ? noDash(it.novelty.exhibitor_name) : '';
  const stand = it.novelty?.stand_info ? `stand ${noDash(it.novelty.stand_info)}` : '';
  return ['Stand à voir', [ex, stand].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}
function why(it: Item): string {
  return noDash(it.reason) || noDash(it.promise);
}

// Groupes salon -> éléments, dans l'ordre des dates, plafonnés
function group(entry: Entry) {
  const newEv = new Set(entry.new_events.map((n) => n.event_id));
  const byEv = new Map<string, Item[]>();
  for (const it of entry.items) {
    const l = byEv.get(it.event_id) ?? [];
    l.push(it);
    byEv.set(it.event_id, l);
  }
  const events = [...entry.events].filter((e) => byEv.has(e.id) || newEv.has(e.id))
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut));
  let shown = 0;
  const groups: { ev: Ev; isNew: boolean; items: Item[] }[] = [];
  for (const ev of events.slice(0, MAX_EVENTS)) {
    const list = (byEv.get(ev.id) ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const take = list.slice(0, Math.max(0, Math.min(MAX_PER_EVENT, MAX_ITEMS - shown)));
    shown += take.length;
    groups.push({ ev, isNew: newEv.has(ev.id), items: take });
  }
  return { groups, shown, total: entry.items.length, newCount: entry.new_events.length };
}

function eventBlock(g: { ev: Ev; isNew: boolean; items: Item[] }, base: string): string {
  const badge = g.isNew
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:${C.violet};color:${C.white};font-family:${F.body};font-size:11px;font-weight:700;vertical-align:middle;">Nouveau pour vous</span>`
    : '';
  const meta = [eventDates(g.ev), g.ev.ville ? noDash(g.ev.ville) : ''].filter(Boolean).join(' · ');
  const items = g.items.map((it) => `
      <tr><td style="padding:12px 0 0 0;">
        <p style="margin:0;font-family:${F.body};font-size:12px;line-height:16px;font-weight:600;color:${C.violet};text-transform:uppercase;letter-spacing:0.04em;">${esc(itemLabel(it))}</p>
        <p style="margin:4px 0 0 0;font-family:${F.body};font-size:16px;line-height:22px;font-weight:600;color:${C.navy};">${esc(noDash(it.title))}</p>
        ${why(it) ? `<p style="margin:4px 0 0 0;font-family:${F.body};font-size:14px;line-height:20px;color:${C.textSecondary};">${esc(why(it))}</p>` : ''}
      </td></tr>`).join('');
  const empty = g.items.length === 0
    ? `<tr><td style="padding:10px 0 0 0;font-family:${F.body};font-size:14px;line-height:20px;color:${C.textSecondary};">Votre assistant y a repéré des conférences et des stands pour vous.</td></tr>`
    : '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;border:1px solid ${C.grey};border-left:4px solid ${C.violet};border-radius:8px;">
    <tr><td style="padding:16px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td>
          <a href="${esc(base)}/agenda" style="font-family:${F.heading};font-size:19px;line-height:24px;font-weight:700;color:${C.navy};text-decoration:none;">${esc(noDash(g.ev.nom_event))}</a>${badge}
          <p style="margin:4px 0 0 0;font-family:${F.body};font-size:13px;line-height:18px;color:${C.textSecondary};">${esc(meta)}</p>
        </td></tr>
        ${items}${empty}
      </table>
    </td></tr>
  </table>`;
}

function render(entry: Entry, mode: 'weekly' | 'urgent' | 'test', base: string, unsubUrl: string | null) {
  const { groups, shown, total, newCount } = group(entry);
  const first = groups[0];
  const firstItem = first?.items[0];
  const n = total;
  const isUrgent = mode === 'urgent';

  let subject: string;
  if (isUrgent && first) {
    const d = daysUntil(first.ev.date_debut);
    subject = `À ne pas manquer sur ${noDash(first.ev.nom_event)}, dans ${d} jours`;
  } else if (n === 0 && newCount === 1 && first) {
    subject = `Un salon à ne pas manquer pour vous : ${noDash(first.ev.nom_event)}`;
  } else if (n === 1 && first) {
    subject = `Une nouvelle suggestion pour vous sur ${noDash(first.ev.nom_event)}`;
  } else {
    subject = `${n} nouvelles suggestions pour vos prochains salons`;
  }
  const preheader = firstItem ? noDash(firstItem.title) : 'Votre assistant salons a trouvé du nouveau pour vous.';

  const intro = isUrgent && first
    ? `Je l'ai repéré cette nuit, et ${esc(noDash(first.ev.nom_event))} a lieu dans ${daysUntil(first.ev.date_debut)} jours. Ça vaut le coup d'œil :`
    : 'Voici ce qui est arrivé dans votre agenda depuis mon dernier message.';
  const rest = n - shown;
  const blocks = [
    heading(isUrgent ? 'Un rendez-vous à ne pas manquer' : 'Du nouveau pour vos prochains salons'),
    paragraph('Bonjour,'),
    paragraph(intro),
    ...groups.map((g) => eventBlock(g, base)),
    rest > 0 ? paragraph(`Et ${rest} autre${rest > 1 ? 's' : ''} suggestion${rest > 1 ? 's' : ''} dans votre agenda.`) : '',
  ].filter(Boolean);

  const html = renderEmailShell({
    title: subject,
    preheader,
    bodyBlocks: blocks,
    cta: { label: 'Voir mon agenda', href: `${base}/agenda` },
    footer: {
      unsubscribeUrl: unsubUrl ?? undefined,
      extraHtml: `Vous recevez cet email parce que vous avez demandé à votre assistant salons de vous prévenir. Vous pouvez changer ce réglage dans <a href="${esc(base)}/agenda" style="color:${C.footerLink};text-decoration:underline;">votre agenda</a>.`,
    },
  });

  const lines: string[] = [subject, '', 'Bonjour,', '', isUrgent && first
    ? `Je l'ai repéré cette nuit, et ${noDash(first.ev.nom_event)} a lieu dans ${daysUntil(first.ev.date_debut)} jours.`
    : 'Voici ce qui est arrivé dans votre agenda depuis mon dernier message.', ''];
  for (const g of groups) {
    lines.push(`${noDash(g.ev.nom_event)} (${eventDates(g.ev)}${g.ev.ville ? `, ${noDash(g.ev.ville)}` : ''})${g.isNew ? ' : nouveau pour vous' : ''}`);
    for (const it of g.items) {
      lines.push(`- ${itemLabel(it)} : ${noDash(it.title)}`);
      if (why(it)) lines.push(`  ${why(it)}`);
    }
    lines.push('');
  }
  if (rest > 0) lines.push(`Et ${rest} autre(s) suggestion(s) dans votre agenda.`, '');
  lines.push(`Voir mon agenda : ${base}/agenda`);
  if (unsubUrl) lines.push('', `Ne plus recevoir ces emails : ${unsubUrl}`);

  // Cloche
  const bellTitle = isUrgent && first
    ? `À ne pas manquer sur ${noDash(first.ev.nom_event)}`
    : n > 0
      ? `${n} nouvelle${n > 1 ? 's' : ''} suggestion${n > 1 ? 's' : ''} dans votre agenda`
      : `Un salon à ne pas manquer : ${noDash(first?.ev.nom_event)}`;
  const bellMessage = firstItem && first
    ? `${n > 1 ? 'Dont' : ''} « ${noDash(firstItem.title)} » sur ${noDash(first.ev.nom_event)}.`.trim()
    : first ? `${noDash(first.ev.nom_event)}, ${eventDates(first.ev)}.` : '';

  return { subject, html, text: lines.join('\n'), bellTitle, bellMessage, bellEventId: first?.ev.id ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Server misconfigured' }, 500);
  const base = (Deno.env.get('APP_BASE_URL') ?? 'https://lotexpo.com').replace(/\/+$/, '');
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Auth : clé de service ou admin connecté
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json({ error: 'Unauthorized' }, 401);
  let isService = safeEqual(token, serviceKey);
  if (!isService) {
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: claimsData, error } = await authClient.auth.getClaims(token);
    const sub = (claimsData?.claims as Record<string, unknown> | undefined)?.sub;
    if (error || typeof sub !== 'string') return json({ error: 'Unauthorized' }, 401);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: sub, _role: 'admin' });
    if (isAdmin !== true) return json({ error: 'Forbidden' }, 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  const profileId = typeof body.profile_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.profile_id) ? body.profile_id : null;
  const force = body.force === true && !!profileId;
  const dryRun = body.dry_run === true;
  const mode: 'weekly' | 'urgent' = body.mode === 'weekly' || body.mode === 'urgent'
    ? body.mode
    : (parisDay() === 2 ? 'weekly' : 'urgent');
  const markMode = profileId ? 'test' : mode;
  if (!isService && !profileId) return json({ error: 'profile_id requis pour un test admin' }, 400);

  const col = await admin.rpc('assistant_alerts_collect', { p_mode: mode, p_profile_id: profileId, p_force: force });
  if (col.error) return json({ error: col.error.message }, 500);
  const entries = (col.data ?? []) as Entry[];

  const report: Record<string, unknown>[] = [];
  for (const entry of entries) {
    // Lien du pied de l'email : page de confirmation sur le site. En-tête des messageries : désinscription
    // en un clic, directement sur la fonction (POST).
    const unsubUrl = entry.unsubscribe_token
      ? `${base}/desinscription-assistant?token=${entry.unsubscribe_token}`
      : null;
    const oneClickUrl = entry.unsubscribe_token
      ? `${supabaseUrl}/functions/v1/assistant-alerts-unsubscribe?token=${entry.unsubscribe_token}`
      : null;
    const r = render(entry, markMode === 'test' ? mode : markMode, base, unsubUrl);
    const keys = [
      ...entry.items.map((i) => ({ item_type: i.item_type, item_id: i.item_id })),
      ...entry.new_events.map((e) => ({ item_type: 'event', item_id: e.event_id })),
    ];
    if (dryRun) {
      report.push({ profile_id: entry.profile_id, can_email: entry.can_email, skip: entry.email_skip_reason,
        subject: r.subject, bell: r.bellTitle, text: r.text, html: r.html });
      continue;
    }

    let status: 'sent' | 'failed' | 'skipped' = 'skipped';
    let resendId: string | null = null;
    let err: string | null = entry.email_skip_reason;
    if (entry.can_email && entry.email) {
      try {
        const sent = await sendResendEmail({
          to: entry.email,
          subject: r.subject,
          html: r.html,
          text: r.text,
          headers: oneClickUrl
            ? { 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
            : undefined,
          tags: [{ name: 'feature', value: 'assistant' }, { name: 'email_type', value: `alert_${mode}` }],
        });
        status = 'sent';
        resendId = sent.id;
        err = null;
      } catch (e) {
        status = 'failed';
        err = (e as Error).message;
        console.error('[assistant-alerts] envoi', entry.profile_id, err);
      }
      await sleep(600); // limite de débit de Resend
    }

    const mark = await admin.rpc('assistant_alerts_mark', {
      p_profile_id: entry.profile_id, p_mode: markMode, p_keys: keys,
      p_email_status: status, p_resend_id: resendId, p_error: err,
      p_bell_title: r.bellTitle, p_bell_message: r.bellMessage, p_bell_event_id: r.bellEventId,
    });
    if (mark.error) console.error('[assistant-alerts] marquage', entry.profile_id, mark.error.message);
    report.push({ profile_id: entry.profile_id, email: status, raison: err, elements: keys.length });
  }

  return json({ ok: true, mode, test: !!profileId, dry_run: dryRun, visiteurs: entries.length, detail: report });
});
