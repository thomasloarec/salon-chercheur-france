import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'https://esm.sh/zod@3.24.1';
import { buildCorsHeaders } from '../_shared/cors.ts';

/**
 * Edge function: events-duplicate-scan
 *
 * Modes:
 *  - { kind: 'event'|'staging', id: uuid }  → scan ciblé d'un événement
 *  - { rebuild: true, only_future?: boolean } → recalcul de masse (admin uniquement)
 *  - { mark: { source_kind, source_id, matched_kind, matched_id, resolution } }
 *      → marquer une paire comme confirmed_distinct ou confirmed_duplicate
 */

const ScanSchema = z.object({
  kind: z.enum(['event', 'staging']),
  id: z.string().uuid(),
});

const RebuildSchema = z.object({
  rebuild: z.literal(true),
  only_future: z.boolean().optional(),
});

const MarkSchema = z.object({
  mark: z.object({
    source_kind: z.enum(['event', 'staging']),
    source_id: z.string().uuid(),
    matched_kind: z.enum(['event', 'staging']),
    matched_id: z.string().uuid(),
    resolution: z.enum(['confirmed_distinct', 'confirmed_duplicate']),
  }),
});

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Auth requise + admin
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await serviceClient.rpc('has_role', {
      _user_id: user.id, _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));

    // --- 1. Recalcul global ---
    const rebuildParsed = RebuildSchema.safeParse(body);
    if (rebuildParsed.success) {
      const { data, error } = await serviceClient.rpc('rebuild_event_duplicate_candidates', {
        p_only_future: rebuildParsed.data.only_future ?? true,
      });
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 2. Marquer une paire ---
    const markParsed = MarkSchema.safeParse(body);
    if (markParsed.success) {
      const m = markParsed.data.mark;
      const { error } = await serviceClient
        .from('event_duplicate_candidates')
        .update({
          resolution: m.resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .match({
          source_kind: m.source_kind,
          source_id: m.source_id,
          matched_kind: m.matched_kind,
          matched_id: m.matched_id,
        });
      if (error) throw error;

      // Si marqué comme doublon confirmé : pousser le statut sur la source
      if (m.resolution === 'confirmed_duplicate') {
        if (m.source_kind === 'event') {
          await serviceClient.from('events').update({
            duplicate_check_status: 'confirmed_duplicate',
            duplicate_check_at: new Date().toISOString(),
          }).eq('id', m.source_id);
        } else {
          await serviceClient.from('staging_events_import').update({
            duplicate_check_status: 'confirmed_duplicate',
            duplicate_check_at: new Date().toISOString(),
          }).eq('id', m.source_id);
        }
      } else if (m.resolution === 'confirmed_distinct') {
        // Re-scan pour mettre à jour le statut résumé
        await serviceClient.rpc('scan_event_duplicates', {
          p_kind: m.source_kind, p_id: m.source_id, p_persist: true,
        });
        // Si plus aucun candidat actif → marquer la source comme confirmed_distinct
        const { count } = await serviceClient
          .from('event_duplicate_candidates')
          .select('id', { count: 'exact', head: true })
          .match({ source_kind: m.source_kind, source_id: m.source_id })
          .is('resolution', null);
        if (!count) {
          if (m.source_kind === 'event') {
            await serviceClient.from('events').update({
              duplicate_check_status: 'confirmed_distinct',
              duplicate_check_reason: 'Marqué comme distinct par un administrateur',
              duplicate_check_at: new Date().toISOString(),
            }).eq('id', m.source_id);
          } else {
            await serviceClient.from('staging_events_import').update({
              duplicate_check_status: 'confirmed_distinct',
              duplicate_check_reason: 'Marqué comme distinct par un administrateur',
              duplicate_check_at: new Date().toISOString(),
            }).eq('id', m.source_id);
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 3. Scan ciblé ---
    const scanParsed = ScanSchema.safeParse(body);
    if (!scanParsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid payload', details: scanParsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await serviceClient.rpc('scan_event_duplicates', {
      p_kind: scanParsed.data.kind,
      p_id: scanParsed.data.id,
      p_persist: true,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, candidates: data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[events-duplicate-scan] error', err);
    return new Response(JSON.stringify({ error: String((err as Error).message ?? err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});