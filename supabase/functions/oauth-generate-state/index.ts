import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSignedState } from '../_shared/oauth-state.ts';

const json = (body: unknown, init: ResponseInit = {}) => 
  new Response(JSON.stringify(body), { 
    ...init, 
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...init.headers }
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Verify JWT and get user ID
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Authorization header required' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
    
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (error || !user) {
      return json({ error: 'Invalid token' }, { status: 401 });
    }

    // Generate signed state with user ID
    const signedState = await createSignedState(user.id);
    
    return json({ 
      success: true, 
      state: signedState,
      expires_in: 600 // 10 minutes
    });

  } catch (error) {
    console.error('OAuth state generation error:', error);
    return json({ 
      error: 'Failed to generate state',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});