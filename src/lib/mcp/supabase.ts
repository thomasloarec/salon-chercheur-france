import { createClient } from "@supabase/supabase-js";

// Lazy, import-safe Supabase client factory. Never read env at module top level:
// this module is evaluated at build time and on Edge Function cold start where
// secrets may be absent. Read env inside the getter, at request time.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment is not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}