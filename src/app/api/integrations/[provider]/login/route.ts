
import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConfig, createOAuthClient } from '@/lib/oauth';
import { getServerUser } from '@/lib/auth-server';
import { CrmProvider } from '@/types/crm';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    // Check authentication
    const user = await getServerUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const provider = params.provider as CrmProvider;
    
    // Validate provider
    if (!['salesforce', 'hubspot', 'pipedrive', 'zoho'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Get OAuth configuration
    const config = getOAuthConfig(provider);
    const client = createOAuthClient(config);
    
    // Build redirect URI
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/integrations/${provider}/callback`;
    
    // Generate authorization URL
    const authUrl = client.authorizeURL({
      redirect_uri: redirectUri,
      scope: config.scopes.join(' '),
      state: user.id, // Use user ID as state for security
      ...config.extraAuthParams,
    });

    // Redirect to OAuth provider
    return NextResponse.redirect(authUrl, { status: 307 });
    
  } catch (error) {
    console.error(`OAuth login error for ${params.provider}:`, error);
    return NextResponse.json(
      { error: 'OAuth configuration error' },
      { status: 500 }
    );
  }
}
