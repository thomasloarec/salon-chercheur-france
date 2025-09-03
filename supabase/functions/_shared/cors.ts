const ALLOWED_ORIGINS = new Set([
  "https://lotexpo.com",
  "https://www.lotexpo.com"
]);

function resolveOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin") || req.headers.get("origin");
  if (!origin) return null;
  
  // Autoriser les domaines exacts
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  
  // Autoriser les sandbox Lovable si nécessaire (en dev)
  if (origin.includes(".sandbox.lovable.dev")) return origin;
  
  return null;
}

export function corsHeaders(req: Request) {
  const origin = resolveOrigin(req);
  const headers: HeadersInit = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-requested-with, x-oauth-state",
    "Vary": "Origin",
  };
  
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  
  return headers;
}

export function handleOptions(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}