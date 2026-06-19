// supabase/functions/widget-embed/index.ts
//
// Widget white-label Lotexpo (brique B2).
// Rend, à partir de ?token=, un document HTML embarquable en iframe :
//   - annuaire exposants du salon
//   - Nouveautés publiées
// Sécurité : lecture en clé ANON (RLS = filet) + filtres de visibilité explicites
// (ceinture + bretelles), échappement HTML systématique, href validées http(s),
// header Content-Security-Policy: frame-ancestors dérivé du token, AUCUN
// X-Frame-Options, AUCUN cookie, noindex.
//
// DÉPLOIEMENT CRITIQUE : cette fonction DOIT être déployée SANS vérification JWT,
// sinon l'iframe (qui n'envoie pas d'en-tête Authorization) reçoit un 401 →
// widget vide silencieux. Voir la note en bas de fichier.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ---------- Helpers sécurité ----------

/** Échappe pour insertion dans du HTML (texte ou valeur d'attribut). */
function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** N'accepte qu'une URL http(s). Préfixe https:// si le schéma manque. Sinon null. */
function safeUrl(value: unknown): string | null {
  if (!value) return null;
  let s = String(value).trim();
  if (!s) return null;
  const scheme = s.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme) {
    const p = scheme[1].toLowerCase();
    if (p !== "http" && p !== "https") return null; // rejette javascript:, data:, etc.
  } else {
    s = "https://" + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Construit la valeur frame-ancestors depuis allowed_domains (origines admin). */
function frameAncestors(domains: string[] | null | undefined): string {
  const clean = (domains ?? [])
    .map((d) => String(d).trim())
    .filter((d) => /^https?:\/\/[^\s;'"]+$/i.test(d)); // évite toute injection de directive
  return clean.length ? clean.join(" ") : "'none'";
}

// ---------- Rendu ----------

function exhibitorCard(e: Record<string, unknown>): string {
  const name = esc(e.name_final);
  if (!name) return "";
  const logo = safeUrl(e.logo_url);
  const stand = esc(e.stand_exposant);
  const site = safeUrl(e.website_final);
  return `
    <div class="card">
      ${logo
        ? `<img class="logo" src="${esc(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<div class="logo logo--placeholder" aria-hidden="true"></div>`}
      <div class="card-body">
        <h3 class="card-title">${name}</h3>
        ${stand ? `<p class="card-meta">Stand ${stand}</p>` : ""}
        ${site ? `<a class="card-link" href="${esc(site)}" target="_blank" rel="nofollow noopener noreferrer">Site web</a>` : ""}
      </div>
    </div>`;
}

function noveltyCard(n: Record<string, unknown>): string {
  const title = esc(n.title);
  if (!title) return "";
  const type = esc(n.type);
  const reason = esc(n.reason_1);
  const exhibitor = n.exhibitor as Record<string, unknown> | null | undefined;
  const exhName = esc(exhibitor?.name);
  const media = n.media_urls as unknown[] | null | undefined;
  const img = Array.isArray(media) && media.length ? safeUrl(media[0]) : null;
  return `
    <div class="card card--novelty">
      ${img ? `<img class="cover" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <div class="card-body">
        ${type ? `<span class="badge">${type}</span>` : ""}
        <h3 class="card-title">${title}</h3>
        ${exhName ? `<p class="card-meta">${exhName}</p>` : ""}
        ${reason ? `<p class="card-reason">${reason}</p>` : ""}
      </div>
    </div>`;
}

function page(opts: {
  exhibitors: Record<string, unknown>[];
  novelties: Record<string, unknown>[];
  slug: string;
  eventPassed: boolean;
}): string {
  const { exhibitors, novelties, slug, eventPassed } = opts;
  const canonical =
    `https://lotexpo.com/events/${encodeURIComponent(slug)}?utm_source=widget&utm_medium=embed`;

  const exhHtml = exhibitors.map(exhibitorCard).filter(Boolean).join("");
  const novHtml = novelties.map(noveltyCard).filter(Boolean).join("");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Lotexpo · Widget exposants</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.45;
    }
    .widget { max-width: 1080px; margin: 0 auto; padding: 16px; }
    .archive { margin: 0 0 16px; padding: 10px 14px; border-radius: 8px; background: #fff7ed; color: #9a3412; font-size: 14px; }
    .block { margin-bottom: 28px; }
    .block-title { font-size: 18px; font-weight: 700; margin: 0 0 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
    .card { display: flex; flex-direction: column; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; }
    .logo { width: 100%; height: 96px; object-fit: contain; background: #f9fafb; padding: 12px; }
    .logo--placeholder { background: #f3f4f6; }
    .cover { width: 100%; height: 130px; object-fit: cover; background: #f3f4f6; }
    .card-body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
    .card-title { font-size: 15px; font-weight: 600; margin: 0; }
    .card-meta { font-size: 13px; color: #6b7280; margin: 0; }
    .card-reason { font-size: 13px; color: #374151; margin: 0; }
    .card-link { font-size: 13px; color: #2563eb; text-decoration: none; }
    .card-link:hover { text-decoration: underline; }
    .badge { align-self: flex-start; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: #4338ca; background: #eef2ff; padding: 2px 8px; border-radius: 999px; }
    .empty { font-size: 14px; color: #6b7280; margin: 0; }
    .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
    .footer a { color: #2563eb; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main class="widget">
    ${eventPassed ? `<p class="archive">Édition terminée — annuaire conservé à titre d'archive.</p>` : ""}

    <section class="block">
      <h2 class="block-title">Exposants</h2>
      ${exhHtml ? `<div class="grid">${exhHtml}</div>` : `<p class="empty">Annuaire en cours de constitution.</p>`}
    </section>

    <section class="block">
      <h2 class="block-title">Nouveautés des exposants</h2>
      ${novHtml ? `<div class="grid">${novHtml}</div>` : `<p class="empty">Les nouveautés des exposants apparaîtront ici.</p>`}
    </section>

    <footer class="footer">
      Propulsé par Lotexpo ·
      <a href="${esc(canonical)}" target="_blank" rel="nofollow noopener noreferrer">Voir tout sur Lotexpo</a>
    </footer>
  </main>
</body>
</html>`;
}

/** Document neutre pour token invalide / révoqué (jamais affichable : frame-ancestors 'none'). */
function neutralPage(): string {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Lotexpo</title>
</head>
<body></body>
</html>`;
}

// ---------- Handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  // 1. Résolution du token
  const token = new URL(req.url).searchParams.get("token") ?? "";
  let resolved: any = null;
  try {
    const { data, error } = await supabase.rpc("resolve_widget_token", { p_token: token });
    if (error) console.error("resolve_widget_token error:", error.message);
    resolved = Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.error("resolve_widget_token threw:", e);
  }

  // 2. Token inconnu / révoqué → document neutre, non framable
  if (!resolved) {
    const html = neutralPage();
    const bytes = new TextEncoder().encode(html);
    const headers = new Headers();
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("X-Robots-Tag", "noindex");
    headers.set("Cache-Control", "public, max-age=300");
    headers.set("Content-Security-Policy", "frame-ancestors 'none'");
    return new Response(bytes, { status: 200, headers });
  }

  const fa = frameAncestors(resolved.allowed_domains);

  // 3. Lecture du contenu (ANON + filtres explicites). Dégradation gracieuse + logs.
  let exhibitors: Record<string, unknown>[] = [];
  let novelties: Record<string, unknown>[] = [];

  try {
    const { data, error } = await supabase
      .from("participations_with_exhibitors")
      .select("name_final, logo_url, stand_exposant, website_final")
      .eq("id_event_text", resolved.id_event_text)
      .order("name_final", { ascending: true });
    if (error) console.error("exhibitors query error:", error.message);
    // dédup par nom (la vue peut renvoyer des participations en double)
    const seen = new Set<string>();
    exhibitors = (data ?? []).filter((r: any) => {
      const k = String(r.name_final ?? "").trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch (e) {
    console.error("exhibitors query threw:", e);
  }

  try {
    const { data, error } = await supabase
      .from("novelties")
      .select("title, type, reason_1, media_urls, exhibitor:exhibitors!exhibitor_id(name)")
      .eq("event_id", resolved.event_id)
      .eq("status", "published")   // filtre explicite (ceinture + bretelles)
      .eq("is_test", false)        // filtre explicite
      .order("created_at", { ascending: false });
    if (error) console.error("novelties query error:", error.message);
    novelties = data ?? [];
  } catch (e) {
    console.error("novelties query threw:", e);
  }

  // 4. Rendu + headers
  const html = page({
    exhibitors,
    novelties,
    slug: String(resolved.event_slug ?? ""),
    eventPassed: Boolean(resolved.event_passed),
  });
  const bytes = new TextEncoder().encode(html);
  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Cache-Control", "public, max-age=300");
  headers.set("Content-Security-Policy", `frame-ancestors ${fa}`);

  // PAS de X-Frame-Options. PAS de Set-Cookie. PAS de Access-Control-Allow-Origin.
  return new Response(bytes, { status: 200, headers });
});

/*
=========================  NOTES DE DÉPLOIEMENT  =========================

1) JWT DÉSACTIVÉ (CRITIQUE). L'iframe navigue vers l'URL sans en-tête Authorization.
   Si la vérification JWT reste active → 401 → widget vide silencieux.
   - CLI :  supabase functions deploy widget-embed --no-verify-jwt
   - ou config.toml :
       [functions.widget-embed]
       verify_jwt = false

2) Clé ANON auto-injectée (SUPABASE_URL, SUPABASE_ANON_KEY). Ne PAS utiliser
   SUPABASE_SERVICE_ROLE_KEY ici : la RLS doit rester le filet.

3) URL de test (avant le sous-domaine embed.lotexpo.com, brique ultérieure) :
   https://<ref>.supabase.co/functions/v1/widget-embed?token=<TOKEN>
*/