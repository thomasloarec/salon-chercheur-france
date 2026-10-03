// supabase/functions/assistant-login-link/index.ts
// Lien de connexion par email, envoyé par Lotexpo lui-même (Resend + gabarit Lotexpo), en français.
// Remplace l'email « Magic link » de Supabase pour le parcours de l'assistant : aucun réglage dans le
// tableau de bord Supabase n'est nécessaire.
//
// Corps : { "email": "...", "next": "/agenda?assistant=bienvenue&claim=..." }
// Réponse : { ok: true } (toujours la même, que le compte existe ou non) ; 400 email invalide ; 429 trop d'envois.
//
// Le lien mène à lotexpo.com/connexion?token_hash=…&type=…&next=… : la page demande un clic sur
// « Me connecter » avant d'utiliser le lien (les antivirus de messagerie qui ouvrent les liens ne le
// consomment donc pas), puis appelle supabase.auth.verifyOtp.
//
// Sécurité : publique (verify_jwt = false) ; limites d'envoi par adresse et par IP (table
// auth_login_link_requests, empreintes SHA-256, jamais l'adresse en clair) ; « next » limité à un chemin
// interne ; réponse identique pour un compte existant ou non.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PER_EMAIL = 3;   // par 15 minutes
const MAX_PER_IP = 20;     // par heure

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeNext(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || !s.startsWith('/') || s.startsWith('//') || s.includes('\\') || s.length > 400) return '/agenda';
  return s;
}

function renderLoginEmail(link: string) {
  const subject = 'Votre lien de connexion à Lotexpo';
  const html = renderEmailShell({
    title: subject,
    preheader: 'Un clic pour vous connecter et retrouver votre assistant salons.',
    bodyBlocks: [
      heading('Votre lien de connexion'),
      paragraph('Bonjour,'),
      paragraph('Cliquez sur le bouton ci-dessous pour vous connecter à Lotexpo et retrouver votre assistant salons.'),
    ],
    cta: { label: 'Me connecter', href: link },
    footer: {
      extraHtml:
        "Ce lien est valable une heure et ne sert qu'une fois. Vous recevez cet email car une connexion à Lotexpo a été demandée avec cette adresse. Si vous n'avez rien demandé, ignorez-le.",
    },
  });
  const text = [
    'Lotexpo',
    'Votre lien de connexion',
    '',
    'Bonjour,',
    'Cliquez sur le lien ci-dessous pour vous connecter à Lotexpo et retrouver votre assistant salons.',
    '',
    link,
    '',
    "Ce lien est valable une heure et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez cet email.",
  ].join('\n');
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500);
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') ?? 'https://lotexpo.com').replace(/\/+$/, '');

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: 'Adresse email invalide.', code: 'invalid_email' }, 400);
  }
  const next = safeNext(body.next);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Limites d'envoi (empreintes, jamais l'adresse ni l'IP en clair)
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  const [emailHash, ipHash] = await Promise.all([sha256(`email:${email}`), sha256(`ip:${ip}`)]);
  const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const since60 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [byEmail, byIp] = await Promise.all([
    admin.from('auth_login_link_requests').select('id', { count: 'exact', head: true })
      .eq('email_hash', emailHash).gte('created_at', since15),
    admin.from('auth_login_link_requests').select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gte('created_at', since60),
  ]);
  if (byEmail.error || byIp.error) {
    console.error('[assistant-login-link] limites', byEmail.error?.message ?? byIp.error?.message);
    return json({ error: 'Envoi impossible pour le moment. Réessayez dans un instant.' }, 500);
  }
  if ((byEmail.count ?? 0) >= MAX_PER_EMAIL || (byIp.count ?? 0) >= MAX_PER_IP) {
    return json({ error: "Trop d'envois en peu de temps. Réessayez dans quelques minutes.", code: 'rate_limited' }, 429);
  }
  const logged = await admin.from('auth_login_link_requests').insert({ email_hash: emailHash, ip_hash: ipHash });
  if (logged.error) console.error('[assistant-login-link] journal', logged.error.message);

  try {
    // Compte existant : lien de connexion. Adresse inconnue : Supabase crée le compte et renvoie le type
    // de vérification à utiliser (verification_type). Repli : invitation, qui crée le compte.
    let gen = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (gen.error || !gen.data?.properties?.hashed_token) {
      console.warn('[assistant-login-link] magiclink indisponible, repli invitation :', gen.error?.message);
      gen = await admin.auth.admin.generateLink({ type: 'invite', email });
    }
    const props = gen.data?.properties;
    if (gen.error || !props?.hashed_token) {
      throw new Error(gen.error?.message ?? 'lien non généré');
    }
    const type = props.verification_type || 'magiclink';
    const link = `${appBaseUrl}/connexion?token_hash=${encodeURIComponent(props.hashed_token)}`
      + `&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`;

    const { subject, html, text } = renderLoginEmail(link);
    await sendResendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: 'feature', value: 'assistant' },
        { name: 'email_type', value: 'login_link' },
      ],
    });
    return json({ ok: true });
  } catch (e) {
    console.error('[assistant-login-link]', (e as Error).message);
    return json({ error: 'Envoi impossible pour le moment. Réessayez dans un instant.' }, 500);
  }
});
