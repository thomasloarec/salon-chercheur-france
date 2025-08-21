export const HUBSPOT_CLIENT_ID = 
  import.meta.env.VITE_HUBSPOT_CLIENT_ID ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_CLIENT_ID ?? "";

export const HUBSPOT_REDIRECT_URI = 
  import.meta.env.VITE_HUBSPOT_REDIRECT_URI ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_REDIRECT_URI ?? "";

export const CRM_OAUTH_ENABLED =
  (import.meta.env.VITE_CRM_OAUTH_ENABLED ?? (globalThis as any).NEXT_PUBLIC_CRM_OAUTH_ENABLED ?? "true") === "true";

export function isHubspotConfigValid(): boolean {
  return Boolean(HUBSPOT_CLIENT_ID && HUBSPOT_REDIRECT_URI?.startsWith("https://lotexpo.com/oauth/hubspot/callback"));
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

export const buildHubSpotAuthUrl = (state: string): { url?: string; error?: string } => {
  const validation = validateHubSpotConfig();
  
  if (!validation.valid) {
    console.warn('HubSpot config validation failed:', validation.errors);
    return { error: validation.errors.join(', ') };
  }
  
  try {
    const url = new URL(HUBSPOT_AUTHORIZE_URL);
    url.searchParams.set('client_id', HUBSPOT_CLIENT_ID);
    url.searchParams.set('redirect_uri', HUBSPOT_REDIRECT_URI);
    url.searchParams.set('scope', HUBSPOT_SCOPE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    
    return { url: url.toString() };
  } catch (error) {
    console.error('Error building HubSpot auth URL:', error);
    return { error: `Erreur lors de la construction de l'URL d'autorisation: ${error instanceof Error ? error.message : 'erreur inconnue'}` };
  }
};