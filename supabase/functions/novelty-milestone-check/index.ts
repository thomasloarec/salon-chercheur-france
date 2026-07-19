import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";
import { renderEmailShell, heading, paragraph } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- Milestone logic (centralized) ------------------------------------------
const MILESTONES = [2, 5, 10, 20];
const EMAIL_MIN_THRESHOLD = 5; // in-app dès le palier 2, email seulement à partir de 5
function highestThreshold(n: number): number | null {
  if (n < 2) return null;
  if (n < 5) return 2;
  if (n < 10) return 5;
  if (n < 20) return 10;
  return Math.floor(n / 10) * 10; // 20, 30, 40, ... (tout multiple de 10 au-delà)
}

/**
 * Constant-time comparison to validate the service-role bearer token.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  if (!serviceKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ---- Authorization gate: service-role only --------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || !timingSafeEqual(token, serviceKey)) {
    console.warn("novelty-milestone-check: unauthorized call rejected");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { novelty_id } = await req.json();
    if (!novelty_id) {
      return new Response(
        JSON.stringify({ error: "novelty_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Fetch the novelty
    const { data: novelty, error: noveltyError } = await supabase
      .from("novelties")
      .select("id, created_by, exhibitor_id, event_id, title")
      .eq("id", novelty_id)
      .maybeSingle();

    if (noveltyError || !novelty) {
      return new Response(
        JSON.stringify({ error: "Novelty not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Count distinct visitors (excludes created_by + active members)
    const { data: countData, error: countError } = await supabase
      .rpc("count_novelty_distinct_visitors", { p_novelty_id: novelty_id });

    if (countError) {
      console.error("count_novelty_distinct_visitors failed", countError);
      throw countError;
    }
    const n = Number(countData ?? 0);

    // 3. Highest threshold crossed
    const threshold = highestThreshold(n);
    if (threshold === null) {
      return new Response(
        JSON.stringify({ ok: true, milestone: null, count: n }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Idempotent record of the milestone
    const { data: recorded, error: recordError } = await supabase
      .rpc("try_record_novelty_milestone", { p_novelty_id: novelty_id, p_threshold: threshold });

    if (recordError) {
      console.error("try_record_novelty_milestone failed", recordError);
      throw recordError;
    }

    if (recorded !== true) {
      // Milestone already recorded → never notify twice
      return new Response(
        JSON.stringify({ ok: true, milestone: threshold, alreadyNotified: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Best-effort from here: milestone is already locked in the DB --------
    try {
      // 5. Resolve recipients = all exhibitor admins, with fallback to created_by
      const adminSet = new Set<string>();

      if (novelty.exhibitor_id) {
        const { data: exhibitor } = await supabase
          .from("exhibitors")
          .select("owner_user_id")
          .eq("id", novelty.exhibitor_id)
          .maybeSingle();
        if (exhibitor?.owner_user_id) adminSet.add(exhibitor.owner_user_id);

        const { data: members } = await supabase
          .from("exhibitor_team_members")
          .select("user_id")
          .eq("exhibitor_id", novelty.exhibitor_id)
          .eq("status", "active")
          .in("role", ["owner", "admin"]);
        for (const m of members ?? []) {
          if (m.user_id) adminSet.add(m.user_id);
        }
      }

      let recipients: string[];
      if (adminSet.size > 0) {
        recipients = Array.from(adminSet);
      } else {
        // Fallback: never lose the signal
        recipients = novelty.created_by ? [novelty.created_by] : [];
      }
      // Dedup + remove null
      recipients = Array.from(new Set(recipients.filter(Boolean)));

      if (recipients.length === 0) {
        console.log("[milestone-check] no recipients; milestone stays locked", { novelty_id, threshold });
        return new Response(
          JSON.stringify({ ok: true, milestone: threshold, recipients: [], notified: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Resolve event name (optional)
      let nomEvent: string | null = null;
      if (novelty.event_id) {
        const { data: ev } = await supabase
          .from("events")
          .select("nom_event")
          .eq("id", novelty.event_id)
          .maybeSingle();
        nomEvent = ev?.nom_event ?? null;
      }

      const message = nomEvent
        ? `${threshold} personnes ont ajouté votre stand à leur visite de ${nomEvent}.`
        : `${threshold} personnes ont ajouté votre stand à leur visite.`;

      // Same link_url pattern as the `like` case in notifications-create
      const linkUrl = `/agenda?tab=exposant&section=novelties&id=${novelty_id}`;

      const rows = recipients.map((uid) => ({
        user_id: uid,
        type: "novelty_visit_milestone",
        category: "interaction",
        title: "Votre stand attire l'attention 👀",
        message,
        icon: "👀",
        novelty_id: novelty.id,
        exhibitor_id: novelty.exhibitor_id,
        event_id: novelty.event_id,
        link_url: linkUrl,
        created_at: new Date().toISOString(),
      }));

      // Direct INSERT (service role bypasses RLS; no grouping logic)
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(rows);

      if (insertError) {
        console.error("[milestone-check] notification insert failed (non-fatal)", insertError);
        return new Response(
          JSON.stringify({ ok: true, milestone: threshold, recipients, notified: 0, error: "insert_failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Mark milestone as notified (email left NULL → next deliverable)
      const { error: updateError } = await supabase
        .from("novelty_visit_milestones")
        .update({ notified_at: new Date().toISOString() })
        .eq("novelty_id", novelty_id)
        .eq("threshold", threshold);

      if (updateError) {
        console.error("[milestone-check] notified_at update failed (non-fatal)", updateError);
      }

      // ---- Email notification (best-effort) -------------------------------
      // In-app fires from threshold 2; email only from EMAIL_MIN_THRESHOLD (5).
      // The milestone is already locked via try_record_novelty_milestone, so
      // reaching this block means a brand-new milestone → no double send risk.
      if (threshold >= EMAIL_MIN_THRESHOLD) {
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (!resendKey) {
            console.warn("[milestone-check][email] missing RESEND_API_KEY — email skipped", { novelty_id, threshold });
          } else {
            // Resolve recipient emails via auth admin (same pattern as leads-create)
            const recipientEmails: string[] = [];
            for (const uid of recipients) {
              try {
                const { data: u } = await supabase.auth.admin.getUserById(uid);
                if (u?.user?.email) recipientEmails.push(u.user.email);
              } catch (e) {
                console.error("[milestone-check][email] getUserById failed", { recipient_user_id: uid, error: String(e) });
              }
            }

            if (recipientEmails.length === 0) {
              console.warn("[milestone-check][email] no recipient emails resolved", { novelty_id, threshold });
            } else {
              const noveltyTitle = novelty.title ?? "";
              const subject = nomEvent
                ? `👀 ${threshold} visiteurs veulent voir votre stand sur ${nomEvent}`
                : `👀 ${threshold} visiteurs veulent voir votre stand`;

              // Reuse the exact same link_url format as the in-app notifications,
              // prefixed with the public origin to make it clickable in email.
              const ctaUrl = `https://lotexpo.com${linkUrl}`;

              const html = renderEmailShell({
                title: subject,
                preheader: nomEvent ? `${threshold} visiteurs veulent voir votre stand sur ${nomEvent}.` : `${threshold} visiteurs veulent voir votre stand.`,
                bodyBlocks: [
                  heading(`👀 Votre stand attire l'attention`),
                  paragraph(`Bonjour,`),
                  paragraph(`<strong>${threshold} visiteurs</strong> ont déjà ajouté votre stand à leur parcours de visite${nomEvent ? ` sur <strong>${escapeHtml(nomEvent)}</strong>` : ""}.`),
                  paragraph(noveltyTitle ? `Votre nouveauté <strong>${escapeHtml(noveltyTitle)}</strong> suscite l'intérêt avant même l'ouverture du salon. C'est le moment de finaliser votre préparation !` : `Votre nouveauté suscite l'intérêt avant même l'ouverture du salon. C'est le moment de finaliser votre préparation !`),
                ],
                cta: { label: `Voir ma nouveauté sur Lotexpo`, href: ctaUrl },
                footer: { extraHtml: `Cet email vous est envoyé car vous êtes administrateur de cette fiche exposant sur Lotexpo.` },
              });

              // One send per recipient so co-administrators are never exposed to
              // each other in the To. Each send is best-effort.
              for (const email of recipientEmails) {
                try {
                  const { id: emailId } = await sendResendEmail({
                    to: [email],
                    subject,
                    html,
                  });
                  console.log("[milestone-check][email] sent", { novelty_id, threshold, to: email, email_id: emailId });
                } catch (e) {
                  console.error("[milestone-check][email] send exception (non-fatal)", { novelty_id, threshold, to: email, error: String(e) });
                }
              }

              // Audit/traçabilité: mark email_sent_at (no double send risk — milestone locked)
              const { error: emailUpdateError } = await supabase
                .from("novelty_visit_milestones")
                .update({ email_sent_at: new Date().toISOString() })
                .eq("novelty_id", novelty_id)
                .eq("threshold", threshold);
              if (emailUpdateError) {
                console.error("[milestone-check][email] email_sent_at update failed (non-fatal)", emailUpdateError);
              }
            }
          }
        } catch (e) {
          console.error("[milestone-check][email] outer exception (non-fatal)", { novelty_id, threshold, error: String(e) });
        }
      }

      console.log("[milestone-check] notified", { novelty_id, threshold, recipients, count: n });

      return new Response(
        JSON.stringify({ ok: true, milestone: threshold, recipients, notified: recipients.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      // Best-effort: milestone already locked; never fail fatally
      console.error("[milestone-check] post-record error (non-fatal)", e);
      return new Response(
        JSON.stringify({ ok: true, milestone: threshold, error: "post_record_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    console.error("Error in novelty-milestone-check:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}