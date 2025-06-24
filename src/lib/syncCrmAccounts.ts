
import { supabase } from '@/integrations/supabase/client';
import { getCrmConfig } from './crmConfig';
import { CrmProvider, CrmAccount, CrmConnection } from '@/types/crm';
import dayjs from 'dayjs';

export async function syncCrmAccounts(userId: string, provider: CrmProvider): Promise<void> {
  console.log(`Starting CRM sync for user ${userId} with provider ${provider}`);
  
  // Get user's CRM connection
  const { data: connectionData, error: connectionError } = await supabase
    .from('user_crm_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (connectionError || !connectionData) {
    throw new Error(`No CRM connection found for provider ${provider}`);
  }

  // Cast the connection data to proper type
  const connection: CrmConnection = {
    ...connectionData,
    provider: connectionData.provider as CrmProvider
  };

  // Check if token needs refresh
  let accessToken = connection.access_token;
  if (connection.expires_at && dayjs(connection.expires_at).isBefore(dayjs().add(5, 'minutes'))) {
    accessToken = await refreshToken(connection);
  }

  // Fetch accounts from CRM
  const accounts = await fetchCrmAccounts(provider, accessToken);
  
  // Sync accounts to database
  await syncAccountsToDatabase(userId, provider, accounts);
  
  // Update last sync time
  await supabase
    .from('user_crm_connections')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', connection.id);

  console.log(`Synced ${accounts.length} accounts for provider ${provider}`);
}

async function refreshToken(connection: CrmConnection): Promise<string> {
  if (!connection.refresh_token) {
    throw new Error('No refresh token available');
  }

  const config = getCrmConfig(connection.provider);
  
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  const tokenData = await response.json();
  
  // Update token in database
  await supabase
    .from('user_crm_connections')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      expires_at: tokenData.expires_in 
        ? dayjs().add(tokenData.expires_in, 'seconds').toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return tokenData.access_token;
}

async function fetchCrmAccounts(provider: CrmProvider, accessToken: string): Promise<CrmAccount[]> {
  const config = getCrmConfig(provider);
  let url: string;
  let headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  switch (provider) {
    case 'salesforce':
      url = `${config.apiBaseUrl}/services/data/v58.0/sobjects/Account`;
      break;
    case 'hubspot':
      url = `${config.apiBaseUrl}/crm/v3/objects/companies`;
      break;
    case 'pipedrive':
      url = `${config.apiBaseUrl}/v1/organizations`;
      break;
    case 'zoho':
      url = `${config.apiBaseUrl}/crm/v5/Accounts`;
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`CRM API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return mapCrmResponse(provider, data);
}

function mapCrmResponse(provider: CrmProvider, data: any): CrmAccount[] {
  switch (provider) {
    case 'salesforce':
      return (data.records || []).map((record: any) => ({
        external_id: record.Id,
        name: record.Name,
        website: record.Website,
      }));
    
    case 'hubspot':
      return (data.results || []).map((company: any) => ({
        external_id: company.id,
        name: company.properties?.name || 'Unknown',
        website: company.properties?.website,
      }));
    
    case 'pipedrive':
      return (data.data || []).map((org: any) => ({
        external_id: org.id.toString(),
        name: org.name,
        website: org.web_url,
      }));
    
    case 'zoho':
      return (data.data || []).map((account: any) => ({
        external_id: account.id,
        name: account.Account_Name,
        website: account.Website,
      }));
    
    default:
      return [];
  }
}

async function syncAccountsToDatabase(userId: string, provider: CrmProvider, accounts: CrmAccount[]): Promise<void> {
  for (const account of accounts) {
    // Upsert company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({
        name: account.name,
        website: account.website,
      }, {
        onConflict: 'name',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (companyError) {
      console.error('Error upserting company:', companyError);
      continue;
    }

    // Upsert user_crm_companies
    const { error: userCompanyError } = await supabase
      .from('user_crm_companies')
      .upsert({
        user_id: userId,
        company_id: company.id,
        provider,
        external_id: account.external_id,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider,external_id',
        ignoreDuplicates: false,
      });

    if (userCompanyError) {
      console.error('Error upserting user_crm_companies:', userCompanyError);
    }
  }
}
