import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHOIX_VALIDES = [
  "pas_le_temps",
  "pas_le_bon_contact",
  "donnees_indispo",
  "pas_interesse",
  "aidez_moi",
] as const;

const MESSAGES: Record<string, { titre: string; corps: string }> = {
  pas_le_temps: {
    titre: "C'est noté",
    corps: "Je vous laisse tranquille et je reviendrai vers vous dans un mois. Vos pages restent modifiables à tout moment depuis votre espace organisateur.",
  },
  donnees_indispo: {
    titre: "C'est noté",
    corps: "Je reviendrai vers vous dans un mois, le temps que vos informations soient prêtes.",
  },
  pas_le_bon_contact: {
    titre: "Merci de me l'avoir dit",
    corps: "J'arrête ces relances. Si vous pouvez me transmettre le bon contact en répondant à mon email, je prendrai le relais directement avec cette personne.",
  },
  aidez_moi: {
    titre: "Je m'en occupe",
    corps: "Répondez simplement à mon dernier email avec vos fichiers, dans le format que vous avez, et je les intègre moi-même.",
  },
  pas_interesse: {
    titre: "C'est noté",
    corps: "Je ne vous relancerai plus sur ce sujet. Vos pages restent accessibles et modifiables depuis votre espace organisateur.",
  },
};

function page(titre: string, corps: string, status = 200): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre} · Lotexpo</title></head>
<body style="margin:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:60px auto;padding:34px 30px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;">
  <div style="font-family:Georgia,serif;font-size:19px;font-weight:bold;color:#0b132b;padding-bottom:18px;border-bottom:2px solid #6b51ff;">Lotexpo</div>
  <h1 style="margin:24px 0 12px;font-family:Georgia,serif;font-size:22px;color:#0b132b;">${titre}</h1>
  <p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#1f2937;">${corps}</p>
  <a href="https://lotexpo.com/profil" style="display:inline-block;padding:12px 22px;background:#6b51ff;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:bold;">Mon espace organisateur &rarr;</a>
</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const camp = url.searchParams.get("camp");
    const choix = url.searchParams.get("choix");
    const theme = url.searchParams.get("theme");

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!camp || !uuidRe.test(camp) || !choix || !CHOIX_VALIDES.includes(choix as any)) {
      return page("Lien invalide", "Ce lien n'est pas valide ou a expiré. Vous pouvez répondre directement à mon email.", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("organizer_activation_feedback_record", {
      p_campaign_id: camp,
      p_choix: choix,
      p_theme: theme,
      p_user_agent: req.headers.get("user-agent") ?? null,
    });

    if (error) {
      console.error("activation-feedback rpc error", error);
      return page("Une erreur est survenue", "Je n'ai pas pu enregistrer votre réponse. Répondez directement à mon email, je m'en occuperai.", 500);
    }
    if (!data?.ok) {
      console.warn("activation-feedback refus", data);
      return page("Lien invalide", "Ce lien n'est pas valide ou a expiré. Vous pouvez répondre directement à mon email.", 400);
    }

    const m = MESSAGES[choix] ?? MESSAGES.pas_le_temps;
    return page(m.titre, m.corps);
  } catch (e) {
    console.error("activation-feedback exception", e);
    return page("Une erreur est survenue", "Je n'ai pas pu enregistrer votre réponse. Répondez directement à mon email.", 500);
  }
});
