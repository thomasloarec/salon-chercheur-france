// supabase/functions/assistant-roles-digest/index.ts
// Assistant salons : signale à l'admin les rôles saisis à la main (« Autre ») dans /agenda/creer.
// Appelée chaque matin par la tâche planifiée assistant-roles-digest (pg_cron, clé de service).
// Envoie un email à admin@lotexpo.com seulement s'il y a au moins SEUIL nouvelles saisies (non encore
// signalées, hors comptes de test), puis les marque comme signalées.
//
// Sécurité : verify_jwt = false ; seule la clé de service est acceptée (comparaison à temps constant).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph, dataTable } from '../_shared/email-template.ts';

const SEUIL = 5;
const ADMIN_EMAIL = 'admin@lotexpo.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500);

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !safeEqual(token, serviceKey)) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') ?? 'https://lotexpo.com').replace(/\/+$/, '');

  try {
    const { data, error } = await admin
      .from('assistant_role_other_entries')
      .select('id, label, updated_at, notified_at, assistant_profiles!inner(is_test)')
      .eq('assistant_profiles.is_test', false);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: number; label: string; updated_at: string; notified_at: string | null }[];
    const fresh = rows.filter((r) => !r.notified_at);
    if (fresh.length < SEUIL) return json({ ok: true, sent: false, nouvelles: fresh.length, seuil: SEUIL });

    // Regroupement insensible à la casse
    const group = (list: typeof rows) => {
      const m = new Map<string, { label: string; n: number }>();
      for (const r of list) {
        const k = r.label.trim().toLowerCase();
        const cur = m.get(k);
        if (cur) cur.n += 1; else m.set(k, { label: r.label.trim(), n: 1 });
      }
      return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'fr'));
    };
    const freshGroups = group(fresh);
    const allGroups = group(rows).slice(0, 10);

    const subject = `Assistant salons : ${fresh.length} nouveaux rôles saisis à la main`;
    const html = renderEmailShell({
      title: subject,
      preheader: 'Des visiteurs ont décrit eux-mêmes leur rôle : la liste des rôles est peut-être à compléter.',
      bodyBlocks: [
        heading('Des rôles à ajouter ?'),
        paragraph(`${fresh.length} visiteurs ont choisi « Autre » et saisi eux-mêmes leur rôle en créant leur assistant. Voici ces saisies :`),
        dataTable(freshGroups.map((g) => [g.label, g.n > 1 ? `${g.n} fois` : '1 fois'] as [string, string])),
        paragraph('Les plus fréquentes depuis le début :'),
        dataTable(allGroups.map((g) => [g.label, `${g.n}`] as [string, string])),
        paragraph("Si un rôle revient souvent, il mérite sans doute d'entrer dans la liste proposée à l'écran 2."),
      ],
      cta: { label: "Voir l'aperçu de l'assistant", href: `${appBaseUrl}/admin/assistant-apercu` },
      footer: { extraHtml: `Email automatique, envoyé quand au moins ${SEUIL} nouvelles saisies se sont accumulées.` },
    });
    const text = [
      subject,
      '',
      ...freshGroups.map((g) => `- ${g.label} (${g.n})`),
      '',
      `Aperçu : ${appBaseUrl}/admin/assistant-apercu`,
    ].join('\n');

    await sendResendEmail({
      to: ADMIN_EMAIL,
      subject,
      html,
      text,
      tags: [{ name: 'feature', value: 'assistant' }, { name: 'email_type', value: 'roles_digest' }],
    });

    const mark = await admin.from('assistant_role_other_entries')
      .update({ notified_at: new Date().toISOString() })
      .in('id', fresh.map((r) => r.id));
    if (mark.error) console.error('[assistant-roles-digest] marquage', mark.error.message);
    return json({ ok: true, sent: true, nouvelles: fresh.length });
  } catch (e) {
    console.error('[assistant-roles-digest]', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
