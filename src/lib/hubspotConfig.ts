export const HUBSPOT_CLIENT_ID = 
  import.meta.env.VITE_HUBSPOT_CLIENT_ID ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_CLIENT_ID ?? "";

export const HUBSPOT_REDIRECT_URI = 
  import.meta.env.VITE_HUBSPOT_REDIRECT_URI ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_REDIRECT_URI ?? "";

export const CRM_OAUTH_ENABLED =
  (import.meta.env.VITE_CRM_OAUTH_ENABLED ?? (globalThis as any).NEXT_PUBLIC_CRM_OAUTH_ENABLED ?? "true") === "true";

export function readDebugOverrides() {
  const id = sessionStorage.getItem('oauth_debug_client_id') || '';
  const uri = sessionStorage.getItem('oauth_debug_redirect_uri') || '';
  return { id, uri };
}

export function isHubspotConfigValidRaw(id: string, uri: string) {
  return !!id && /^[0-9a-f-]{36}$/i.test(id) && uri.startsWith('https://lotexpo.com/oauth/hubspot/callback');
}

export function getEffectiveHubspotConfig() {
  const dbg = readDebugOverrides();
  const envId = import.meta.env.VITE_HUBSPOT_CLIENT_ID ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_CLIENT_ID ?? '';
  const envUri = import.meta.env.VITE_HUBSPOT_REDIRECT_URI ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_REDIRECT_URI ?? '';
  const dbgValid = isHubspotConfigValidRaw(dbg.id, dbg.uri);
  const envValid = isHubspotConfigValidRaw(envId, envUri);
  if (dbgValid) return { source: 'debug', clientId: dbg.id, redirectUri: dbg.uri };
  if (envValid) return { source: 'env', clientId: envId, redirectUri: envUri };
  return { source: 'none', clientId: '', redirectUri: '' };
}

export function isHubspotConfigValid(id = HUBSPOT_CLIENT_ID, uri = HUBSPOT_REDIRECT_URI): boolean {
  return Boolean(
    id &&
    /^[0-9a-f-]{36}$/i.test(id) && // UUID format
    typeof uri === "string" &&
    uri.startsWith("https://lotexpo.com/oauth/hubspot/callback")
  );
}

export function getHubspotConfigIssues(): string[] {
  const issues: string[] = [];
  if (!HUBSPOT_CLIENT_ID) issues.push("HUBSPOT_CLIENT_ID manquant");
  if (!HUBSPOT_REDIRECT_URI) issues.push("HUBSPOT_REDIRECT_URI manquant");
  else if (!HUBSPOT_REDIRECT_URI.startsWith("https://lotexpo.com/oauth/hubspot/callback"))
    issues.push("HUBSPOT_REDIRECT_URI invalide (attendu https://lotexpo.com/oauth/hubspot/callback)");
  return issues;
}

// Validate redirect URI format (soft validation)
export const validateHubSpotConfig = (): { valid: boolean; errors: string[] } => {
  const issues = getHubspotConfigIssues();
  return { valid: issues.length === 0, errors: issues };
};

export const HUBSPOT_SCOPE = 'oauth crm.objects.companies.read crm.objects.contacts.read';
export const HUBSPOT_AUTHORIZE_URL = 'https://app-eu1.hubspot.com/oauth/authorize';

export const buildHubSpotAuthUrl = (state: string, debugClientId?: string, debugRedirectUri?: string): { url?: string; error?: string } => {
  // Use debug values if provided, otherwise use config values
  const clientId = debugClientId || HUBSPOT_CLIENT_ID;
  const redirectUri = debugRedirectUri || HUBSPOT_REDIRECT_URI;
  
  const validation = validateHubSpotConfig();
  
  // For debug mode, validate the provided values instead
  if (debugClientId && debugRedirectUri) {
    if (!isHubspotConfigValid(debugClientId, debugRedirectUri)) {
      return { error: 'Configuration debug invalide: vérifiez le format UUID du client_id et que redirect_uri commence par https://lotexpo.com/oauth/hubspot/callback' };
    }
  } else if (!validation.valid) {
    console.warn('HubSpot config validation failed:', validation.errors);
    return { error: validation.errors.join(', ') };
  }
  
  try {
    const url = new URL(HUBSPOT_AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', HUBSPOT_SCOPE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    
    return { url: url.toString() };
  } catch (error) {
    console.error('Error building HubSpot auth URL:', error);
    return { error: `Erreur lors de la construction de l'URL d'autorisation: ${error instanceof Error ? error.message : 'erreur inconnue'}` };
  }
};

// Helper to mask sensitive values for display
export const maskClientId = (clientId: string): string => {
  if (!clientId) return 'manquant';
  if (clientId.length < 8) return clientId;
  return `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}`;
};