import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabase";

export default defineTool({
  name: "search_salons",
  title: "Search trade shows",
  description:
    "Search French professional trade shows (salons) listed on Lotexpo. Filter by keyword, sector label, or city. Returns upcoming and ongoing salons by default.",
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe("Free-text keyword matched against the salon name."),
    sector: z
      .string()
      .optional()
      .describe("Sector label, e.g. 'Industrie & Production' or 'Santé & Médical'."),
    city: z.string().optional().describe("City name, e.g. 'Paris' or 'Lyon'."),
    includePast: z
      .boolean()
      .optional()
      .describe("Set true to include salons that have already ended. Default false."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of results to return (default 20, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, sector, city, includePast, limit }) => {
    const supabase = getSupabase();
    const max = Math.min(Math.max(limit ?? 20, 1), 50);
    const today = new Date().toISOString().slice(0, 10);

    let q = supabase
      .from("events")
      .select(
        "nom_event, slug, date_debut, date_fin, ville, nom_lieu, type_event, secteur, affluence, url_site_officiel",
      )
      .eq("visible", true)
      .not("is_test", "is", true)
      .order("date_debut", { ascending: true })
      .limit(max);

    if (query) q = q.ilike("nom_event", `%${query}%`);
    if (city) q = q.ilike("ville", `%${city}%`);
    if (sector) q = q.contains("secteur", [sector]);
    if (!includePast) q = q.or(`date_fin.gte.${today},date_debut.gte.${today}`);

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }

    const rows = (data ?? []).map((r) => ({
      name: r.nom_event,
      slug: r.slug,
      url: r.slug ? `https://lotexpo.com/events/${r.slug}` : null,
      start_date: r.date_debut,
      end_date: r.date_fin,
      city: r.ville,
      venue: r.nom_lieu,
      type: r.type_event,
      sectors: Array.isArray(r.secteur) ? r.secteur : [],
      attendance: r.affluence,
      official_site: r.url_site_officiel,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, salons: rows },
    };
  },
});