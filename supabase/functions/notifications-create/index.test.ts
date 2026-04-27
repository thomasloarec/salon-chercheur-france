import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const FN_URL = `${SUPABASE_URL}/functions/v1/notifications-create`;

/**
 * notifications-create must reject every caller that does not present
 * the SERVICE_ROLE key. We verify three negative cases here. We do NOT
 * test the positive case (service-role key) from this client-side test
 * to avoid shipping or requiring that secret in CI.
 */

Deno.test("notifications-create rejects calls without Authorization header", async () => {
  if (!SUPABASE_URL) return; // skip in environments without supabase config
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "welcome", user_id: "00000000-0000-0000-0000-000000000000" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("notifications-create rejects calls with anon (publishable) key", async () => {
  if (!SUPABASE_URL || !ANON_KEY) return;
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ type: "welcome", user_id: "00000000-0000-0000-0000-000000000000" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("notifications-create rejects calls with arbitrary bearer token", async () => {
  if (!SUPABASE_URL) return;
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer not-a-valid-service-role-key",
    },
    body: JSON.stringify({ type: "welcome", user_id: "00000000-0000-0000-0000-000000000000" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});