// Vercel Serverless Function : aperçu de partage des pages d'invitation (lot 6, v2).
//
// Le site est une SPA : WhatsApp, LinkedIn, Teams, iMessage, etc. ne lisent pas le
// JavaScript. vercel.json envoie TOUTES les requêtes /invitation/:slug vers cette
// fonction (plus de tri par user-agent : certains aperçus, comme WhatsApp Web,
// n'annoncent pas de robot). La fonction récupère la coquille de l'application
// (/index), remplace ses balises titre / description / Open Graph par celles de
// l'invitation, et renvoie le tout : les visiteurs obtiennent la page normale,
// les aperçus obtiennent le bon texte et la bonne image.
//
// Données : RPC publique get_invitation_page (ouverte à anon volontairement).
// La clé utilisée est la clé publique anon, déjà présente dans le code client.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vxivdvzzhebobveedxbj.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aXZkdnp6aGVib2J2ZWVkeGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTY5NTEsImV4cCI6MjA2NDc5Mjk1MX0.s1P0Hj1u1g1BtAczv_gkippD9wTwkUj2pwxKchkZ8Hw';

const SITE = 'https://lotexpo.com';
const DEFAULT_IMAGE = `${SITE}/og-exhibitor-default.png`;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dateRange(debut, fin) {
  if (!debut) return '';
  const [y1, m1, d1] = debut.slice(0, 10).split('-').map(Number);
  if (!fin || fin.slice(0, 10) === debut.slice(0, 10)) return `le ${d1} ${MONTHS[m1 - 1]} ${y1}`;
  const [y2, m2, d2] = fin.slice(0, 10).split('-').map(Number);
  return m1 === m2 && y1 === y2
    ? `du ${d1} au ${d2} ${MONTHS[m2 - 1]} ${y2}`
    : `du ${d1} ${MONTHS[m1 - 1]} au ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

/** « au salon Sommet de l'élevage », « au Salon de l'Agriculture ». */
function salonPhrase(name) {
  const n = String(name || '').trim();
  if (!n) return 'à un salon';
  return /^salon\b/i.test(n) ? `au ${n}` : `au salon ${n}`;
}

/** Images du stockage Supabase : version 1200 x 630 compressée (WhatsApp ignore les images trop lourdes). */
function shareImage(src) {
  if (!src) return { url: DEFAULT_IMAGE, sized: false };
  const marker = '/storage/v1/object/public/';
  if (src.startsWith(SUPABASE_URL) && src.includes(marker)) {
    return {
      url: `${src.replace(marker, '/storage/v1/render/image/public/')}?width=1200&height=630&resize=cover&quality=75`,
      sized: true,
    };
  }
  return { url: src, sized: false };
}

async function fetchText(u) {
  const r = await fetch(u, { headers: { 'User-Agent': 'lotexpo-invitation-og' } });
  if (!r.ok) throw new Error(`${u} -> ${r.status}`);
  return r.text();
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 200);
  const url = `${SITE}/invitation/${slug}`;

  let data = null;
  if (slug) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_invitation_page`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_slug: slug }),
      });
      if (r.ok) data = await r.json();
    } catch (e) {
      console.error('[invitation-og] rpc failed', { slug, error: String((e && e.message) || e) });
    }
  }

  let title = 'Invitation | Lotexpo';
  let description = 'Retrouvez les exposants et leurs nouveautés avant les salons professionnels.';
  let image = { url: DEFAULT_IMAGE, sized: false };

  if (data && data.active) {
    const ex = data.exhibitor?.name || 'Un exposant';
    title = `${ex} vous invite ${salonPhrase(data.event?.name)}`;
    const where = [
      `${data.event?.name || 'Salon'}, ${dateRange(data.event?.date_debut, data.event?.date_fin)}`.replace(/, $/, ''),
      data.stand ? `stand ${data.stand}` : null,
    ].filter(Boolean).join(', ');
    description = `${data.novelty?.title ? `Au programme : « ${data.novelty.title} ». ` : ''}${where}. Réservez votre rendez-vous sur le stand.`;
    image = shareImage(data.novelty?.url_image || data.event?.url_image || data.exhibitor?.logo_url);
  } else if (data && data.event?.name) {
    title = `Invitation terminée | ${data.event.name}`;
  }

  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="robots" content="noindex, nofollow" />`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Lotexpo" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${esc(image.url)}" />`,
    image.sized ? `<meta property="og:image:width" content="1200" />` : '',
    image.sized ? `<meta property="og:image:height" content="630" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image.url)}" />`,
  ].filter(Boolean).join('\n    ');

  let html;
  try {
    // Coquille de l'application (déjà servie aux visiteurs sur toutes les routes).
    const shell = await fetchText(`${SITE}/index`);
    html = shell
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description|robots)"[^>]*>/gi, '')
      .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
      // Texte de repli SEO de l'accueil : remplacé par celui de l'invitation.
      .replace(/<div id="seo-prerender"[\s\S]*?<\/div>\s*(?=<div id="root")/i,
        `<div id="seo-prerender" class="seo-prerender-fallback"><h1>${esc(title)}</h1><p>${esc(description)}</p></div>\n`)
      .replace(/<\/head>/i, `    ${tags}\n</head>`);
    if (!html.includes('id="root"')) throw new Error('shell without root');
  } catch (e) {
    console.error('[invitation-og] shell failed', { slug, error: String((e && e.message) || e) });
    // Repli : page statique minimale (l'aperçu reste correct, le lien reste utilisable).
    html = `<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${tags}
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
<p><a href="${SITE}/">Découvrir Lotexpo</a></p>
</body>
</html>`;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Court cache : une modification de la page se reflète en quelques minutes.
  // Le cache Vercel est vidé à chaque déploiement (la coquille reste à jour).
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}
