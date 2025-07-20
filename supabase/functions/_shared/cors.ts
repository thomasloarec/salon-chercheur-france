
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Lovable-Admin, Authorization"
};

export const preflight = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });
