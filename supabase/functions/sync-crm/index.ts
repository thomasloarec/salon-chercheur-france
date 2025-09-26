
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting daily CRM sync job');

    // Get all active CRM connections
    const { data: connections, error } = await supabase
      .from('user_crm_connections')
      .select('*');

    if (error) {
      throw error;
    }

    console.log(`Found ${connections?.length || 0} CRM connections to sync`);

    const results = [];
    
    for (const connection of connections || []) {
      try {
        await syncCrmAccountsForConnection(supabase, connection);
        results.push({ 
          userId: connection.user_id, 
          provider: connection.provider, 
          status: 'success' 
        });
      } catch (syncError) {
        console.error(`Sync failed for user ${connection.user_id}, provider ${connection.provider}:`, syncError);
        results.push({ 
          userId: connection.user_id, 
          provider: connection.provider, 
          status: 'error',
          error: syncError instanceof Error ? syncError.message : String(syncError) 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'CRM sync completed', 
        results,
        totalConnections: connections?.length || 0 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('CRM sync job failed:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function syncCrmAccountsForConnection(supabase: any, connection: any) {
  // This is a simplified version - in practice, you'd implement the full sync logic here
  // or call the sync function from your main application
  
  console.log(`Syncing CRM accounts for user ${connection.user_id}, provider ${connection.provider}`);
  
  const config = getCrmConfig(connection.provider);
  let accessToken = connection.access_token;
  
  // Check if token needs refresh
  if (connection.expires_at && new Date(connection.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    accessToken = await refreshToken(supabase, connection);
  }
  
  // Fetch accounts from CRM
  const accounts = await fetchCrmAccounts(connection.provider, accessToken, config);
  
  // Sync accounts to database
  await syncAccountsToDatabase(supabase, connection.user_id, connection.provider, accounts);
  
  // Update last sync time
  await supabase
    .from('user_crm_connections')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', connection.id);
}

function getCrmConfig(provider: string) {
  switch (provider) {
    case 'salesforce':
      return {
        authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        apiBaseUrl: 'https://api.salesforce.com',
        clientId: Deno.env.get('SF_CLIENT_ID')!,
        clientSecret: Deno.env.get('SF_CLIENT_SECRET')!,
      };
    case 'hubspot':
      return {
        authUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
        apiBaseUrl: 'https://api.hubapi.com',
        clientId: Deno.env.get('HUB_CLIENT_ID')!,
        clientSecret: Deno.env.get('HUB_CLIENT_SECRET')!,
      };
    case 'pipedrive':
      return {
        authUrl: 'https://oauth.pipedrive.com/oauth/authorize',
        tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
        apiBaseUrl: 'https://api.pipedrive.com',
        clientId: Deno.env.get('PIPE_CLIENT_ID')!,
        clientSecret: Deno.env.get('PIPE_CLIENT_SECRET')!,
      };
    case 'zoho':
      return {
        authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        apiBaseUrl: 'https://www.zohoapis.com',
        clientId: Deno.env.get('ZOHO_CLIENT_ID')!,
        clientSecret: Deno.env.get('ZOHO_CLIENT_SECRET')!,
      };
    default:
      throw new Error(`Unsupported CRM provider: ${provider}`);
  }
}

async function refreshToken(supabase: any, connection: any): Promise<string> {
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
    }).toString(),
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
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  return tokenData.access_token;
}

async function fetchCrmAccounts(provider: string, accessToken: string, config: any): Promise<any[]> {
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

function mapCrmResponse(provider: string, data: any): any[] {
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

async function syncAccountsToDatabase(supabase: any, userId: string, provider: string, accounts: any[]): Promise<void> {
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
