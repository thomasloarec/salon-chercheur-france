// radar-notify-admin-new-member
//
// Notifies the site admin (admin@lotexpo.com) when a member JOINS a Radar CRM
// space (i.e. right after a successful `accept_radar_invitation`). Called once
// from the acceptance page (RadarInvitation.tsx).
//
// Auth model (aligned with radar-send-invitation):
//   - verify_jwt = false at the platform level; auth is enforced IN CODE via
//     getUser() on an ANON client that forwards the caller's Authorization
//     header. This makes auth.uid() resolve inside get_my_radar_team().
//   - NO service_role is used.
//
// Best-effort: always returns 200 (even if the email fails), so it never
// blocks the join flow / redirection on the client. No sensitive data in clear.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_EMAIL = "Lotexpo <admin@lotexpo.com>";
const ADMIN_EMAIL = "admin@lotexpo.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "missing_authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // User-JWT client: auth.uid() resolves inside get_my_radar_team(). No service_role.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401);

    // Resolve the joined space context (the caller's active account) via the
    // existing RPC. Best-effort: fall back to sensible defaults on any gap.
    let orgName = "";
    let memberCount = 0;
    let displayName = user.email ?? "Un membre";
    const memberEmail = user.email ?? "";

    try {
      const { data: team } = await supabase.rpc("get_my_radar_team");
      const t = team as any;
      if (t) {
        if (typeof t.org_name === "string" && t.org_name.trim()) {
          orgName = t.org_name.trim();
        }
        if (typeof t.active_member_count === "number") {
          memberCount = t.active_member_count;
        }
        const members = Array.isArray(t.members) ? t.members : [];
        const me = members.find((m: any) => m?.is_me === true);
        const name = typeof me?.display_name === "string" ? me.display_name.trim() : "";
        if (name) displayName = name;
      }
    } catch (_e) {
      // ignore — keep fallbacks
    }

    const spaceLabel = orgName || "un espace Radar CRM";
    const subject = `Nouveau membre sur ${orgName || "un espace Radar CRM"}`;

    const text = [
      `${displayName} (${memberEmail}) a rejoint l'espace ${spaceLabel}.`,
      `L'espace compte maintenant ${memberCount} membres.`,
    ].join("\n");

    const html = `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#262626;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ffe8d9;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#04316d;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Radar CRM</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#04316d;font-weight:700;">Nouveau membre</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#262626;">
                  <strong>${escapeHtml(displayName)}</strong> (${escapeHtml(memberEmail)}) a rejoint l'espace
                  <strong>${escapeHtml(spaceLabel)}</strong>.
                </p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#262626;">
                  L'espace compte maintenant <strong>${escapeHtml(String(memberCount))}</strong> membres.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    // Best-effort send: never block the join flow.
    try {
      await sendResendEmail({
        to: ADMIN_EMAIL,
        from: FROM_EMAIL,
        subject,
        html,
        text,
        tags: [{ name: "type", value: "radar_new_member" }],
      });
    } catch (mailErr) {
      console.error("[radar-notify-admin-new-member] email send failed:", mailErr);
      // Best-effort: still return 200.
      return json({ ok: true, notified: false });
    }

    return json({ ok: true, notified: true });
  } catch (e) {
    console.error("[radar-notify-admin-new-member] unexpected error:", e);
    // Best-effort: never surface a blocking error.
    return json({ ok: true, notified: false });
  }
});