// Vercel Serverless Function — daily safe rebuild trigger.
//
// Invoked by the Vercel Cron defined in vercel.json. It POSTs to a Vercel
// Deploy Hook (URL read from the DEPLOY_HOOK_URL env var) so a fresh production
// build runs `vite build` + generateSitemap + prerender-seo against the current
// Supabase data, refreshing exhibitor indexability and the sitemap.
//
// Security: the endpoint only triggers when the request carries the Vercel cron
// secret (Authorization: "Bearer <CRON_SECRET>"). Manual/unauthenticated calls
// are rejected with 401.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers['authorization'] || '';

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const hook = process.env.DEPLOY_HOOK_URL;
  if (!hook) {
    return res.status(500).json({ error: 'missing DEPLOY_HOOK_URL env var' });
  }

  try {
    const r = await fetch(hook, { method: 'POST' });
    return res.status(200).json({ triggered: true, hookStatus: r.status });
  } catch (e) {
    return res.status(502).json({ error: 'deploy hook call failed', detail: String(e && e.message || e) });
  }
}