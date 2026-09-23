// Vercel Serverless Function : aperçu de partage des pages d'invitation (lot 6).
//
// Le site est une SPA : LinkedIn, WhatsApp, Slack, Teams, etc. ne lisent pas le
// JavaScript. vercel.json redirige UNIQUEMENT les robots d'aperçu (user-agent)
// de /invitation/:slug vers cette fonction, qui renvoie les balises Open Graph
// à jour depuis Supabase. Les visiteurs humains reçoivent la SPA normale.
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
      console.error('[invitation-og] fetch failed', { slug, error: String(e && e.message || e) });
    }
  }

  let title = 'Invitation | Lotexpo';
  let description = 'Retrouvez les exposants et leurs nouveautés avant les salons professionnels.';
  let image = DEFAULT_IMAGE;

  if (data && data.active) {
    const ex = data.exhibitor?.name || 'Un exposant';
    const ev = data.event?.name || 'un salon';
    title = data.headline ? `${data.headline} | ${ex}` : `${ex} vous invite sur ${ev}`;
    const bits = [
      `${ev}, ${dateRange(data.event?.date_debut, data.event?.date_fin)}`,
      data.stand ? `stand ${data.stand}` : null,
    ].filter(Boolean).join(', ');
    description = `${data.novelty?.title ? `${data.novelty.title}. ` : ''}${bits}. Réservez votre rendez-vous sur le stand.`;
    image = data.novelty?.url_image || data.event?.url_image || data.exhibitor?.logo_url || DEFAULT_IMAGE;
  } else if (data && data.event?.name) {
    title = `Invitation terminée | ${data.event.name}`;
  }

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lotexpo">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
<p><a href="${esc(url)}">Ouvrir l'invitation</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Court cache : une modification de la page se reflète en quelques minutes.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}
