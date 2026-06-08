import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STOP_REASONS = [
  'email_not_found',
  'not_attending_event',
  'not_interested',
  'do_not_contact',
  'irrelevant_contact',
  'handled_offline',
  'other',
] as const

const TERMINAL_BLACKLIST_REASONS = new Set(['email_not_found', 'do_not_contact'])

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('stop'),
    campaign_id: z.string().uuid(),
    reason: z.enum(STOP_REASONS),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal('blacklist_email'),
    email: z.string().email().max(320),
    note: z.string().max(2000).optional().nullable(),
    reason: z.enum(['invalid_address', 'opt_out_global', 'manual']).optional(),
  }),
  z.object({
    action: z.literal('unblacklist_email'),
    email: z.string().email().max(320),
  }),
])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // authClient -> verify identity
    const authClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userData.user.id

    // serviceClient -> bypass RLS
    const serviceClient = createClient(SUPABASE_URL, SERVICE)

    // admin gate via has_role
    const { data: isAdmin } = await serviceClient.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (!isAdmin) return json({ error: 'Forbidden' }, 403)

    const raw = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(raw)
    if (!parsed.success) {
      return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }
    const body = parsed.data

    if (body.action === 'stop') {
      // Map stop_reason -> terminal campaign_status when applicable
      let campaign_status = 'stopped'
      if (body.reason === 'email_not_found') campaign_status = 'blocked_invalid_email'
      else if (body.reason === 'do_not_contact') campaign_status = 'opted_out'

      const { error } = await serviceClient
        .from('outreach_campaigns')
        .update({
          campaign_status,
          stop_reason: body.reason,
          stop_note: body.note ?? null,
          stopped_at: new Date().toISOString(),
          stopped_by: userId,
          next_send_at: null,
          opt_out: body.reason === 'do_not_contact' ? true : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.campaign_id)

      if (error) return json({ error: error.message }, 500)
      // Trigger auto_blacklist_on_campaign_stop will handle blacklist insert
      return json({ ok: true, campaign_status })
    }

    if (body.action === 'blacklist_email') {
      const reason = body.reason ?? 'manual'
      const { error } = await serviceClient
        .from('email_blacklist')
        .upsert(
          {
            email_normalized: body.email.toLowerCase().trim(),
            reason,
            source: 'admin_manual',
            note: body.note ?? null,
            created_by: userId,
          },
          { onConflict: 'email_normalized' },
        )
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (body.action === 'unblacklist_email') {
      const { error } = await serviceClient
        .from('email_blacklist')
        .delete()
        .eq('email_normalized', body.email.toLowerCase().trim())
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('outreach-campaign-action error', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}