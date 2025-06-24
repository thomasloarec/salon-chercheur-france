
import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConfig, createOAuthClient } from '@/lib/oauth';
import { getServerUser } from '@/lib/auth-server';
import { supabase } from '@/integrations/supabase/client';
import { syncCrmAccounts } from '@/lib/syncCrmAccounts';
import { CrmProvider } from '@/types/crm';
import dayjs from 'dayjs';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    // Check authentication
    const user = await getServerUser(request);
    if (!user) {
      const redirectUrl = `/crm-integrations?error=unauthorized`;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    const provider = params.provider as CrmProvider;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error(`OAuth error for ${provider}:`, error);
      const redirectUrl = `/crm-integrations?error=${provider}`;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Validate required parameters
    if (!code || state !== user.id) {
      const redirectUrl = `/crm-integrations?error=${provider}`;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Get OAuth configuration and client
    const config = getOAuthConfig(provider);
    const client = createOAuthClient(config);
    
    // Build redirect URI
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/integrations/${provider}/callback`;

    // Exchange code for tokens
    const tokenParams = {
      code,
      redirect_uri: redirectUri,
      scope: config.scopes.join(' '),
    };

    const accessToken = await client.getToken(tokenParams);
    const token = accessToken.token;

    // Calculate expiration time
    const expiresAt = token.expires_in 
      ? dayjs().add(token.expires_in, 'seconds').toISOString()
      : null;

    // Upsert connection in database
    const { error: dbError } = await supabase
      .from('user_crm_connections')
      .upsert({
        user_id: user.id,
        provider,
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
        ignoreDuplicates: false,
      });

    if (dbError) {
      console.error('Database error saving CRM connection:', dbError);
      const redirectUrl = `/crm-integrations?error=${provider}`;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Trigger initial sync
    try {
      await syncCrmAccounts(user.id, provider);
    } catch (syncError) {
      console.error(`Initial sync failed for ${provider}:`, syncError);
      // Don't fail the connection if sync fails
    }

    // Redirect to integrations page with success message
    const redirectUrl = `/crm-integrations?connected=${provider}`;
    return NextResponse.redirect(new URL(redirectUrl, request.url));

  } catch (error) {
    console.error(`OAuth callback error for ${params.provider}:`, error);
    const redirectUrl = `/crm-integrations?error=${params.provider}`;
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }
}
