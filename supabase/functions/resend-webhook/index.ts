import { createClient } from "jsr:@supabase/supabase-js@2";

// =====================================================================
// resend-webhook : recepteur des evenements Resend (Svix).
// Sur email.bounced (rebond dur) et email.complained (plainte spam),
// inscrit l'adresse dans email_blacklist et met a jour contact_status.
// La vue v_eligibles_revendication filtre deja NOT is_email_blacklisted,
// donc l'adresse est automatiquement exclue des envois suivants.
// Auth : verification de la signature Svix (pas de JWT Supabase).
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

const TOLERANCE_SECONDS = 300;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(id: string, timestamp: string, body: string, sigHeader: string): Promise<boolean> {
  if (!WEBHOOK_SECRET || !id || !timestamp || !sigHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  const secretKey = WEBHOOK_SECRET.startsWith("whsec_") ? WEBHOOK_SECRET.slice(6) : WEBHOOK_SECRET;
  let keyBytes: Uint8Array;
  try { keyBytes = b64ToBytes(secretKey); } catch { return false; }
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = `${id}.${timestamp}.${body}`;
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signed));
  const expected = bytesToB64(new Uint8Array(mac));
  const provided = sigHeader.split(" ").map((p) => (p.includes(",") ? p.split(",")[1] : p));
  return provided.some((p) => timingSafeEqual(p, expected));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WEBHOOK_SECRET) return new Response("Webhook secret not configured", { status: 500 });

  const body = await req.text();
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const sig = req.headers.get("svix-signature") ?? "";

  const ok = await verifySignature(id, timestamp, body, sig);
  if (!ok) return new Response("Invalid signature", { status: 401 });

  let evt: any;
  try { evt = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }

  const type = evt?.type as string | undefined;
  const map: Record<string, { reason: string; status: string }> = {
    "email.bounced": { reason: "bounce", status: "bounced" },
    "email.complained": { reason: "complaint", status: "complained" },
  };
  const action = type ? map[type] : undefined;
  if (!action) {
    return new Response(JSON.stringify({ ignored: type ?? "unknown" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const data = evt?.data ?? {};
  const rawRecipients: unknown[] = Array.isArray(data.to) ? data.to : (typeof data.to === "string" ? [data.to] : []);
  const recipients = rawRecipients.filter((e): e is string => typeof e === "string" && e.includes("@"));
  if (recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, note: "no recipient" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const note = `resend ${type} ${evt?.created_at ?? ""}`.trim();
  const results: Record<string, string> = {};

  for (const original of recipients) {
    const normalized = original.toLowerCase().trim();
    try {
      await supabase.from("email_blacklist").upsert(
        { email_normalized: normalized, source: "bounce", reason: action.reason, note },
        { onConflict: "email_normalized", ignoreDuplicates: true },
      );
      const candidates = Array.from(new Set([original, normalized]));
      await supabase.from("outreach_contacts")
        .update({ contact_status: action.status, updated_at: new Date().toISOString() })
        .in("contact_email", candidates);
      results[normalized] = "ok";
    } catch (e) {
      results[normalized] = "error";
      console.error("resend-webhook error for", normalized, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, type, results }), { status: 200, headers: { "Content-Type": "application/json" } });
});
