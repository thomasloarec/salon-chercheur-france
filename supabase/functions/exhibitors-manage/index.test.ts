import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/exhibitors-manage`;

// ═══════════════════════════════════════════════
// PART A — Authentication & Routing Tests
// ═══════════════════════════════════════════════

Deno.test("A1: Unauthenticated create returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ action: "create", name: "Test", event_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

Deno.test("A2: Unauthenticated approve_claim returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ action: "approve_claim", request_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

Deno.test("A3: Unauthenticated reject_claim returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ action: "reject_claim", request_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

// ═══════════════════════════════════════════════
// PART B — Code Structure & Security Verification
// ═══════════════════════════════════════════════

Deno.test("B1: All required action handlers exist in code", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
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
    assertEquals(code.includes(action), true, `Missing action handler: ${action}`);
  }
});

Deno.test("B2: Uses SERVICE_ROLE_KEY for write operations", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  assertEquals(code.includes("SUPABASE_SERVICE_ROLE_KEY"), true);
});

Deno.test("B3: approve_claim has admin-only guard", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = code.split("action === 'approve_claim'")[1]?.split("action === 'reject_claim'")[0];
  assertExists(section);
  assertEquals(section.includes("if (!isAdmin)"), true);
  assertEquals(section.includes("Admin access required"), true);
});

Deno.test("B4: reject_claim has admin-only guard", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = code.split("action === 'reject_claim'")[1]?.split("action === 'update'")[0];
  assertExists(section);
  assertEquals(section.includes("if (!isAdmin)"), true);
  assertEquals(section.includes("Admin access required"), true);
});

Deno.test("B5: Domain auto-approve uses strict equality", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  assertEquals(code.includes("websiteDomain.includes(userDomain)"), false, "Must NOT use .includes()");
  assertEquals(code.includes("userDomain === websiteDomain"), true, "Must use strict ===");
});

Deno.test("B6: Create action sets owner_user_id from server (not payload)", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  // In the create section, owner_user_id should come from user.id, not requestData
  const createSection = code.split("action === 'create'")[1]?.split("action === 'approve_claim'")[0];
  assertExists(createSection);
  assertEquals(createSection.includes("owner_user_id: user.id"), true, "owner_user_id must be set from verified user.id");
});

Deno.test("B7: approve_claim updates exhibitor owner_user_id from claim data", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = code.split("action === 'approve_claim'")[1]?.split("action === 'reject_claim'")[0];
  assertExists(section);
  assertEquals(section.includes("owner_user_id: claimRequest.requester_user_id"), true);
  assertEquals(section.includes("approved: true"), true);
});

Deno.test("B8: reject_claim does NOT update exhibitors table", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = code.split("action === 'reject_claim'")[1]?.split("action === 'update'")[0];
  assertExists(section);
  // reject should only update exhibitor_claim_requests, not exhibitors
  assertEquals(section.includes(".from('exhibitors')"), false, "reject_claim must NOT touch exhibitors table");
});

// ═══════════════════════════════════════════════
// PART C — Write operations use serviceClient
// ═══════════════════════════════════════════════

Deno.test("C1: Create writes use serviceClient, not authClient", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const createSection = code.split("action === 'create'")[1]?.split("action === 'approve_claim'")[0];
  assertExists(createSection);
  // All inserts should use serviceClient
  assertEquals(createSection.includes("serviceClient"), true);
  // Should NOT use authClient for inserts
  const insertLines = createSection.split('\n').filter(l => l.includes('.insert('));
  for (const line of insertLines) {
    assertEquals(line.includes("authClient"), false, `INSERT should not use authClient: ${line.trim()}`);
  }
});

Deno.test("C2: Read operations (list) use authClient for RLS", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const listSection = code.split("action === 'list'")[1]?.split("action === 'create'")[0];
  assertExists(listSection);
  assertEquals(listSection.includes("authClient"), true, "list should use authClient for RLS-filtered reads");
});
