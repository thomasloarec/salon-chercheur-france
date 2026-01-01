import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  objet: string;
  description: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ContactRequest = await req.json();
    console.log("Contact form submission received:", { 
      prenom: body.prenom, 
      nom: body.nom, 
      email: body.email, 
      objet: body.objet 
    });

    // Validation basique
    if (!body.prenom || !body.nom || !body.email || !body.objet || !body.description) {
      return new Response(
        JSON.stringify({ error: "Tous les champs obligatoires doivent être remplis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: "Email invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer les secrets Airtable
    const baseId = Deno.env.get("AIRTABLE_CONTACT_BASE_ID");
    const pat = Deno.env.get("AIRTABLE_CONTACT_PAT");

    if (!baseId || !pat) {
      console.error("Missing Airtable contact credentials");
      return new Response(
        JSON.stringify({ error: "Configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Créer l'entrée dans Airtable (Table 1)
    const airtableUrl = `https://api.airtable.com/v0/${baseId}/Table%201`;
    
    const airtablePayload = {
      records: [
        {
          fields: {
            prenom_contact: body.prenom,
            nom_contact: body.nom,
            email_contact: body.email,
            telephone_contact: body.telephone || "",
            objet_contact: body.objet,
            description_contact: body.description
          }
        }
      ]
    };

    console.log("Sending to Airtable:", airtableUrl);

    const airtableResponse = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(airtablePayload)
    });

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error("Airtable error:", airtableResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'enregistrement" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await airtableResponse.json();
    console.log("Airtable success:", result.records?.[0]?.id);

    return new Response(
      JSON.stringify({ success: true, id: result.records?.[0]?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Contact submit error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
