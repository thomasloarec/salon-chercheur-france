
import { AuthorizationCode } from 'simple-oauth2';
import { CrmProvider } from '@/types/crm';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
}

export function getOAuthConfig(provider: CrmProvider): OAuthConfig {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  switch (provider) {
    case 'salesforce':
      return {
        clientId: process.env.SF_CLIENT_ID!,
        clientSecret: process.env.SF_CLIENT_SECRET!,
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        scopes: ['api', 'refresh_token'],
      };
    
    case 'hubspot':
      return {
        clientId: process.env.HUB_CLIENT_ID!,
        clientSecret: process.env.HUB_CLIENT_SECRET!,
        authUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
        scopes: ['crm.objects.companies.read'],
      };
    
    case 'pipedrive':
      return {
        clientId: process.env.PIPE_CLIENT_ID!,
        clientSecret: process.env.PIPE_CLIENT_SECRET!,
        authUrl: 'https://oauth.pipedrive.com/oauth/authorize',
        tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
        scopes: ['organizations:read'],
      };
    
    case 'zoho':
      return {
        clientId: process.env.ZOHO_CLIENT_ID!,
        clientSecret: process.env.ZOHO_CLIENT_SECRET!,
        authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        scopes: ['ZohoCRM.modules.accounts.READ'],
        extraAuthParams: {
          access_type: 'offline',
        },
      };
    
    default:
      throw new Error(`Unsupported CRM provider: ${provider}`);
  }
}

export function createOAuthClient(config: OAuthConfig) {
  return new AuthorizationCode({
    client: {
      id: config.clientId,
      secret: config.clientSecret,
    },
    auth: {
      tokenHost: new URL(config.tokenUrl).origin,
      tokenPath: new URL(config.tokenUrl).pathname,
      authorizePath: new URL(config.authUrl).pathname,
    },
  });
}
