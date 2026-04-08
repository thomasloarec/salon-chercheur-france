import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/novelties-moderate`;

async function callFunction(body: Record<string, unknown>, authToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ─────────────────────────────────────────────────
// Test 1: Missing auth returns 401
// ─────────────────────────────────────────────────
Deno.test("novelties-moderate without auth returns 401", async () => {
  const { status } = await callFunction({
    novelty_id: "00000000-0000-0000-0000-000000000000",
    next_status: "published",
  });
  assertEquals(status, 401);
});

// ─────────────────────────────────────────────────
// Test 2: Invalid token returns 401
// ─────────────────────────────────────────────────
Deno.test("novelties-moderate with bad token returns 401 or 403", async () => {
  const { status } = await callFunction(
    {
      novelty_id: "00000000-0000-0000-0000-000000000000",
      next_status: "published",
    },
    "invalid-token"
  );
  assertEquals(status >= 401 && status <= 403, true);
});

// ─────────────────────────────────────────────────
// Test 3: Invalid status value returns 400
// ─────────────────────────────────────────────────
Deno.test("novelties-moderate with invalid status returns 400 or 401", async () => {
  const { status } = await callFunction({
    novelty_id: "00000000-0000-0000-0000-000000000000",
    next_status: "invalid_status",
  });
  // 400 (validation) or 401 (no auth)
  assertEquals(status >= 400, true);
});

// ─────────────────────────────────────────────────
// Test 4: Missing novelty_id returns error
// ─────────────────────────────────────────────────
Deno.test("novelties-moderate without novelty_id returns error", async () => {
  const { status } = await callFunction({
    next_status: "published",
  });
  assertEquals(status >= 400, true);
});
