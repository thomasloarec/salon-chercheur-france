import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://lotexpo.com',
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

    // Parse request body
    const { user_id, provider, access_token, refresh_token, expires_at } = await req.json();

    if (!user_id || !provider || !access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id, provider, and access_token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is updating their own tokens
    if (user.id !== user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Cannot update tokens for other users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configuration stricte - supprimer tous fallbacks
    const encryptionKey = Deno.env.get('CRM_ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.log(JSON.stringify({ 
        stage: "config_check", 
        detail: "CRM_ENCRYPTION_KEY missing" 
      }));
      return new Response(JSON.stringify({ 
        code: "ENCRYPTION_KEY_MISSING",
        success: false, 
        error: 'Configuration de chiffrement manquante' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }
    
    // Validation taille clé (32 bytes après décodage base64)
    try {
      const keyBuffer = new Uint8Array(atob(encryptionKey).split('').map(c => c.charCodeAt(0)));
      if (keyBuffer.length < 32) {
        console.log(JSON.stringify({ 
          stage: "key_validation", 
          detail: `Key too short: ${keyBuffer.length} bytes, needs 32` 
        }));
        return new Response(JSON.stringify({ 
          code: "ENCRYPTION_KEY_TOO_SHORT",
          success: false, 
          error: 'Clé de chiffrement trop courte' 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        });
      }
    } catch (keyDecodeError) {
      console.log(JSON.stringify({ 
        stage: "key_decode", 
        detail: `Key decode failed: ${keyDecodeError}` 
      }));
      return new Response(JSON.stringify({ 
        code: "ENCRYPTION_KEY_INVALID_FORMAT",
        success: false, 
        error: 'Format de clé de chiffrement invalide' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }

    // Encrypt access token
    const { data: encryptedAccessToken, error: encryptError1 } = await supabase.rpc('pgp_sym_encrypt', {
      data: access_token,
      psw: encryptionKey
    });

    if (encryptError1) {
      console.error('❌ Error encrypting access token:', encryptError1);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to encrypt access token' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }

    // Encrypt refresh token if present
    let encryptedRefreshToken = null;
    if (refresh_token) {
      const { data: encRefreshToken, error: encryptError2 } = await supabase.rpc('pgp_sym_encrypt', {
        data: refresh_token,
        psw: encryptionKey
      });

      if (encryptError2) {
        console.error('❌ Error encrypting refresh token:', encryptError2);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to encrypt refresh token' 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        });
      }
      
      encryptedRefreshToken = encRefreshToken;
    }

    // Update encrypted tokens in database
    const { error: dbError } = await supabase
      .from('user_crm_connections')
      .update({
        access_token_enc: encryptedAccessToken,
        refresh_token_enc: encryptedRefreshToken,
        expires_at: expires_at,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .eq('provider', provider);

    if (dbError) {
      console.error('❌ Database error updating encrypted tokens:', dbError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update tokens in database',
        details: dbError.message
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }

    console.log('✅ Successfully updated encrypted CRM tokens for user:', user.id, 'provider:', provider);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tokens updated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in update-crm-tokens function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});