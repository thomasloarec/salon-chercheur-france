import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";
import { renderEmailShell, heading as renderHeading, paragraph, dataTable } from "../_shared/email-template.ts";

// Frontend schema — two mutually exclusive shapes.
// Form A (historical): anchored on a novelty. Behavior UNCHANGED.
// Form B (new): anchored on (exhibitor, event), meeting request only.
const baseFields = {
  lead_type: z.enum(['brochure_download', 'meeting_request']),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
};

const schema = z.union([
  z.object({ ...baseFields, novelty_id: z.string().uuid() }),
  z.object({
    ...baseFields,
    exhibitor_ref: z.string().min(1), // UUID exhibitors.id OR legacy id_exposant
    event_id: z.string().uuid(),
    lead_type: z.literal('meeting_request'),
  }),
]);

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

type ContactFields = {
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  notes?: string;
};

/**
 * Shared notification + email block, used by BOTH anchors:
 *  - novelty anchor (form A): noveltyId present, orphan admin fallback enabled
 *  - exhibitor/event anchor (form B): noveltyId null, no orphan fallback
 *    (the RPC already guarantees an active manager exists)
 */
async function notifyLeadRecipients(opts: {
  admin: any;
  supabaseUrl: string;
  serviceKey: string;
  leadId: string;
  data: ContactFields;
  isMeeting: boolean;
  exhibitorId: string;
  eventId: string | null;
  noveltyId: string | null;
  noveltyTitle: string | null;
  displayName?: string | null;
}) {
  const { admin, supabaseUrl, serviceKey, leadId, data, isMeeting, exhibitorId, eventId, noveltyId, noveltyTitle } = opts;
  const notifType = isMeeting ? 'new_lead_rdv' : 'new_lead_brochure';
  const logTag = isMeeting ? 'rdv' : 'brochure';
  const isExhibitorAnchor = noveltyId === null;

  try {
    const { data: members } = await admin
      .from('exhibitor_team_members')
      .select('user_id')
      .eq('exhibitor_id', exhibitorId)
      .eq('status', 'active');

    const recipientIds = (members ?? []).map((m: any) => m.user_id).filter(Boolean);

    if (recipientIds.length === 0) {
      if (isExhibitorAnchor) {
        // Should be impossible: resolve_meeting_target requires an active manager.
        console.error('[rdv_exhibitor_no_recipient]', { exhibitor_id: exhibitorId, event_id: eventId, lead_id: leadId });
        return;
      }

      console.warn(`[${logTag}_notification_sent] no active team members`, {
        novelty_id: noveltyId, exhibitor_id: exhibitorId,
      });

      // ORPHAN FALLBACK — the exhibitor profile is NOT claimed (no active
      // team member to notify). Send a single admin email so the lead is
      // not lost. NEVER let an email failure break lead creation.
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (!resendKey) {
          console.warn(`[${logTag}_admin_fallback_email] missing RESEND_API_KEY — admin email skipped`, {
            novelty_id: noveltyId, lead_id: leadId,
          });
        } else {
          const adminEmail = Deno.env.get('ADMIN_LEADS_EMAIL') ?? 'admin@lotexpo.com';

          const { data: event } = eventId
            ? await admin.from('events').select('nom_event, slug').eq('id', eventId).maybeSingle()
            : { data: null } as any;

          let exhibitorName = '';
          try {
            const { data: exh } = await admin
              .from('exhibitors')
              .select('name')
              .eq('id', exhibitorId)
              .maybeSingle();
            exhibitorName = (exh?.name || '').trim();
          } catch (e) {
            console.error(`[${logTag}_admin_fallback_email] exhibitor lookup failed`, { exhibitor_id: exhibitorId, error: String(e) });
          }

          const actorName = `${data.first_name} ${data.last_name}`.trim();
          const eventName = event?.nom_event ?? '';
          const leadTypeLabel = isMeeting ? 'Demande de rendez-vous' : 'Téléchargement brochure';
          const subject = isMeeting
            ? '[Lead orphelin] Demande de rendez-vous — fiche non revendiquée'
            : '[Lead orphelin] Téléchargement de brochure — fiche non revendiquée';

          const html = renderEmailShell({
            title: subject,
            preheader: `Un lead a été généré sur une fiche exposant non revendiquée.`,
            bodyBlocks: [
              renderHeading(`🛟 Lead orphelin — ${escapeHtml(leadTypeLabel)}`),
              paragraph(`Un nouveau lead a été généré sur Lotexpo, mais la fiche exposant concernée n'est pas encore revendiquée : aucun membre d'équipe actif n'a été prévenu. Ce message admin garantit que le lead n'est pas perdu.`),
              dataTable([
                [`Type de lead`, leadTypeLabel],
                [`Nouveauté`, noveltyTitle ?? ''],
                [`Exposant`, exhibitorName || `(nom indisponible)`],
                [`Salon`, eventName || `(non renseigné)`],
              ] as Array<[string, string]>),
              dataTable([
                [`Contact`, actorName],
                [`Email`, data.email],
                ...(data.company ? [[`Société`, data.company]] : []),
                ...(data.role ? [[`Fonction`, data.role]] : []),
                ...(data.phone ? [[`Téléphone`, data.phone]] : []),
                ...(data.notes ? [[`Message`, data.notes]] : []),
              ] as Array<[string, string]>),
            ],
            footer: { extraHtml: `Email automatique : fiche exposant non revendiquée, aucun destinataire d'équipe disponible.` },
          });

          try {
            const { id: emailId } = await sendResendEmail({ to: [adminEmail], subject, html });
            console.log(`[${logTag}_admin_fallback_email]`, { novelty_id: noveltyId, lead_id: leadId, to: adminEmail, actor_email: data.email, email_id: emailId });
          } catch (e) {
            console.error(`[${logTag}_admin_fallback_email] exception`, { novelty_id: noveltyId, lead_id: leadId, error: String(e) });
          }
        }
      } catch (e) {
        console.error(`[${logTag}_admin_fallback_email] outer exception`, { novelty_id: noveltyId, lead_id: leadId, error: String(e) });
      }
      return;
    }

    // Resolve event name (best-effort)
    const { data: event } = eventId
      ? await admin.from('events').select('nom_event, slug').eq('id', eventId).maybeSingle()
      : { data: null } as any;

    // Resolve recipient emails via auth admin
    const recipientEmails: { user_id: string; email: string }[] = [];
    for (const uid of recipientIds) {
      try {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) recipientEmails.push({ user_id: uid, email: u.user.email });
      } catch (e) {
        console.error(`[${logTag}_notification_sent] getUserById failed`, { recipient_user_id: uid, error: String(e) });
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
            type: notifType,
            user_id: uid,
            novelty_id: noveltyId ?? null,
            exhibitor_id: exhibitorId,
            event_id: eventId,
            lead_id: leadId,
            actor_name: actorName,
            actor_email: data.email,
            actor_company: data.company || undefined,
          }),
        });
        if (!r.ok) {
          console.error(`[${logTag}_notification_sent] create failed`, { recipient_user_id: uid, novelty_id: noveltyId, lead_id: leadId, status: r.status });
        } else {
          console.log(`[${logTag}_notification_sent]`, { recipient_user_id: uid, novelty_id: noveltyId, lead_id: leadId, actor_email: data.email });
        }
      } catch (e) {
        console.error(`[${logTag}_notification_sent] exception`, { recipient_user_id: uid, novelty_id: noveltyId, error: String(e) });
      }
    }));

    // 2) Resend email
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (recipientEmails.length === 0) {
      console.warn(`[${logTag}_email_sent] no recipient emails resolved`, { novelty_id: noveltyId, lead_id: leadId });
    } else if (!resendKey) {
      console.warn(`[${logTag}_email_sent] missing RESEND_API_KEY — email skipped`, { novelty_id: noveltyId, lead_id: leadId });
    } else {
      const eventName = event?.nom_event ?? '';
      const title = noveltyTitle ?? '';

      let subject: string;
      let heading: string;
      let intro: string;
      let ctaUrl: string;
      let preheader: string;

      if (isExhibitorAnchor) {
        const company = (opts.displayName ?? '').trim();
        subject = 'Nouvelle demande de rendez-vous sur Lotexpo';
        heading = '📅 Nouvelle demande de rendez-vous';
        intro = `Un visiteur de Lotexpo souhaite prendre rendez-vous avec ${escapeHtml(company || 'votre entreprise')}${eventName ? ` sur le salon ${escapeHtml(eventName)}` : ''}.`;
        ctaUrl = 'https://lotexpo.com/agenda?tab=exposant&section=rendezvous';
        preheader = `Nouvelle demande de rendez-vous sur votre salon.`;
      } else {
        subject = isMeeting
          ? 'Nouveau lead : demande de rendez-vous sur Lotexpo'
          : 'Nouveau lead : téléchargement de brochure sur Lotexpo';
        heading = isMeeting ? '📅 Nouvelle demande de rendez-vous' : '🎯 Nouveau lead sur votre nouveauté';
        intro = isMeeting
          ? `Un visiteur de Lotexpo souhaite prendre rendez-vous au sujet de votre nouveauté${title ? ` ${escapeHtml(title)}` : ''}${eventName ? ` (événement ${escapeHtml(eventName)})` : ''}.`
          : `Un visiteur de Lotexpo vient de télécharger la brochure de votre nouveauté${title ? ` ${escapeHtml(title)}` : ''}${eventName ? ` (événement ${escapeHtml(eventName)})` : ''}.`;
        ctaUrl = 'https://lotexpo.com/agenda?tab=exposant&section=novelties&id=' + noveltyId + '#leads';
        preheader = isMeeting ? `Nouvelle demande de rendez-vous sur votre nouveauté.` : `Un visiteur a téléchargé la brochure de votre nouveauté.`;
      }

      const html = renderEmailShell({
        title: subject,
        preheader,
        bodyBlocks: [
          renderHeading(heading),
          paragraph(`Bonjour,`),
          paragraph(intro),
          dataTable([
            [`Nom`, actorName],
            [`Email`, data.email],
            ...(data.company ? [[`Société`, data.company]] : []),
            ...(isExhibitorAnchor && eventName ? [[`Salon`, eventName]] : []),
            ...(isMeeting && data.notes ? [[`Message`, data.notes]] : []),
          ] as Array<[string, string]>),
        ],
        cta: { label: `Consulter le lead sur Lotexpo`, href: ctaUrl },
        footer: { extraHtml: `Cet email vous est envoyé car vous êtes membre actif de l'équipe exposant sur Lotexpo.` },
      });

      try {
        const { id: emailId } = await sendResendEmail({
          to: recipientEmails.map(r => r.email),
          subject,
          html,
        });
        console.log(`[${logTag}_email_sent]`, { novelty_id: noveltyId, lead_id: leadId, to: recipientEmails.map(r => r.email), actor_email: data.email, email_id: emailId });
      } catch (e) {
        console.error(`[${logTag}_email_sent] exception`, { novelty_id: noveltyId, lead_id: leadId, error: String(e) });
      }
    }
  } catch (e) {
    console.error(`[${logTag}_notification_sent] outer exception`, { novelty_id: noveltyId, error: String(e) });
  }
}

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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = parsed.data as any;
    const admin = createClient(supabaseUrl, serviceKey);

    // Optional visitor identity. Never required: the brochure form is open to
    // anonymous visitors by design. We enrich leads.user_id only when a valid
    // token is present.
    let authUserId: string | null = null;
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length);
        // Reuse the admin client just to decode the token; do not create an
        // anon-scoped client that would fail on missing env.
        const { data: userData, error: userErr } = await admin.auth.getUser(token);
        if (!userErr && userData?.user?.id) {
          authUserId = userData.user.id;
        }
      }
    } catch (_e) {
      // Anonymous or invalid token → stay anonymous, never block the lead.
      authUserId = null;
    }

    // ======================================================================
    // FORM B — meeting request anchored on (exhibitor, event)
    // ======================================================================
    if (!('novelty_id' in data)) {
      const { data: targetRows, error: targetError } = await admin
        .rpc('resolve_meeting_target', {
          p_exhibitor_ref: data.exhibitor_ref,
          p_event_id: data.event_id,
        });
      const target = Array.isArray(targetRows) ? targetRows[0] : targetRows;

      if (targetError || !target) {
        console.error('[rdv_exhibitor_eligibility_error]', { exhibitor_ref: data.exhibitor_ref, event_id: data.event_id, error: targetError?.message });
        return new Response(
          JSON.stringify({ error: 'eligibility_check_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (target.eligible !== true) {
        console.warn('[rdv_exhibitor_refused]', { exhibitor_ref: data.exhibitor_ref, event_id: data.event_id, reason: target.reason });
        return new Response(
          JSON.stringify({ error: 'not_eligible', reason: target.reason }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // exhibitor_id ALWAYS comes from the RPC, never from the client payload.
      const exhibitorId: string = target.exhibitor_id;

      const { data: existingLead } = await admin
        .from('leads')
        .select('id')
        .is('novelty_id', null)
        .eq('exhibitor_id', exhibitorId)
        .eq('event_id', data.event_id)
        .ilike('email', data.email)
        .maybeSingle();

      if (existingLead) {
        console.log('[rdv_exhibitor_duplicate_detected]', { exhibitor_id: exhibitorId, event_id: data.event_id, actor_email: data.email, existing_id: existingLead.id });
        return new Response(
          JSON.stringify({ success: true, duplicate: true, lead_id: existingLead.id, message: 'Meeting request already exists' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: lead, error: leadError } = await admin
        .from('leads')
        .insert([{
          novelty_id: null,
          exhibitor_id: exhibitorId,
          event_id: data.event_id,
          lead_type: 'meeting_request',
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          company: data.company || null,
          role: data.role || null,
          phone: data.phone || null,
          notes: data.notes || null,
          user_id: authUserId,
        }])
        .select()
        .single();

      if (leadError) {
        // Race on the partial unique index → treat as duplicate, not a 500.
        if ((leadError as any).code === '23505') {
          const { data: raced } = await admin
            .from('leads')
            .select('id')
            .is('novelty_id', null)
            .eq('exhibitor_id', exhibitorId)
            .eq('event_id', data.event_id)
            .ilike('email', data.email)
            .maybeSingle();
          console.log('[rdv_exhibitor_duplicate_detected] unique violation', { exhibitor_id: exhibitorId, event_id: data.event_id });
          return new Response(
            JSON.stringify({ success: true, duplicate: true, lead_id: raced?.id ?? null, message: 'Meeting request already exists' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('Lead creation error:', leadError);
        return new Response(
          JSON.stringify({ error: "Failed to create lead", details: leadError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[rdv_exhibitor_lead_created]', { exhibitor_id: exhibitorId, event_id: data.event_id, lead_id: lead.id, actor_email: data.email });

      await notifyLeadRecipients({
        admin, supabaseUrl, serviceKey,
        leadId: lead.id,
        data,
        isMeeting: true,
        exhibitorId,
        eventId: data.event_id,
        noveltyId: null,
        noveltyTitle: null,
        displayName: target.display_name,
      });

      return new Response(
        JSON.stringify({ success: true, duplicate: false, lead_id: lead.id, message: 'Meeting request created' }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ======================================================================
    // FORM A — novelty-anchored lead (unchanged behavior)
    // ======================================================================
    const dbLeadType = leadTypeMapping[data.lead_type as keyof typeof leadTypeMapping];

    // Verify novelty exists and get brochure URL
    const { data: novelty, error: noveltyError } = await admin
      .from('novelties')
      .select('id, title, doc_url, exhibitor_id, event_id')
      .eq('id', data.novelty_id)
      .single();

    if (noveltyError || !novelty) {
      return new Response(
        JSON.stringify({ error: "Novelty not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For brochure downloads, verify doc_url exists
    if (data.lead_type === 'brochure_download' && !novelty.doc_url) {
      return new Response(
        JSON.stringify({ error: "No brochure available for this novelty" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      if (data.lead_type === 'brochure_download' && novelty.doc_url) {
        duplicateResponse.download_url = novelty.doc_url;
      }

      return new Response(
        JSON.stringify(duplicateResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve exhibitor_id / event_id from the novelty so the SELECT policy
    // is_team_member(exhibitor_id) can match the whole exhibitor team.
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
        user_id: authUserId,
      }])
      .select()
      .single();

    if (leadError) {
      console.error('Lead creation error:', leadError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: leadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    if (data.lead_type === 'brochure_download' && novelty.doc_url) {
      response.download_url = novelty.doc_url;
    }

    // Fire notifications + email — ONLY on real creation (not duplicate).
    if (novelty.exhibitor_id) {
      await notifyLeadRecipients({
        admin, supabaseUrl, serviceKey,
        leadId: lead.id,
        data,
        isMeeting: data.lead_type === 'meeting_request',
        exhibitorId: novelty.exhibitor_id,
        eventId: novelty.event_id ?? null,
        noveltyId: data.novelty_id,
        noveltyTitle: novelty.title ?? null,
      });
    } else {
      const logTag = data.lead_type === 'meeting_request' ? 'rdv' : 'brochure';
      console.warn(`[${logTag}_notification_sent] novelty has no exhibitor_id, skipping notifications`, { novelty_id: data.novelty_id });
    }

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
