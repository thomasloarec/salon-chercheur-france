import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

// Frontend schema
const schema = z.object({
  novelty_id: z.string().uuid(),
  lead_type: z.enum(['brochure_download', 'meeting_request']),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

// Map frontend types to database types
const leadTypeMapping = {
  'brochure_download': 'resource_download',
  'meeting_request': 'meeting_request'
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
        { status: 422, headers: corsHeaders }
      );
    }

    const data = parsed.data;
    const admin = createClient(supabaseUrl, serviceKey);

    // Map frontend type to database type
    const dbLeadType = leadTypeMapping[data.lead_type];

    // Verify novelty exists and get brochure URL
    const { data: novelty, error: noveltyError } = await admin
      .from('novelties')
      .select('id, title, doc_url, exhibitor_id, event_id')
      .eq('id', data.novelty_id)
      .single();

    if (noveltyError || !novelty) {
      return new Response(
        JSON.stringify({ error: "Novelty not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // For brochure downloads, verify doc_url exists
    if (data.lead_type === 'brochure_download' && !novelty.doc_url) {
      return new Response(
        JSON.stringify({ error: "No brochure available for this novelty" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Deduplication check: case-insensitive email matching
    const { data: existingLead, error: dedupError } = await admin
      .from('leads')
      .select('id')
      .eq('novelty_id', data.novelty_id)
      .ilike('email', data.email)
      .maybeSingle();

    if (dedupError) {
      console.error('Deduplication check error:', dedupError);
    }

    if (existingLead) {
      console.log('[brochure_duplicate_detected]', { 
        novelty_id: data.novelty_id, 
        actor_email: data.email, 
        existing_id: existingLead.id 
      });
      
      const duplicateResponse: { 
        success: boolean; 
        duplicate: boolean; 
        lead_id: string; 
        message: string;
        download_url?: string;
      } = {
        success: true,
        duplicate: true,
        lead_id: existingLead.id,
        message: 'Lead already exists'
      };

      // Still provide download URL if brochure request
      if (data.lead_type === 'brochure_download' && novelty.doc_url) {
        duplicateResponse.download_url = novelty.doc_url;
      }

      return new Response(
        JSON.stringify(duplicateResponse),
        { status: 200, headers: corsHeaders }
      );
    }

    // Resolve exhibitor_id / event_id from the novelty so the SELECT policy
    // is_team_member(exhibitor_id) can match the whole exhibitor team — not
    // only the novelty creator. Never block lead creation if they are absent.
    if (!novelty.exhibitor_id || !novelty.event_id) {
      console.warn('[lead_attribution_missing]', {
        novelty_id: data.novelty_id,
        exhibitor_id: novelty.exhibitor_id ?? null,
        event_id: novelty.event_id ?? null,
      });
    }

    // Create lead with mapped type
    const { data: lead, error: leadError } = await admin
      .from('leads')
      .insert([{
        novelty_id: data.novelty_id,
        exhibitor_id: novelty.exhibitor_id ?? null,
        event_id: novelty.event_id ?? null,
        lead_type: dbLeadType,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        company: data.company || null,
        role: data.role || null,
        phone: data.phone || null,
        notes: data.notes || null,
      }])
      .select()
      .single();

    if (leadError) {
      console.error('Lead creation error:', leadError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: leadError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('[brochure_lead_created]', {
      novelty_id: data.novelty_id,
      lead_id: lead.id,
      lead_type: dbLeadType,
      actor_email: data.email,
    });

    const response: { 
      success: boolean; 
      duplicate: boolean;
      lead_id: any; 
      message: string; 
      download_url?: string;
    } = { 
      success: true,
      duplicate: false,
      lead_id: lead.id,
      message: data.lead_type === 'brochure_download' ? 'Brochure download recorded' : 'Meeting request created'
    };

    // Include download URL for brochure requests
    if (data.lead_type === 'brochure_download' && novelty.doc_url) {
      response.download_url = novelty.doc_url;
    }

    // Fire notifications + email — ONLY on real creation (not duplicate) and ONLY for brochure
    if (data.lead_type === 'brochure_download' && novelty.exhibitor_id) {
      try {
        const { data: members } = await admin
          .from('exhibitor_team_members')
          .select('user_id')
          .eq('exhibitor_id', novelty.exhibitor_id)
          .eq('status', 'active');

        const recipientIds = (members ?? []).map((m: any) => m.user_id).filter(Boolean);

        if (recipientIds.length === 0) {
          console.warn('[brochure_notification_sent] no active team members', {
            novelty_id: data.novelty_id, exhibitor_id: novelty.exhibitor_id,
          });
        } else {
          // Resolve event name (best-effort)
          const { data: event } = novelty.event_id
            ? await admin.from('events').select('nom_event, slug').eq('id', novelty.event_id).maybeSingle()
            : { data: null } as any;

          // Resolve recipient emails via auth admin
          const recipientEmails: { user_id: string; email: string }[] = [];
          for (const uid of recipientIds) {
            try {
              const { data: u } = await admin.auth.admin.getUserById(uid);
              if (u?.user?.email) recipientEmails.push({ user_id: uid, email: u.user.email });
            } catch (e) {
              console.error('[brochure_notification_sent] getUserById failed', { recipient_user_id: uid, error: String(e) });
            }
          }

          const actorName = `${data.first_name} ${data.last_name}`.trim();

          // 1) In-app notifications
          const notifUrl = `${supabaseUrl}/functions/v1/notifications-create`;
          await Promise.all(recipientIds.map(async (uid: string) => {
            try {
              const r = await fetch(notifUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  type: 'new_lead_brochure',
                  user_id: uid,
                  novelty_id: data.novelty_id,
                  exhibitor_id: novelty.exhibitor_id,
                  event_id: novelty.event_id,
                  lead_id: lead.id,
                  actor_name: actorName,
                  actor_email: data.email,
                  actor_company: data.company || undefined,
                }),
              });
              if (!r.ok) {
                console.error('[brochure_notification_sent] create failed', { recipient_user_id: uid, novelty_id: data.novelty_id, lead_id: lead.id, status: r.status });
              } else {
                console.log('[brochure_notification_sent]', { recipient_user_id: uid, novelty_id: data.novelty_id, lead_id: lead.id, actor_email: data.email });
              }
            } catch (e) {
              console.error('[brochure_notification_sent] exception', { recipient_user_id: uid, novelty_id: data.novelty_id, error: String(e) });
            }
          }));

          // 2) Resend email — only for brochure
          const resendKey = Deno.env.get('RESEND_API_KEY');
          const lovableKey = Deno.env.get('LOVABLE_API_KEY');
          if (recipientEmails.length === 0) {
            console.warn('[brochure_email_sent] no recipient emails resolved', { novelty_id: data.novelty_id, lead_id: lead.id });
          } else if (!resendKey || !lovableKey) {
            console.warn('[brochure_email_sent] missing RESEND_API_KEY or LOVABLE_API_KEY — email skipped', { novelty_id: data.novelty_id, lead_id: lead.id });
          } else {
            const eventName = event?.nom_event ?? '';
            const noveltyTitle = novelty.title ?? '';
            const leadCompany = data.company ? `<p><strong>Société :</strong> ${escapeHtml(data.company)}</p>` : '';
            const ctaUrl = 'https://lotexpo.com/agenda?tab=exposant&section=novelties&id=' + data.novelty_id + '#leads';
            const html = `
              <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;color:#111">
                <h2 style="color:#111">🎯 Nouveau lead sur votre nouveauté</h2>
                <p>Bonjour,</p>
                <p>Un visiteur de Lotexpo vient de télécharger la brochure de votre nouveauté${noveltyTitle ? ` <strong>${escapeHtml(noveltyTitle)}</strong>` : ''}${eventName ? ` (événement <strong>${escapeHtml(eventName)}</strong>)` : ''}.</p>
                <div style="background:#f6f6f8;border-radius:8px;padding:16px;margin:16px 0">
                  <p style="margin:0 0 6px"><strong>Nom :</strong> ${escapeHtml(actorName)}</p>
                  <p style="margin:0 0 6px"><strong>Email :</strong> ${escapeHtml(data.email)}</p>
                  ${leadCompany}
                </div>
                <p>
                  <a href="${ctaUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">Consulter le lead sur Lotexpo</a>
                </p>
                <p style="font-size:12px;color:#666;margin-top:24px">Cet email vous est envoyé car vous êtes membre actif de l'équipe exposant sur Lotexpo.</p>
              </div>`;
            try {
              const resp = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${lovableKey}`,
                  'X-Connection-Api-Key': resendKey,
                },
                body: JSON.stringify({
                  from: 'Lotexpo <admin@lotexpo.com>',
                  to: recipientEmails.map(r => r.email),
                  subject: 'Nouveau lead : téléchargement de brochure sur Lotexpo',
                  html,
                }),
              });
              if (!resp.ok) {
                const t = await resp.text().catch(() => '');
                console.error('[brochure_email_sent] resend failed', { novelty_id: data.novelty_id, lead_id: lead.id, status: resp.status, body: t.slice(0, 300) });
              } else {
                console.log('[brochure_email_sent]', { novelty_id: data.novelty_id, lead_id: lead.id, to: recipientEmails.map(r => r.email), actor_email: data.email });
              }
            } catch (e) {
              console.error('[brochure_email_sent] exception', { novelty_id: data.novelty_id, lead_id: lead.id, error: String(e) });
            }
          }
        }
      } catch (e) {
        console.error('[brochure_notification_sent] outer exception', { novelty_id: data.novelty_id, error: String(e) });
      }
    } else if (data.lead_type === 'brochure_download') {
      console.warn('[brochure_notification_sent] novelty has no exhibitor_id, skipping notifications', { novelty_id: data.novelty_id });
    }

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}