export const ALLOWED_ORIGINS = [
  "https://lotexpo.fr",
  "https://*.lovableproject.com",
  "http://localhost:3000",
  "http://localhost:5173"
];

function matchOrigin(origin: string | null): string | null {
  if (!origin) return null;
  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed.includes("*")) {
      // support wildcard subdomain only: https://*.domain.tld
      const base = allowed.replace("https://*.", "");
      if (origin === `https://${base}` || origin.endsWith(`.${base}`)) return origin;
    } else if (origin === allowed) {
      return origin;
    }
  }
  return null;
}

export function buildCorsHeaders(origin: string | null) {
  const allowed = matchOrigin(origin);
  const allowOrigin = allowed ?? "null"; // ne pas mettre "*" si Authorization est utilisé
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  } as const;
}

export function handleCors(req: Request) {
  const headers = buildCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    // Préflight OK
    return new Response(null, { status: 204, headers });
  }
  return { headers };
}