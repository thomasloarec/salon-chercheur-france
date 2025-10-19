import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { z } from "https://esm.sh/zod@3.23.8";

const revokeSchema = z.object({
  exhibitor_id: z.string().uuid(),
  event_id: z.string().uuid(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error('Missing environment variables');
    }

    // Admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth client to verify user
    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('[premium-revoke] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.error('[premium-revoke] Not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const payload = revokeSchema.parse(body);

    console.log('[premium-revoke] Revoking Premium:', payload);

    // Revoke by setting revoked_at
    const { data, error } = await supabaseAdmin
      .from('premium_entitlements')
      .update({ revoked_at: new Date().toISOString() })
      .eq('exhibitor_id', payload.exhibitor_id)
      .eq('event_id', payload.event_id)
      .is('revoked_at', null)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[premium-revoke] DB error:', error);
      throw error;
    }

    if (!data) {
      console.warn('[premium-revoke] No active entitlement found');
      return new Response(
        JSON.stringify({ success: false, message: 'No active Premium entitlement found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[premium-revoke] Success:', data.id);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[premium-revoke] Error:', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
