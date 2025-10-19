import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { z } from "https://esm.sh/zod@3.23.8";
import { handleCors } from "../_shared/cors.ts";

const grantSchema = z.object({
  exhibitor_id: z.string().uuid(),
  event_id: z.string().uuid(),
  max_novelties: z.number().int().positive().optional(),
  leads_unlimited: z.boolean().optional(),
  csv_export: z.boolean().optional(),
  notes: z.string().optional(),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors instanceof Response) return cors; // OPTIONS handled
  const { headers } = cors;

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
    if (authError) {
      console.error('[premium-grant] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: `auth_failed: ${authError.message}` }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }
    if (!user) {
      console.error('[premium-grant] No user');
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('[premium-grant] Profile read failed:', profileError);
      return new Response(
        JSON.stringify({ error: `profile_read_failed: ${profileError.message}` }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile || profile.role !== 'admin') {
      console.error('[premium-grant] Not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'forbidden' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const payload = grantSchema.parse(body);

    console.log('[premium-grant] Granting Premium:', payload);

    // Check if entitlement already exists
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('premium_entitlements')
      .select('id, revoked_at')
      .eq('exhibitor_id', payload.exhibitor_id)
      .eq('event_id', payload.event_id)
      .maybeSingle();

    if (selectError) {
      console.error('[premium-grant] Select error:', selectError);
      return new Response(
        JSON.stringify({ error: `select_failed: ${selectError.message}` }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    let error;

    if (existing) {
      // Update existing entitlement
      const result = await supabaseAdmin
        .from('premium_entitlements')
        .update({
          max_novelties: payload.max_novelties ?? 5,
          leads_unlimited: payload.leads_unlimited ?? true,
          csv_export: payload.csv_export ?? true,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
          revoked_at: null,
          notes: payload.notes ?? null,
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Insert new entitlement
      const result = await supabaseAdmin
        .from('premium_entitlements')
        .insert({
          exhibitor_id: payload.exhibitor_id,
          event_id: payload.event_id,
          max_novelties: payload.max_novelties ?? 5,
          leads_unlimited: payload.leads_unlimited ?? true,
          csv_export: payload.csv_export ?? true,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
          revoked_at: null,
          notes: payload.notes ?? null,
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('[premium-grant] DB error:', error);
      return new Response(
        JSON.stringify({ error: `upsert_failed: ${error.message}` }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[premium-grant] Success:', data.id);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[premium-grant] Error:', e);
    const message = (e && (e.message ?? e.toString?.())) || 'unknown_error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
