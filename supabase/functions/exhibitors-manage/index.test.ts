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

Deno.test("B5: NO domain-based auto-approval in create action", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const createSection = code.split("action === 'create'")[1]?.split("action === 'approve_claim'")[0];
  assertExists(createSection);
  // Domain-equality auto-approve logic must be gone
  assertEquals(createSection.includes("userDomain === websiteDomain"), false, "Domain auto-approve must be removed");
  assertEquals(createSection.includes("claimStatus = 'approved'"), false, "claim must never be auto-approved on create");
});

Deno.test("B6: Create action does NOT set owner_user_id to the requester", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const createSection = code.split("action === 'create'")[1]?.split("action === 'approve_claim'")[0];
  assertExists(createSection);
  // owner_user_id must remain null at create time — granted only via approve_claim
  assertEquals(createSection.includes("owner_user_id: user.id"), false, "owner_user_id must NOT be set from requester at create");
  assertEquals(createSection.includes("owner_user_id: null"), true, "owner_user_id must be explicitly null at create");
});

Deno.test("B6b: Create action does NOT auto-insert owner team membership", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const createSection = code.split("action === 'create'")[1]?.split("action === 'approve_claim'")[0];
  assertExists(createSection);
  assertEquals(createSection.includes("exhibitor_team_members"), false, "create must not write to exhibitor_team_members");
  assertEquals(createSection.includes(".update({ verified_at"), false, "create must not set verified_at");
  assertEquals(createSection.includes("verified_at: new Date"), false, "create must not assign verified_at timestamp");
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
  const section = code.split("action === 'reject_claim'")[1]?.split("action === 'get_editable'")[0];
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

// ═══════════════════════════════════════════════
// PART D — Phase 4A-B: update action (auth + whitelist)
// ═══════════════════════════════════════════════

function updateSection(code: string): string {
  // From the update handler to the next named helper/handler.
  return code.split("action === 'update'")[1]?.split("resolveUserByEmail")[0] ?? "";
}

Deno.test("D0: Unauthenticated update returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({
      action: "update",
      exhibitor_id: "00000000-0000-0000-0000-000000000000",
      description: "x",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

// ── Phase 4A-C: get_editable (read-only, raw editorial prefill) ──
function getEditableSection(code: string): string {
  return code.split("action === 'get_editable'")[1]?.split("action === 'update'")[0] ?? "";
}

Deno.test("E0: Unauthenticated get_editable returns 401", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({
      action: "get_editable",
      exhibitor_id: "00000000-0000-0000-0000-000000000000",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Authentication required");
});

Deno.test("E1: get_editable returns ONLY raw exhibitors.description (no ai_summary)", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = getEditableSection(code);
  assertExists(section);
  // Reads the raw editorial column directly from exhibitors.
  assertEquals(section.includes("description: exRow.description"), true, "must read raw exhibitors.description");
  // Never reads/returns ai_summary nor the computed view value.
  assertEquals(section.includes("ai_summary"), false, "must never reference ai_summary");
  assertEquals(section.includes("public_exhibitor_profiles"), false, "must never read the computed view");
});

Deno.test("E2: get_editable enforces the same manager authorization as update", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = getEditableSection(code);
  assertEquals(section.includes("authorized = isAdmin"), true, "must allow platform admin");
  assertEquals(section.includes("exRow.owner_user_id === user.id"), true, "must allow owner_user_id match");
  assertEquals(section.includes(".eq('status', 'active')"), true, "team check must require active status");
  assertEquals(section.includes("['owner', 'admin']"), true, "team check must require owner/admin role");
});

Deno.test("D1: update authorization allows admin OR owner_user_id OR active owner/admin team member", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = updateSection(code);
  assertExists(section);
  // admin
  assertEquals(section.includes("authorized = isAdmin"), true, "must allow platform admin");
  // owner_user_id (owner historique sans team member)
  assertEquals(section.includes("exRow.owner_user_id === user.id"), true, "must allow owner_user_id match");
  // active owner/admin team member
  assertEquals(section.includes("exhibitor_team_members"), true);
  assertEquals(section.includes(".eq('status', 'active')"), true, "team check must require active status");
  assertEquals(section.includes("['owner', 'admin']"), true, "team check must require owner/admin role");
});

Deno.test("D2: legacy-pure profiles (no exhibitor row) are not editable -> 404", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = updateSection(code);
  assertEquals(section.includes("Exhibitor not found"), true, "must 404 when no modern exhibitor row exists");
});

Deno.test("D3: update whitelists ONLY description/website/linkedin_url/logo_url", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = updateSection(code);
  assertEquals(section.includes("'description' in requestData"), true);
  assertEquals(section.includes("'website' in requestData"), true);
  assertEquals(section.includes("'linkedin_url' in requestData"), true);
  assertEquals(section.includes("'logo_url' in requestData"), true);
});

Deno.test("D4: forbidden fields are NEVER assigned in update payload", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = updateSection(code);
  const forbidden = [
    "updateData.name",
    "updateData.display_name",
    "updateData.name_normalized",
    "updateData.slug",
    "updateData.public_slug",
    "updateData.ai_summary",
    "updateData.seo_indexable",
    "updateData.approved",
    "updateData.verified_at",
    "updateData.owner_user_id",
    "updateData.is_test",
    "updateData.plan",
  ];
  for (const f of forbidden) {
    assertEquals(section.includes(f), false, `forbidden field must not be written: ${f}`);
  }
});

Deno.test("D5: update uses server-side validation helpers", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = updateSection(code);
  assertEquals(section.includes("sanitizeDescription("), true);
  assertEquals(section.includes("normalizeExternalUrl("), true);
  assertEquals(section.includes("normalizeLinkedInUrl("), true);
  assertEquals(section.includes("validateLogoUrl("), true);
});

Deno.test("D6: update writes use serviceClient", async () => {
  const code = await Deno.readTextFile("supabase/functions/exhibitors-manage/index.ts");
  const section = updateSection(code);
  const updateLines = section.split("\n").filter((l) => l.includes(".update("));
  for (const line of updateLines) {
    assertEquals(line.includes("authClient"), false, `UPDATE should not use authClient: ${line.trim()}`);
  }
  assertEquals(section.includes("serviceClient"), true);
});
