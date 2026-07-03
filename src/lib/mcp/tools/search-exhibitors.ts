import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabase";

export default defineTool({
  name: "search_exhibitors",
  title: "Search exhibitors",
  description:
    "Search companies (exhibitors) referenced on Lotexpo by name. Returns approved, public exhibitor profiles.",
  inputSchema: {
    query: z.string().min(1).describe("Company name or partial name to search for."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of results to return (default 20, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const supabase = getSupabase();
    const max = Math.min(Math.max(limit ?? 20, 1), 50);

    const { data, error } = await supabase
      .from("exhibitors")
      .select("name, slug, website, description, logo_url")
      .eq("approved", true)
      .not("is_test", "is", true)
      .ilike("name", `%${query}%`)
      .order("name", { ascending: true })
      .limit(max);

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }

    const rows = (data ?? []).map((r) => ({
      name: r.name,
      slug: r.slug,
      url: r.slug ? `https://lotexpo.com/exposants/${r.slug}` : null,
      website: r.website,
      description: r.description,
      logo: r.logo_url,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, exhibitors: rows },
    };
  },
});