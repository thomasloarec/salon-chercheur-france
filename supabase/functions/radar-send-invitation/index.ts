// radar-send-invitation
//
// Sends a Radar CRM collaboration invitation. Called from the future
// "Collaboration" space with { account_id, email, role? }.
//
// Auth model (aligned with radar-mission-strategist):
//   - verify_jwt = false at the platform level; auth is enforced IN CODE via
//     getUser() on an ANON client that forwards the caller's Authorization
//     header. This makes auth.uid() resolve inside the SECURITY DEFINER RPC
//     `invite_radar_member`, whose owner gate rejects non-owners (403).
//   - NO service_role is used, so the owner guard is the single source of truth.
//
// Email: reuses the existing Resend config (RESEND_API_KEY, verified sender
// send.lotexpo.com) through the shared sendResendEmail helper. Sender is
// "Thomas Loarec <admin@lotexpo.com>". No new secret is created.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_EMAIL = "Thomas Loarec <admin@lotexpo.com>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["member", "admin", "owner"];

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

function appBaseUrl(): string {
  const raw = Deno.env.get("APP_BASE_URL") || "https://lotexpo.com";
  return raw.replace(/\/+$/, "");
}

// Map the RPC error message to a clean client-facing code + HTTP status.
// Never leaks the raw technical message.
function mapRpcError(rawMessage: string): { code: string; status: number } {
  const msg = (rawMessage || "").toLowerCase();
  if (msg.includes("forbidden") || msg.includes("not_owner") || msg.includes("not authorized")) {
    return { code: "forbidden", status: 403 };
  }
  if (msg.includes("already_member") || msg.includes("already a member")) {
    return { code: "already_member", status: 409 };
  }
  if (msg.includes("seats_limit_reached") || msg.includes("seat") && msg.includes("limit")) {
    return { code: "seats_limit_reached", status: 409 };
  }
  if (msg.includes("invalid_email")) {
    return { code: "invalid_email", status: 400 };
  }
  if (msg.includes("account_not_found") || msg.includes("not_found")) {
    return { code: "account_not_found", status: 404 };
  }
  return { code: "invitation_failed", status: 400 };
}

interface InvitePayload {
  invitation_id?: string;
  email?: string;
  role?: string;
  token?: string;
  expires_at?: string;
  status?: string;
}

function buildEmailHtml(opts: {
  acceptUrl: string;
  inviterName: string;
  spaceName: string;
}): string {
  const { acceptUrl, inviterName, spaceName } = opts;
  return `<!DOCTYPE html>
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
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#04316d;font-weight:700;">Invitation à collaborer</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#262626;">
                  <strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre l'espace
                  <strong>${escapeHtml(spaceName)}</strong> sur Radar CRM pour préparer et suivre vos visites salon en équipe.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:10px;background:#ff751f;">
                      <a href="${escapeHtml(acceptUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Accepter l'invitation</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#666666;">
                  Ou copiez ce lien dans votre navigateur :
                </p>
                <p style="margin:0 0 20px;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${escapeHtml(acceptUrl)}" style="color:#04316d;">${escapeHtml(acceptUrl)}</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#666666;">
                  Cette invitation expire dans <strong>14 jours</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#ffe8d9;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#666666;">
                  Vous recevez cet email car ${escapeHtml(inviterName)} vous a invité sur Lotexpo Radar CRM.
                  Si vous n'êtes pas concerné, ignorez ce message.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEmailText(opts: { acceptUrl: string; inviterName: string; spaceName: string }): string {
  return [
    `${opts.inviterName} vous invite à collaborer sur l'espace "${opts.spaceName}" (Radar CRM).`,
    ``,
    `Accepter l'invitation : ${opts.acceptUrl}`,
    ``,
    `Cette invitation expire dans 14 jours.`,
  ].join("\n");
}

// Best-effort resolution of the inviter display name and the space name.
// Never blocks the invite: falls back to the inviter's email if lookups fail.
async function resolveNames(
  supabase: ReturnType<typeof createClient>,
  fallbackEmail: string,
  accountId: string,
): Promise<{ inviterName: string; spaceName: string }> {
  let inviterName = fallbackEmail;
  let spaceName = "votre espace Radar CRM";
  try {
    const { data: team } = await supabase.rpc("get_my_radar_team");
    const t = team as any;
    if (t) {
      // Space name = org_name at the top of the get_my_radar_team envelope.
      if (typeof t.org_name === "string" && t.org_name.trim()) {
        spaceName = t.org_name.trim();
      }
      // Inviter name = display_name of the member where is_me === true.
      const members = Array.isArray(t.members) ? t.members : [];
      const me = members.find((m: any) => m?.is_me === true);
      const name = typeof me?.display_name === "string" ? me.display_name.trim() : "";
      if (name) inviterName = name;
    }
  } catch (_e) {
    // ignore — keep fallbacks
  }
  return { inviterName, spaceName };
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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 422);
    }

    const accountId = body?.account_id;
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const role = typeof body?.role === "string" && VALID_ROLES.includes(body.role) ? body.role : "member";

    if (typeof accountId !== "string" || !accountId) {
      return json({ ok: false, error: "invalid_body", detail: "account_id is required" }, 422);
    }
    if (!EMAIL_RE.test(email)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // User-JWT client: auth.uid() resolves inside invite_radar_member so its
    // owner gate applies. No service_role.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401);

    // 1) Create the invitation via the existing owner-gated RPC.
    const { data: rpcData, error: rpcErr } = await supabase.rpc("invite_radar_member", {
      p_account_id: accountId,
      p_email: email,
      p_role: role,
    });

    if (rpcErr) {
      const { code, status } = mapRpcError(rpcErr.message);
      console.error("[radar-send-invitation] rpc error:", code, "-", rpcErr.message);
      return json({ ok: false, error: code }, status);
    }

    const invite = (rpcData ?? {}) as InvitePayload;
    if (!invite.token || !invite.invitation_id) {
      console.error("[radar-send-invitation] RPC returned no token/invitation_id");
      return json({ ok: false, error: "invitation_failed" }, 400);
    }

    // 3) Build the acceptance link.
    const acceptUrl = `${appBaseUrl()}/radar/invitation?token=${encodeURIComponent(invite.token)}`;

    // 4) Resolve inviter + space name for personalization (best-effort).
    const { inviterName, spaceName } = await resolveNames(
      supabase,
      user.email ?? "Un membre",
      accountId,
    );

    // 5) Send the email (only reached because the RPC succeeded).
    try {
      await sendResendEmail({
        to: invite.email ?? email,
        from: FROM_EMAIL,
        subject: `${inviterName} vous invite à collaborer sur Radar CRM`,
        html: buildEmailHtml({ acceptUrl, inviterName, spaceName }),
        text: buildEmailText({ acceptUrl, inviterName, spaceName }),
        tags: [{ name: "type", value: "radar_invitation" }],
      });
    } catch (mailErr) {
      console.error("[radar-send-invitation] email send failed:", mailErr);
      // The invitation exists in DB; surface a clear partial-failure signal.
      return json({
        ok: false,
        error: "email_send_failed",
        invitation_id: invite.invitation_id,
      }, 502);
    }

    // 6) Success.
    return json({
      ok: true,
      invitation_id: invite.invitation_id,
      email: invite.email ?? email,
      expires_at: invite.expires_at ?? null,
    });
  } catch (e) {
    console.error("[radar-send-invitation] unexpected error:", e);
    return json({ ok: false, error: "internal_error" }, 500);
  }
});