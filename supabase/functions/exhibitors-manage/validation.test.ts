import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  sanitizeDescription,
  normalizeExternalUrl,
  normalizeLinkedInUrl,
  normalizeImageUrl,
  validateLogoUrl,
  PUBLIC_EDITABLE_FIELDS,
} from "./validation.ts";

const SUPABASE_URL = "https://vxivdvzzhebobveedxbj.supabase.co";
const LOGO_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/exhibitor-logos/`;

// ═══════════════════════════════════════════════
// V — Whitelist
// ═══════════════════════════════════════════════
Deno.test("V0: whitelist is exactly the 4 public fields", () => {
  assertEquals([...PUBLIC_EDITABLE_FIELDS], ["description", "website", "linkedin_url", "logo_url"]);
});

// ═══════════════════════════════════════════════
// V — description
// ═══════════════════════════════════════════════
Deno.test("V1: description trims and keeps plain text", () => {
  assertEquals(sanitizeDescription("  Bonjour le monde  "), { value: "Bonjour le monde" });
});

Deno.test("V2: description strips HTML tags", () => {
  assertEquals(sanitizeDescription("<b>Hello</b> <script>x</script>world"), { value: "Hello world" });
});

Deno.test("V3: empty description becomes null", () => {
  assertEquals(sanitizeDescription("   "), { value: null });
  assertEquals(sanitizeDescription(""), { value: null });
  assertEquals(sanitizeDescription(null), { value: null });
});

Deno.test("V4: description over max length returns an error", () => {
  const long = "a".repeat(3001);
  const res = sanitizeDescription(long);
  assertEquals(res.value, null);
  assertEquals(typeof res.error, "string");
});

// ═══════════════════════════════════════════════
// V — website (normalizeExternalUrl)
// ═══════════════════════════════════════════════
Deno.test("V5: bare domain horn.fr becomes https://horn.fr/", () => {
  assertEquals(normalizeExternalUrl("horn.fr"), "https://horn.fr/");
});

Deno.test("V6: https URL preserved", () => {
  assertEquals(normalizeExternalUrl("https://example.com/page"), "https://example.com/page");
});

Deno.test("V7: free text rejected (null)", () => {
  assertEquals(normalizeExternalUrl("just some text"), null);
});

Deno.test("V8: email rejected (null)", () => {
  assertEquals(normalizeExternalUrl("contact@horn.fr"), null);
  assertEquals(normalizeExternalUrl("mailto:contact@horn.fr"), null);
});

Deno.test("V9: relative URL rejected (null)", () => {
  assertEquals(normalizeExternalUrl("/relative/path"), null);
  assertEquals(normalizeExternalUrl("//host/path"), null);
});

Deno.test("V10: internal whitespace rejected (null)", () => {
  assertEquals(normalizeExternalUrl("horn .fr"), null);
});

// ═══════════════════════════════════════════════
// V — linkedin_url (normalizeLinkedInUrl)
// ═══════════════════════════════════════════════
Deno.test("V11: linkedin company URL accepted", () => {
  assertEquals(
    normalizeLinkedInUrl("https://www.linkedin.com/company/horn"),
    "https://www.linkedin.com/company/horn",
  );
});

Deno.test("V12: linkedin showcase URL accepted", () => {
  assertEquals(
    normalizeLinkedInUrl("https://fr.linkedin.com/showcase/horn-brand"),
    "https://fr.linkedin.com/showcase/horn-brand",
  );
});

Deno.test("V13: bare linkedin.com/company prefixed to https", () => {
  assertEquals(
    normalizeLinkedInUrl("linkedin.com/company/horn"),
    "https://linkedin.com/company/horn",
  );
});

Deno.test("V14: linkedin /in/ profile rejected (null)", () => {
  assertEquals(normalizeLinkedInUrl("https://www.linkedin.com/in/john-doe"), null);
});

Deno.test("V15: linkedin /posts/ and /jobs/ rejected (null)", () => {
  assertEquals(normalizeLinkedInUrl("https://www.linkedin.com/posts/abc"), null);
  assertEquals(normalizeLinkedInUrl("https://www.linkedin.com/jobs/123"), null);
});

Deno.test("V16: fake linkedin domain rejected (null)", () => {
  assertEquals(normalizeLinkedInUrl("https://linkedin.com.evil.com/company/horn"), null);
  assertEquals(normalizeLinkedInUrl("https://notlinkedin.com/company/horn"), null);
});

// ═══════════════════════════════════════════════
// V — logo_url (validateLogoUrl)
// ═══════════════════════════════════════════════
Deno.test("V17: logo from bucket accepted (jpeg/png/webp)", () => {
  const png = `${LOGO_PREFIX}exhibitors/123/logo.png`;
  assertEquals(validateLogoUrl(png, SUPABASE_URL), png);
  const webp = `${LOGO_PREFIX}exhibitors/123/logo.webp`;
  assertEquals(validateLogoUrl(webp, SUPABASE_URL), webp);
});

Deno.test("V18: SVG logo rejected (null)", () => {
  assertEquals(validateLogoUrl(`${LOGO_PREFIX}exhibitors/123/logo.svg`, SUPABASE_URL), null);
});

Deno.test("V19: logo outside bucket rejected (null)", () => {
  assertEquals(validateLogoUrl("https://evil.com/logo.png", SUPABASE_URL), null);
});

Deno.test("V20: empty logo becomes null (allows removal)", () => {
  assertEquals(validateLogoUrl("", SUPABASE_URL), null);
  assertEquals(validateLogoUrl(null, SUPABASE_URL), null);
});

Deno.test("V21: normalizeImageUrl rejects relative and bare domains", () => {
  assertEquals(normalizeImageUrl("/logo.png"), null);
  assertEquals(normalizeImageUrl("example.com/logo.png"), null);
});