// =====================================================================
// supabase/functions/outreach-unsubscribe/index.ts  — v5
// Lotexpo · projet vxivdvzzhebobveedxbj
//
// Endpoint public de désinscription. verify_jwt = false : le destinataire
// clique depuis sa boîte mail.
//
// v5 — ouverture aux séquences organisateur (WF4). Deux valeurs de seq
// s'ajoutent : organizer_claim et organizer_activation. Le paramètre camp
// peut désormais désigner soit une ligne de outreach_campaigns, soit une
// ligne de organizer_outreach_campaigns ; la RPC résout les deux mondes et
// arrête les campagnes des deux côtés pour l'adresse concernée.
//
// v4 — la fonction ne sert plus de HTML. Les v1 a v3 renvoyaient une page
// complete, systematiquement recue en text/plain par le navigateur, quels
// que soient les en-tetes poses (Uint8Array ou string, Content-Length ou
// non, Headers() ou objet litteral, avec ou sans nosniff). outreach-decline
// presente exactement le meme symptome depuis mai. Conclusion pratique :
// la passerelle *.supabase.co/functions/v1/* ne laisse pas servir du HTML.
//
// La fonction execute donc l'ecriture puis redirige vers une page du site
// lotexpo.com. Avantages au-dela du contournement : le destinataire atterrit
// sur le domaine de la marque et non sur une URL supabase.co, et la page de
// confirmation devient maintenable dans le design system du site.
//
// Toute la logique metier reste dans la RPC public.outreach_unsubscribe().
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_SEQ = ['claim', 'novelty', 'organizer_claim', 'organizer_activation'] as const;

// Cible unique de redirection.
const CONFIRM_URL = 'https://lotexpo.com/desinscription-confirmee';

// Redirection identique quel que soit le resultat reel : campagne inconnue,
// UUID invalide, adresse deja desinscrite ou desinscription effective mènent
// toutes a la meme page. Aucune information n'est divulguee sur l'existence
// d'une campagne, et le destinataire n'a jamais l'impression d'un refus.
function confirm(): Response {
  const h = new Headers();
  h.set('location', CONFIRM_URL);
  h.set('cache-control', 'no-store, no-cache, must-revalidate');
  h.set('referrer-policy', 'no-referrer');
  return new Response(null, { status: 303, headers: h });
}

Deno.serve(async (req) => {
  // HEAD traite comme une simple verification de disponibilite : certains
  // clients mail et antivirus de passerelle en emettent. Il ne doit pas
  // declencher de desinscription, ni renvoyer d'erreur.
  if (req.method === 'HEAD') {
    return new Response(null, { status: 200, headers: { 'cache-control': 'no-store' } });
  }

  if (req.method !== 'GET') {
    return confirm();
  }

  const url = new URL(req.url);
  const camp = url.searchParams.get('camp');
  const seqRaw = url.searchParams.get('seq');
  const seq = ALLOWED_SEQ.includes(seqRaw as typeof ALLOWED_SEQ[number]) ? seqRaw : 'unknown';

  // UUID invalide ou absent : redirection, aucune ecriture.
  if (!camp || !UUID_RE.test(camp)) {
    return confirm();
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase.rpc('outreach_unsubscribe', {
    p_campaign_id: camp,
    p_sequence: seq,
    p_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 400),
  });

  if (error) {
    // Journalise cote serveur, invisible pour le destinataire : on confirme
    // quand meme. Un message d'erreur ici serait percu comme un refus de
    // desinscription, exactement ce qu'il faut eviter.
    console.error('outreach-unsubscribe rpc failed', { camp, seq, error });
  } else {
    console.log('outreach-unsubscribe ok', { camp, seq, result: data });
  }

  return confirm();
});
