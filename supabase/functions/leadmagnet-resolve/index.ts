// supabase/functions/leadmagnet-resolve/index.ts
//
// Lead Magnet V2 : etape de desambiguisation. Renvoie une liste de candidats
// (nom + domaine + description + presence salon) pour confirmation par l'utilisateur.
// Aucune resolution silencieuse. Meme garde-fou anti-abus IP que leadmagnet-search
// (hash sale a rotation quotidienne, non reversible ; compteurs namespaces 'leadmagnet:').
//
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const IP_LIMIT_PER_HOUR = 120;
const MAX_QUERY_LEN = 120;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "corps_invalide" }, 400); }
  const query = String(body?.query ?? "").trim().slice(0, MAX_QUERY_LEN);
  if (query.length < 2) return json({ error: "query_trop_courte" }, 400);
  const limit = Math.min(Math.max(parseInt(String(body?.limit ?? 5), 10) || 5, 1), 10);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  if (ip) {
    const daySalt = await sha256Hex((Deno.env.get("AI_RL_SALT") ?? "") + new Date().toISOString().slice(0, 10));
    const ipHash = await sha256Hex("leadmagnet:" + ip + daySalt);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from("ai_rate_limit_hits")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= IP_LIMIT_PER_HOUR) {
      return json({ error: "rate_limited", message: "Trop de recherches recentes. Reessayez dans un moment." }, 429);
    }
    await admin.from("ai_rate_limit_hits").insert({ ip_hash: ipHash });
  }

  const { data, error } = await admin.rpc("leadmagnet_resolve_candidates", {
    p_query: query,
    p_limit: limit,
  });
  if (error) return json({ error: "resolve_failed", detail: error.message }, 500);

  return json(data ?? {});
});
