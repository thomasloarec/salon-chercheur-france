import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT by extracting and validating the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ JWT Auth failed: No valid authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client for JWT verification and database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT by getting user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      console.error('❌ JWT Auth failed:', authError?.message || 'User not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid JWT token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body to get encrypted tokens
    const { access_token_enc, refresh_token_enc } = await req.json();

    if (!access_token_enc) {
      return new Response(
        JSON.stringify({ success: false, error: 'Encrypted access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const encryptionKey = Deno.env.get('CRM_ENCRYPTION_KEY') || 'dev-encryption-key-change-in-production';

    // Decrypt access token
    const { data: accessToken, error: decryptError1 } = await supabase.rpc('pgp_sym_decrypt', {
      data: access_token_enc,
      psw: encryptionKey
    });

    if (decryptError1) {
      console.error('❌ Error decrypting access token:', decryptError1);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to decrypt access token' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }

    // Decrypt refresh token if present
    let refreshToken = null;
    if (refresh_token_enc) {
      const { data: decRefreshToken, error: decryptError2 } = await supabase.rpc('pgp_sym_decrypt', {
        data: refresh_token_enc,
        psw: encryptionKey
      });

      if (decryptError2) {
        console.error('❌ Error decrypting refresh token:', decryptError2);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to decrypt refresh token' 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        });
      }
      
      refreshToken = decRefreshToken;
    }

    console.log('✅ Successfully decrypted CRM tokens for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in decrypt-crm-tokens function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});