
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://lotexpo.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OAuth-State',
  'Access-Control-Max-Age': '86400',
};

// Legacy export for backward compatibility
export const CORS_HEADERS = corsHeaders;

export const preflight = () =>
  new Response(null, { status: 204, headers: corsHeaders });
