import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth check — admin only
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check admin role
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: roleData } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const PLAUSIBLE_KEY = Deno.env.get("PLAUSIBLE_API_KEY");
  if (!PLAUSIBLE_KEY) {
    return new Response(
      JSON.stringify({ error: "PLAUSIBLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SITE_ID = "lotexpo.com";

  // Parse period from query params (default 7d)
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d";

  try {
    // Run 4 queries in parallel against Plausible API v2
    const plausibleQuery = async (body: Record<string, unknown>) => {
      const res = await fetch("https://plausible.io/api/v2/query", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PLAUSIBLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ site_id: SITE_ID, ...body }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Plausible ${res.status}: ${text}`);
      }
      return res.json();
    };

    const [aggregate, timeseries, topPages, topSources] = await Promise.all([
      // 1. Aggregate metrics
      plausibleQuery({
        metrics: ["visitors", "pageviews", "visits", "bounce_rate", "visit_duration"],
        date_range: period,
      }),
      // 2. Timeseries (daily)
      plausibleQuery({
        metrics: ["visitors", "pageviews"],
        date_range: period,
        dimensions: ["time:day"],
      }),
      // 3. Top pages
      plausibleQuery({
        metrics: ["visitors", "pageviews"],
        date_range: period,
        dimensions: ["event:page"],
        pagination: { limit: 10, offset: 0 },
      }),
      // 4. Top sources
      plausibleQuery({
        metrics: ["visitors"],
        date_range: period,
        dimensions: ["visit:source"],
        pagination: { limit: 10, offset: 0 },
      }),
    ]);

    // Also fetch previous period for comparison
    const previousPeriod = period === "7d" ? "custom" : "custom";
    let aggregatePrev = null;
    try {
      // Calculate previous date range
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 7;
      const endPrev = new Date();
      endPrev.setDate(endPrev.getDate() - days);
      const startPrev = new Date(endPrev);
      startPrev.setDate(startPrev.getDate() - days);

      aggregatePrev = await plausibleQuery({
        metrics: ["visitors", "pageviews", "visits"],
        date_range: [
          startPrev.toISOString().slice(0, 10),
          endPrev.toISOString().slice(0, 10),
        ],
      });
    } catch {
      // Non-critical, ignore
    }

    return new Response(
      JSON.stringify({
        aggregate,
        aggregatePrev,
        timeseries,
        topPages,
        topSources,
        period,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Plausible API error:", err.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch analytics", detail: err.message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
