import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getSupabase } from "../supabase";

export default defineTool({
  name: "get_salon",
  title: "Get trade show details",
  description:
    "Get the full public details of a single Lotexpo trade show (salon) by its slug.",
  inputSchema: {
    slug: z.string().min(1).describe("The salon slug, e.g. 'sido-2026'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("events")
      .select(
        "nom_event, slug, date_debut, date_fin, ville, nom_lieu, rue, code_postal, pays, type_event, secteur, affluence, tarif, description_event, description_enrichie, url_site_officiel, url_image, is_b2b",
      )
      .eq("slug", slug)
      .eq("visible", true)
      .not("is_test", "is", true)
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!data) {
      return {
        content: [{ type: "text", text: `No salon found for slug "${slug}".` }],
        isError: true,
      };
    }

    const salon = {
      name: data.nom_event,
      slug: data.slug,
      url: data.slug ? `https://lotexpo.com/events/${data.slug}` : null,
      start_date: data.date_debut,
      end_date: data.date_fin,
      city: data.ville,
      venue: data.nom_lieu,
      street: data.rue,
      postal_code: data.code_postal,
      country: data.pays,
      type: data.type_event,
      sectors: Array.isArray(data.secteur) ? data.secteur : [],
      attendance: data.affluence,
      pricing: data.tarif,
      description: data.description_enrichie ?? data.description_event,
      official_site: data.url_site_officiel,
      image: data.url_image,
      b2b: data.is_b2b,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(salon, null, 2) }],
      structuredContent: { salon },
    };
  },
});