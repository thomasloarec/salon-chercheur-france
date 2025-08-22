export const SUPABASE_FUNCTIONS_URL = "https://vxivdvzzhebobveedxbj.supabase.co/functions/v1";

export const OAUTH_ENDPOINTS = {
  hubspotCallback: `${SUPABASE_FUNCTIONS_URL}/oauth-hubspot-callback`,
  hubspotDiagnostic: `${SUPABASE_FUNCTIONS_URL}/oauth-hubspot-callback?diag=1`
} as const;