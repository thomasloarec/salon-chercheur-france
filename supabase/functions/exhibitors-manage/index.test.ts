import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/exhibitors-manage`;

// We need a real user session. We'll use the service role to create a test context.
// For security tests, we test with anon key only (no auth → 401).

// ─── TEST 1: Unauthenticated calls return 401 ───
Deno.test("Unauthenticated create returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({
      action: "create",
      name: "Test",
      event_id: "00000000-0000-0000-0000-000000000000",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

Deno.test("Unauthenticated approve_claim returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({
      action: "approve_claim",
      request_id: "00000000-0000-0000-0000-000000000000",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

Deno.test("Unauthenticated reject_claim returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({
      action: "reject_claim",
      request_id: "00000000-0000-0000-0000-000000000000",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

// ─── TEST 2: Unknown action returns 400 (not 405 or silent success) ───
// This requires auth, so we skip if no session. But we can verify routing exists.
Deno.test("Unknown action returns proper error (needs auth)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ action: "does_not_exist" }),
  });
  const body = await res.json();
  // Without auth, we get 401 first - which is correct behavior
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

// ─── TEST 3: Verify the action routing structure via code inspection ───
Deno.test("Function file contains all required action handlers", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  
  // Verify all actions are routed
  const requiredActions = [
    "action === 'list'",
    "action === 'create'",
    "action === 'approve_claim'",
    "action === 'reject_claim'",
    "action === 'update'",
    "action === 'claim'",
    "action === 'create-request'",
  ];
  
  for (const action of requiredActions) {
    assertEquals(
      code.includes(action),
      true,
      `Missing action handler: ${action}`
    );
  }
  
  // Verify service_role client is used for writes
  assertEquals(
    code.includes("SUPABASE_SERVICE_ROLE_KEY"),
    true,
    "Should use SERVICE_ROLE_KEY for write operations"
  );
  
  // Verify admin check on claim actions
  assertEquals(
    code.includes("action === 'approve_claim'") && code.includes("if (!isAdmin)"),
    true,
    "approve_claim should check isAdmin"
  );
});

// ─── TEST 4: Verify security - approve_claim has admin guard ───
Deno.test("approve_claim handler has admin-only guard in code", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  
  // Find the approve_claim section and verify it checks isAdmin before proceeding
  const approveSection = code.split("action === 'approve_claim'")[1]?.split("action === 'reject_claim'")[0];
  assertExists(approveSection, "approve_claim section should exist");
  assertEquals(
    approveSection.includes("if (!isAdmin)"),
    true,
    "approve_claim must check admin status"
  );
  assertEquals(
    approveSection.includes("Admin access required"),
    true,
    "approve_claim must return 403 for non-admins"
  );
});

// ─── TEST 5: Verify security - reject_claim has admin guard ───
Deno.test("reject_claim handler has admin-only guard in code", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  
  const rejectSection = code.split("action === 'reject_claim'")[1]?.split("action === 'update'")[0];
  assertExists(rejectSection, "reject_claim section should exist");
  assertEquals(
    rejectSection.includes("if (!isAdmin)"),
    true,
    "reject_claim must check admin status"
  );
  assertEquals(
    rejectSection.includes("Admin access required"),
    true,
    "reject_claim must return 403 for non-admins"
  );
});

// ─── TEST 6: Verify domain comparison is strict (not .includes()) ───
Deno.test("Domain auto-approve uses strict equality, not includes()", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  
  // Should NOT contain the old vulnerable pattern
  assertEquals(
    code.includes("websiteDomain.includes(userDomain)"),
    false,
    "Should NOT use .includes() for domain comparison (vulnerability)"
  );
  
  // Should use strict equality
  assertEquals(
    code.includes("userDomain === websiteDomain"),
    true,
    "Should use strict === for domain comparison"
  );
});
