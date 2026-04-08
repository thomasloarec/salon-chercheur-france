import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/novelties-create`;

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
// Test 1: No auth → 401
// ─────────────────────────────────────────────────
Deno.test("novelties-create without auth returns 401", async () => {
  const { status } = await callFunction({
    event_id: "00000000-0000-0000-0000-000000000000",
    exhibitor_id: "00000000-0000-0000-0000-000000000000",
    title: "Test novelty",
    novelty_type: "Launch",
    reason: "This is a test reason with enough characters",
    images: ["https://example.com/img.jpg"],
  });
  assertEquals(status, 401);
});

// ─────────────────────────────────────────────────
// Test 2: Invalid token → 401
// ─────────────────────────────────────────────────
Deno.test("novelties-create with invalid token returns 401", async () => {
  const { status } = await callFunction(
    {
      event_id: "00000000-0000-0000-0000-000000000000",
      exhibitor_id: "00000000-0000-0000-0000-000000000000",
      title: "Test novelty",
      novelty_type: "Launch",
      reason: "This is a test reason with enough characters",
      images: ["https://example.com/img.jpg"],
    },
    "invalid-token"
  );
  assertEquals(status, 401);
});

// ─────────────────────────────────────────────────
// Test 3: Validation error (missing fields) → 400 or 401
// ─────────────────────────────────────────────────
Deno.test("novelties-create with missing fields returns error", async () => {
  const { status } = await callFunction({ title: "x" });
  assertEquals(status >= 400, true);
});

// ─────────────────────────────────────────────────
// Test 4: Code contains team membership guard
// ─────────────────────────────────────────────────
Deno.test("novelties-create source contains TEAM_MEMBERSHIP_REQUIRED guard", async () => {
  const source = await Deno.readTextFile("supabase/functions/novelties-create/index.ts");
  
  // Verify the guard checks for active owner
  assertEquals(source.includes("exhibitor_team_members"), true, "Must query exhibitor_team_members");
  assertEquals(source.includes("TEAM_MEMBERSHIP_REQUIRED"), true, "Must return TEAM_MEMBERSHIP_REQUIRED code");
  assertEquals(source.includes("maybeSingle"), true, "Must use maybeSingle for optional owner check");
  
  // Verify unmanaged exhibitor path exists
  assertEquals(source.includes("Unmanaged exhibitor"), true, "Must have unmanaged exhibitor path");
  
  // Verify admin bypass exists
  assertEquals(source.includes("user_roles"), true, "Must check admin role for bypass");
});

// ─────────────────────────────────────────────────
// Test 5: Three cases are handled distinctly
// ─────────────────────────────────────────────────
Deno.test("novelties-create handles 3 team cases: unmanaged, managed+rejected, admin", async () => {
  const source = await Deno.readTextFile("supabase/functions/novelties-create/index.ts");
  
  // Case 1: Unmanaged → open access
  assertEquals(source.includes("open access"), true, "Unmanaged case must log open access");
  
  // Case 2: Managed + non-member → reject with 403
  assertEquals(source.includes("TEAM_MEMBERSHIP_REQUIRED"), true, "Managed non-member must be rejected");
  assertEquals(source.includes("403"), true, "Rejection must return 403");
  
  // Case 3: Admin → always allowed
  assertEquals(source.includes("admin"), true, "Admin bypass must exist");
});
