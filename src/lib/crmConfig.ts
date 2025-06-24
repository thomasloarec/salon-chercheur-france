
import { CrmProvider } from '@/types/crm';

export interface CrmProviderConfig {
  authUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
}

export const getCrmConfig = (provider: CrmProvider): CrmProviderConfig => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  switch (provider) {
    case 'salesforce':
      return {
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        apiBaseUrl: 'https://api.salesforce.com',
        scopes: ['api', 'refresh_token'],
        clientId: process.env.SF_CLIENT_ID!,
        clientSecret: process.env.SF_CLIENT_SECRET!,
      };
    case 'hubspot':
      return {
        authUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
        apiBaseUrl: 'https://api.hubapi.com',
        scopes: ['crm.objects.companies.read'],
        clientId: process.env.HUB_CLIENT_ID!,
        clientSecret: process.env.HUB_CLIENT_SECRET!,
      };
    case 'pipedrive':
      return {
        authUrl: 'https://oauth.pipedrive.com/oauth/authorize',
        tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
        apiBaseUrl: 'https://api.pipedrive.com',
        scopes: ['organizations:read'],
        clientId: process.env.PIPE_CLIENT_ID!,
        clientSecret: process.env.PIPE_CLIENT_SECRET!,
      };
    case 'zoho':
      return {
        authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        apiBaseUrl: 'https://www.zohoapis.com',
        scopes: ['ZohoCRM.modules.accounts.READ'],
        clientId: process.env.ZOHO_CLIENT_ID!,
        clientSecret: process.env.ZOHO_CLIENT_SECRET!,
      };
    default:
      throw new Error(`Unsupported CRM provider: ${provider}`);
  }
};

export const SUPPORTED_CRM_PROVIDERS: CrmProvider[] = ['salesforce', 'hubspot', 'pipedrive', 'zoho'];
