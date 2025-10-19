import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { z } from "https://esm.sh/zod@3.23.8";

const grantSchema = z.object({
  exhibitor_id: z.string().uuid(),
  event_id: z.string().uuid(),
  max_novelties: z.number().int().positive().optional(),
  leads_unlimited: z.boolean().optional(),
  csv_export: z.boolean().optional(),
  notes: z.string().optional(),
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
      console.error('[premium-grant] Auth error:', authError);
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
      console.error('[premium-grant] Not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const payload = grantSchema.parse(body);

    console.log('[premium-grant] Granting Premium:', payload);

    // Upsert premium entitlement
    const { data, error } = await supabaseAdmin
      .from('premium_entitlements')
      .upsert({
        exhibitor_id: payload.exhibitor_id,
        event_id: payload.event_id,
        max_novelties: payload.max_novelties ?? 5,
        leads_unlimited: payload.leads_unlimited ?? true,
        csv_export: payload.csv_export ?? true,
        granted_by: user.id,
        granted_at: new Date().toISOString(),
        revoked_at: null,
        notes: payload.notes ?? null,
      }, {
        onConflict: 'exhibitor_id,event_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[premium-grant] DB error:', error);
      throw error;
    }

    console.log('[premium-grant] Success:', data.id);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[premium-grant] Error:', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
