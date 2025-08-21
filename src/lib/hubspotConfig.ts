export const HUBSPOT_CLIENT_ID = 
  import.meta.env.VITE_HUBSPOT_CLIENT_ID ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_CLIENT_ID;

export const HUBSPOT_REDIRECT_URI = 
  import.meta.env.VITE_HUBSPOT_REDIRECT_URI ?? (globalThis as any).NEXT_PUBLIC_HUBSPOT_REDIRECT_URI;

if (!HUBSPOT_CLIENT_ID || !HUBSPOT_REDIRECT_URI) {
  throw new Error("HubSpot OAuth config missing: CLIENT_ID or REDIRECT_URI");
}

// Validate redirect URI format
export const validateHubSpotConfig = () => {
  if (!HUBSPOT_REDIRECT_URI.startsWith('https://lotexpo.com/oauth/hubspot/callback')) {
    throw new Error(`Mauvaise configuration du redirect_uri (attendu: https://lotexpo.com/oauth/hubspot/callback, reçu: ${HUBSPOT_REDIRECT_URI})`);
  }
};

export const HUBSPOT_SCOPE = 'oauth crm.objects.companies.read crm.objects.contacts.read';
export const HUBSPOT_AUTHORIZE_URL = 'https://app-eu1.hubspot.com/oauth/authorize';

export const buildHubSpotAuthUrl = (state: string): string => {
  validateHubSpotConfig();
  
  const url = new URL(HUBSPOT_AUTHORIZE_URL);
  url.searchParams.set('client_id', HUBSPOT_CLIENT_ID);
  url.searchParams.set('redirect_uri', HUBSPOT_REDIRECT_URI);
  url.searchParams.set('scope', HUBSPOT_SCOPE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  
  return url.toString();
};