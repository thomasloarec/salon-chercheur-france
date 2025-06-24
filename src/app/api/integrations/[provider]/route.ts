
import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth-server';
import { supabase } from '@/integrations/supabase/client';
import { CrmProvider } from '@/types/crm';

export async function DELETE(
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

    // Delete CRM connection
    const { error } = await supabase
      .from('user_crm_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (error) {
      console.error('Database error deleting CRM connection:', error);
      return NextResponse.json(
        { error: 'Failed to delete connection' },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`Delete connection error for ${params.provider}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
