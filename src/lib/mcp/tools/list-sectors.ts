import { defineTool } from "@lovable.dev/mcp-js";
import { getSupabase } from "../supabase";

export default defineTool({
  name: "list_sectors",
  title: "List trade show sectors",
  description:
    "List the business sectors that Lotexpo trade shows are classified under, with the number of upcoming salons per sector. Use the returned labels with search_salons.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("events")
      .select("secteur")
      .eq("visible", true)
      .not("is_test", "is", true)
      .or(`date_fin.gte.${today},date_debut.gte.${today}`);

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const labels = Array.isArray(row.secteur) ? row.secteur : [];
      for (const label of labels) {
        if (typeof label === "string" && label.trim()) {
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      }
    }

    const sectors = [...counts.entries()]
      .map(([label, upcomingSalons]) => ({ label, upcomingSalons }))
      .sort((a, b) => b.upcomingSalons - a.upcomingSalons);

    return {
      content: [{ type: "text", text: JSON.stringify(sectors, null, 2) }],
      structuredContent: { count: sectors.length, sectors },
    };
  },
});