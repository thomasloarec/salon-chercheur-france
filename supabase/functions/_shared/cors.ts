export function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '*';

  // Whitelist stricte en prod (ajuste les domaines réels) :
  const allowed = [
    'https://lotexpo.com',
    'https://www.lotexpo.com',
    'https://id-preview--372be6a2-b585-4c8b-8fb0-060089ac0520.lovable.app', // preview Lovable actuel
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  const allowOrigin = allowed.includes(origin) ? origin : 'https://lotexpo.com';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export function handleOptions(req: Request) {
  return new Response('ok', { status: 200, headers: corsHeaders(req) });
}