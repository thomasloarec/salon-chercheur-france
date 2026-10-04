// supabase/functions/assistant-alerts-unsubscribe/index.ts
// Assistant salons, lot 5 : désinscription des emails de l'assistant.
// POST uniquement, avec le jeton dans l'adresse (?token=…) ou dans le corps JSON ({ "token": "…" }) :
//   - appelée par la page lotexpo.com/desinscription-assistant (bouton de confirmation) ;
//   - appelée directement par les messageries (désinscription en un clic, en-tête List-Unsubscribe-Post).
// Pas de page HTML ici : le domaine supabase.co sert le HTML en texte brut. La page vit sur le site.
// Réponse : { ok: true, deja: boolean } ; 400 jeton invalide.
// La cloche du site n'est pas concernée. Sécurité : verify_jwt = false, jeton aléatoire (RPC
// assistant_alerts_unsubscribe, clé de service).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let token = new URL(req.url).searchParams.get('token') ?? '';
  if (!token && (req.headers.get('content-type') ?? '').includes('application/json')) {
    try {
      const b = await req.json();
      token = typeof b?.token === 'string' ? b.token : '';
    } catch { /* corps vide */ }
  }
  if (!UUID_RE.test(token)) return json({ ok: false, error: 'Lien invalide' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await supabase.rpc('assistant_alerts_unsubscribe', { p_token: token });
  if (error) {
    console.error('[assistant-alerts-unsubscribe]', error.message);
    return json({ ok: false, error: 'Désinscription impossible pour le moment' }, 500);
  }
  const res = data as { ok?: boolean; deja?: boolean } | null;
  if (!res?.ok) return json({ ok: false, error: 'Lien invalide' }, 400);
  return json({ ok: true, deja: res.deja === true });
});
